package editor

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// UpdateConfigJson updates the theme's config_json using an optimistic lock
// keyed by version. On version mismatch (pgx.ErrNoRows from the conditional
// UPDATE), the current version is re-read and returned in the RFC 9457
// Problem Details "extensions.current_version" field so the client can perform
// a silent rebase without a second round-trip.
func (s *service) UpdateConfigJson(ctx context.Context, creatorID, themeID uuid.UUID, config json.RawMessage) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
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
