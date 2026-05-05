package editor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

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
	if err := validateClueInteractionConfigShape(cfg); err != nil {
		return err
	}
	if _, err := extractLocationDiscoveryRefs(cfg); err != nil {
		return err
	}
	return nil
}

type locationDiscoveryRef struct {
	index           int
	locationID      string
	clueID          string
	requiredClueIDs []string
}

type endingBranchRef struct {
	field string
	index int
	id    string
}

func extractLocationDiscoveryRefs(cfg map[string]any) ([]locationDiscoveryRef, error) {
	modules, ok := cfg["modules"].(map[string]any)
	if !ok {
		return nil, nil
	}
	rawModule, exists := modules["location"]
	if !exists {
		return nil, nil
	}
	module, ok := rawModule.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("config_json: modules.location must be an object")
	}
	moduleConfigRaw, exists := module["config"]
	if !exists {
		return nil, nil
	}
	if moduleConfigRaw == nil {
		return nil, fmt.Errorf("config_json: modules.location.config cannot be null")
	}
	moduleConfig, ok := moduleConfigRaw.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("config_json: modules.location.config must be an object")
	}
	rawDiscoveries, exists := moduleConfig["discoveries"]
	if !exists {
		return nil, nil
	}
	if rawDiscoveries == nil {
		return nil, fmt.Errorf("config_json: modules.location.config.discoveries cannot be null")
	}
	discoveries, ok := rawDiscoveries.([]any)
	if !ok {
		return nil, fmt.Errorf("config_json: modules.location.config.discoveries must be an array")
	}
	refs := make([]locationDiscoveryRef, 0, len(discoveries))
	for i, rawDiscovery := range discoveries {
		discovery, ok := rawDiscovery.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("config_json: modules.location.config.discoveries[%d] must be an object", i)
		}
		locationID, ok := discovery["locationId"].(string)
		if !ok || locationID == "" {
			return nil, fmt.Errorf("config_json: modules.location.config.discoveries[%d].locationId is required", i)
		}
		clueID, ok := discovery["clueId"].(string)
		if !ok || clueID == "" {
			return nil, fmt.Errorf("config_json: modules.location.config.discoveries[%d].clueId is required", i)
		}
		ref := locationDiscoveryRef{index: i, locationID: locationID, clueID: clueID}
		if requiredRaw, exists := discovery["requiredClueIds"]; exists {
			if requiredRaw == nil {
				return nil, fmt.Errorf("config_json: modules.location.config.discoveries[%d].requiredClueIds cannot be null", i)
			}
			required, ok := requiredRaw.([]any)
			if !ok {
				return nil, fmt.Errorf("config_json: modules.location.config.discoveries[%d].requiredClueIds must be an array", i)
			}
			ref.requiredClueIDs = make([]string, 0, len(required))
			for j, rawRequired := range required {
				requiredID, ok := rawRequired.(string)
				if !ok || requiredID == "" {
					return nil, fmt.Errorf("config_json: modules.location.config.discoveries[%d].requiredClueIds[%d] must be a string", i, j)
				}
				ref.requiredClueIDs = append(ref.requiredClueIDs, requiredID)
			}
		}
		if oncePerPlayer, exists := discovery["oncePerPlayer"]; exists {
			if oncePerPlayer == nil {
				return nil, fmt.Errorf("config_json: modules.location.config.discoveries[%d].oncePerPlayer cannot be null", i)
			}
			if _, ok := oncePerPlayer.(bool); !ok {
				return nil, fmt.Errorf("config_json: modules.location.config.discoveries[%d].oncePerPlayer must be boolean", i)
			}
		}
		refs = append(refs, ref)
	}
	return refs, nil
}

var errConfigVersionConflict = errors.New("editor config version conflict")

func (s *service) validateLocationDiscoveryReferences(ctx context.Context, q *db.Queries, themeID uuid.UUID, raw json.RawMessage) error {
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return fmt.Errorf("config_json: invalid JSON: %w", err)
	}
	refs, err := extractLocationDiscoveryRefs(cfg)
	if err != nil {
		return err
	}
	if len(refs) == 0 {
		return nil
	}

	locations, err := q.ListLocationsByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to validate location discoveries locations")
		return apperror.Internal("failed to validate location discoveries")
	}
	locationIDs := make(map[string]struct{}, len(locations))
	for _, loc := range locations {
		locationIDs[loc.ID.String()] = struct{}{}
	}

	clues, err := q.ListCluesByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to validate location discoveries clues")
		return apperror.Internal("failed to validate location discoveries")
	}
	clueIDs := make(map[string]struct{}, len(clues))
	for _, clue := range clues {
		clueIDs[clue.ID.String()] = struct{}{}
	}

	for _, ref := range refs {
		parsedLocationID, err := uuid.Parse(ref.locationID)
		if err != nil {
			return apperror.BadRequest(fmt.Sprintf("config_json: modules.location.config.discoveries[%d].locationId must be a valid location id", ref.index))
		}
		if _, ok := locationIDs[parsedLocationID.String()]; !ok {
			return apperror.BadRequest(fmt.Sprintf("config_json: modules.location.config.discoveries[%d].locationId must belong to this theme", ref.index))
		}
		parsedClueID, err := uuid.Parse(ref.clueID)
		if err != nil {
			return apperror.BadRequest(fmt.Sprintf("config_json: modules.location.config.discoveries[%d].clueId must be a valid clue id", ref.index))
		}
		if _, ok := clueIDs[parsedClueID.String()]; !ok {
			return apperror.BadRequest(fmt.Sprintf("config_json: modules.location.config.discoveries[%d].clueId must belong to this theme", ref.index))
		}
		for j, requiredClueID := range ref.requiredClueIDs {
			parsedRequiredClueID, err := uuid.Parse(requiredClueID)
			if err != nil {
				return apperror.BadRequest(fmt.Sprintf("config_json: modules.location.config.discoveries[%d].requiredClueIds[%d] must be a valid clue id", ref.index, j))
			}
			if _, ok := clueIDs[parsedRequiredClueID.String()]; !ok {
				return apperror.BadRequest(fmt.Sprintf("config_json: modules.location.config.discoveries[%d].requiredClueIds[%d] must belong to this theme", ref.index, j))
			}
		}
	}
	return nil
}

func extractEndingBranchRefs(cfg map[string]any) ([]endingBranchRef, error) {
	modules, ok := cfg["modules"].(map[string]any)
	if !ok {
		return nil, nil
	}
	rawModule, exists := modules["ending_branch"]
	if !exists {
		return nil, nil
	}
	module, ok := rawModule.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("config_json: modules.ending_branch must be an object")
	}
	moduleConfigRaw, exists := module["config"]
	if !exists {
		return nil, nil
	}
	if moduleConfigRaw == nil {
		return nil, fmt.Errorf("config_json: modules.ending_branch.config cannot be null")
	}
	moduleConfig, ok := moduleConfigRaw.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("config_json: modules.ending_branch.config must be an object")
	}

	refs := make([]endingBranchRef, 0)
	if defaultEnding, exists := moduleConfig["defaultEnding"]; exists {
		if defaultEnding == nil {
			return nil, fmt.Errorf("config_json: modules.ending_branch.config.defaultEnding cannot be null")
		}
		value, ok := defaultEnding.(string)
		if !ok {
			return nil, fmt.Errorf("config_json: modules.ending_branch.config.defaultEnding must be a string")
		}
		if strings.TrimSpace(value) != "" {
			refs = append(refs, endingBranchRef{field: "defaultEnding", index: -1, id: value})
		}
	}

	rawMatrix, exists := moduleConfig["matrix"]
	if !exists {
		return refs, nil
	}
	if rawMatrix == nil {
		return nil, fmt.Errorf("config_json: modules.ending_branch.config.matrix cannot be null")
	}
	matrix, ok := rawMatrix.([]any)
	if !ok {
		return nil, fmt.Errorf("config_json: modules.ending_branch.config.matrix must be an array")
	}
	for i, rawRow := range matrix {
		row, ok := rawRow.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("config_json: modules.ending_branch.config.matrix[%d] must be an object", i)
		}
		rawEnding, exists := row["ending"]
		if !exists {
			continue
		}
		if rawEnding == nil {
			return nil, fmt.Errorf("config_json: modules.ending_branch.config.matrix[%d].ending cannot be null", i)
		}
		endingID, ok := rawEnding.(string)
		if !ok {
			return nil, fmt.Errorf("config_json: modules.ending_branch.config.matrix[%d].ending must be a string", i)
		}
		if strings.TrimSpace(endingID) != "" {
			refs = append(refs, endingBranchRef{field: "matrix", index: i, id: endingID})
		}
	}
	return refs, nil
}

func (s *service) validateEndingBranchReferences(ctx context.Context, tx pgx.Tx, themeID uuid.UUID, raw json.RawMessage) error {
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return apperror.BadRequest(fmt.Sprintf("config_json: invalid JSON: %v", err))
	}
	refs, err := extractEndingBranchRefs(cfg)
	if err != nil {
		return apperror.BadRequest(err.Error())
	}
	if len(refs) == 0 {
		return nil
	}

	rows, err := tx.Query(ctx, `SELECT id FROM flow_nodes WHERE theme_id = $1 AND type = $2`, themeID, "ending")
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to validate ending_branch ending nodes")
		return apperror.Internal("failed to validate ending_branch references")
	}
	defer rows.Close()

	endingIDs := make(map[string]struct{})
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return apperror.Internal("failed to validate ending_branch references")
		}
		endingIDs[id.String()] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return apperror.Internal("failed to validate ending_branch references")
	}

	for _, ref := range refs {
		parsedID, err := uuid.Parse(ref.id)
		if err != nil {
			return apperror.BadRequest(endingBranchRefError(ref, "must be a valid ending flow node id"))
		}
		if _, ok := endingIDs[parsedID.String()]; !ok {
			return apperror.BadRequest(endingBranchRefError(ref, "must belong to this theme as an ending flow node"))
		}
	}
	return nil
}

func endingBranchRefError(ref endingBranchRef, suffix string) string {
	if ref.field == "defaultEnding" {
		return "config_json: modules.ending_branch.config.defaultEnding " + suffix
	}
	return fmt.Sprintf("config_json: modules.ending_branch.config.matrix[%d].ending %s", ref.index, suffix)
}

func validateClueInteractionConfigShape(cfg map[string]any) error {
	modules, ok := cfg["modules"].(map[string]any)
	if !ok {
		return nil
	}
	rawModule, exists := modules["clue_interaction"]
	if !exists {
		return nil
	}
	module, ok := rawModule.(map[string]any)
	if !ok {
		return fmt.Errorf("config_json: modules.clue_interaction must be an object")
	}
	moduleConfigRaw, exists := module["config"]
	if !exists {
		return nil
	}
	if moduleConfigRaw == nil {
		return fmt.Errorf("config_json: modules.clue_interaction.config cannot be null")
	}
	moduleConfig, ok := moduleConfigRaw.(map[string]any)
	if !ok {
		return fmt.Errorf("config_json: modules.clue_interaction.config must be an object")
	}
	rawEffects, exists := moduleConfig["itemEffects"]
	if !exists {
		return nil
	}
	if rawEffects == nil {
		return fmt.Errorf("config_json: modules.clue_interaction.config.itemEffects cannot be null")
	}
	itemEffects, ok := rawEffects.(map[string]any)
	if !ok {
		return fmt.Errorf("config_json: modules.clue_interaction.config.itemEffects must be an object")
	}
	for clueID, rawEffect := range itemEffects {
		if _, err := uuid.Parse(clueID); err != nil {
			return fmt.Errorf("config_json: clue_interaction.itemEffects invalid clue id %q", clueID)
		}
		effect, ok := rawEffect.(map[string]any)
		if !ok {
			return fmt.Errorf("config_json: clue_interaction.itemEffects[%s] must be an object", clueID)
		}
		if err := validateClueItemEffectShape(clueID, effect); err != nil {
			return err
		}
	}
	return nil
}

func validateClueItemEffectShape(clueID string, effect map[string]any) error {
	for key := range effect {
		if key != "effect" && key != "target" && key != "consume" && key != "revealText" && key != "grantClueIds" {
			return fmt.Errorf("config_json: clue_interaction.itemEffects[%s].%s is not supported", clueID, key)
		}
	}
	kind, ok := effect["effect"].(string)
	if !ok || kind == "" {
		return fmt.Errorf("config_json: clue_interaction.itemEffects[%s].effect is required", clueID)
	}
	if kind != "peek" && kind != "reveal" && kind != "grant_clue" {
		return fmt.Errorf("config_json: clue_interaction.itemEffects[%s].effect %q is not supported", clueID, kind)
	}
	if target, exists := effect["target"]; exists {
		if target == nil {
			return fmt.Errorf("config_json: clue_interaction.itemEffects[%s].target cannot be null", clueID)
		}
		if target != "self" && target != "player" {
			return fmt.Errorf("config_json: clue_interaction.itemEffects[%s].target must be self or player", clueID)
		}
	}
	if consume, exists := effect["consume"]; exists {
		if consume == nil {
			return fmt.Errorf("config_json: clue_interaction.itemEffects[%s].consume cannot be null", clueID)
		}
		if _, ok := consume.(bool); !ok {
			return fmt.Errorf("config_json: clue_interaction.itemEffects[%s].consume must be boolean", clueID)
		}
	}
	if kind == "reveal" {
		text, ok := effect["revealText"].(string)
		if !ok || strings.TrimSpace(text) == "" {
			return fmt.Errorf("config_json: clue_interaction.itemEffects[%s].revealText is required for reveal", clueID)
		}
	}
	if kind == "grant_clue" {
		ids, ok := effect["grantClueIds"].([]any)
		if !ok || len(ids) == 0 {
			return fmt.Errorf("config_json: clue_interaction.itemEffects[%s].grantClueIds is required for grant_clue", clueID)
		}
		for _, id := range ids {
			grantClueID, ok := id.(string)
			if !ok {
				return fmt.Errorf("config_json: clue_interaction.itemEffects[%s].grantClueIds must contain strings", clueID)
			}
			if _, err := uuid.Parse(grantClueID); err != nil {
				return fmt.Errorf("config_json: clue_interaction.itemEffects[%s].grantClueIds has invalid clue id %q", clueID, grantClueID)
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

	var updated db.Theme
	err = pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `SELECT 1 FROM themes WHERE id = $1 FOR UPDATE`, themeID).Scan(new(int)); err != nil {
			return err
		}

		qtx := s.q.WithTx(tx)
		if err := s.validateLocationDiscoveryReferences(ctx, qtx, themeID, config); err != nil {
			return err
		}
		if err := s.validateEndingBranchReferences(ctx, tx, themeID, config); err != nil {
			return err
		}

		var updateErr error
		updated, updateErr = qtx.UpdateThemeConfigJson(ctx, db.UpdateThemeConfigJsonParams{
			ID:         themeID,
			ConfigJson: config,
			Version:    theme.Version,
		})
		if errors.Is(updateErr, pgx.ErrNoRows) {
			return errConfigVersionConflict
		}
		return updateErr
	})
	if err != nil {
		if errors.Is(err, errConfigVersionConflict) {
			return nil, s.buildConfigVersionConflict(ctx, themeID, theme.Version)
		}
		var appErr *apperror.AppError
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("theme not found")
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
