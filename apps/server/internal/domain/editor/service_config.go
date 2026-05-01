package editor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/middleware"
)

// validateConfigShape rejects config_json payloads that use any of the known
// legacy shapes (D-19/D-20 forward-only gate). New writes must use:
//   - modules: {[id]: {enabled, config?}} object map (not array)
//   - locationClueConfig.clueIds for clue placement (not top-level clue_placement)
//   - modules[id].config for module config (not top-level module_configs)
//   - modules.starting_clue for character clues (not top-level character_clues)
func validateConfigShape(raw json.RawMessage) error {
	if raw == nil || len(raw) == 0 {
		return fmt.Errorf("config_json: empty payload")
	}
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return fmt.Errorf("config_json: invalid JSON: %w", err)
	}
	if cfg == nil {
		return errors.New("config_json: payload must be a JSON object, null/non-object rejected")
	}
	if mods, exists := cfg["modules"]; exists {
		if mods == nil {
			return fmt.Errorf("config_json: modules cannot be null — use empty object {} to disable all modules")
		}
		if _, isMap := mods.(map[string]any); !isMap {
			return fmt.Errorf("config_json: legacy modules shape rejected (D-19) — must be {[id]: {enabled, config?}} object map")
		}
	}
	if _, hasOld := cfg["clue_placement"]; hasOld {
		return fmt.Errorf("config_json: legacy clue_placement key rejected (D-20) — use locations[].locationClueConfig.clueIds")
	}
	if _, hasOld := cfg["module_configs"]; hasOld {
		return fmt.Errorf("config_json: legacy module_configs key rejected (D-19) — embed config inside modules[id].config")
	}
	if _, hasOld := cfg["character_clues"]; hasOld {
		return fmt.Errorf("config_json: legacy character_clues key rejected (D-20) — use modules.starting_clue.config.startingClues")
	}
	// H2: reject dead key locations[].clueIds on write (D-20 forward-only gate).
	// The read/normalizer path unions this key; writes must use locationClueConfig.clueIds.
	if locsRaw, ok := cfg["locations"].([]any); ok {
		for i, locAny := range locsRaw {
			loc, ok := locAny.(map[string]any)
			if !ok {
				continue
			}
			if _, hasDeadKey := loc["clueIds"]; hasDeadKey {
				return fmt.Errorf("config_json: locations[%d].clueIds dead key rejected (D-20) — use locationClueConfig.clueIds", i)
			}
		}
	}
	return nil
}

// UpdateConfigJson updates the theme's config_json using an optimistic lock
// keyed by version. On version mismatch (pgx.ErrNoRows from the conditional
// UPDATE), the current version is re-read and returned in the RFC 9457
// Problem Details "extensions.current_version" field so the client can perform
// a silent rebase without a second round-trip.
func (s *service) UpdateConfigJson(ctx context.Context, creatorID, themeID uuid.UUID, config json.RawMessage) (*ThemeResponse, error) {
	if err := validateConfigShape(config); err != nil {
		return nil, apperror.BadRequest(err.Error())
	}
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}

	// preUpdateHook is nil in production. Tests set it to bump the DB version
	// between our read and write, forcing a deterministic optimistic-lock failure.
	if s.preUpdateHook != nil {
		s.preUpdateHook(ctx, themeID)
	}

	updated, err := s.q.UpdateThemeConfigJson(ctx, db.UpdateThemeConfigJsonParams{
		ID:         themeID,
		ConfigJson: config,
		Version:    theme.Version,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, s.buildConfigVersionConflict(ctx, themeID, theme.Version)
		}
		s.logger.Error().Err(err).Msg("failed to update config")
		return nil, apperror.Internal("failed to update config")
	}
	evt := s.logger.Info().
		Str("creator_id", creatorID.String()).
		Str("theme_id", themeID.String()).
		Int32("version_from", theme.Version).
		Int32("version_to", updated.Version).
		Int("config_bytes", len(config))
	if rid := middleware.GetRequestID(ctx); rid != "" {
		evt = evt.Str("request_id", rid)
	}
	evt.Msg("theme config updated")
	return toThemeResponse(updated), nil
}

// buildConfigVersionConflict constructs a 409 Problem Details response for a
// failed optimistic lock on theme config_json. It re-reads the authoritative
// current version so the client can rebase. On any failure to re-read, it
// falls back to the stale version the caller held; never a 500, because the
// upstream condition was a conflict, not an infrastructure error.
func (s *service) buildConfigVersionConflict(ctx context.Context, themeID uuid.UUID, fallbackVersion int32) error {
	currentVersion := fallbackVersion
	if latest, getErr := s.q.GetTheme(ctx, themeID); getErr == nil {
		currentVersion = latest.Version
	} else {
		s.logger.Warn().
			Err(getErr).
			Str("theme_id", themeID.String()).
			Msg("could not re-read theme version after optimistic lock conflict; falling back to caller's version")
	}

	return apperror.New(
		apperror.ErrEditorConfigVersionMismatch,
		409,
		"theme was modified by another session",
	).WithExtensions(map[string]any{
		"current_version": currentVersion,
	})
}
