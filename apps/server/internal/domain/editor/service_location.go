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
)

// --- Maps ---

func (s *service) ListMaps(ctx context.Context, creatorID, themeID uuid.UUID) ([]MapResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	maps, err := s.q.ListMapsByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list maps")
		return nil, apperror.Internal("failed to list maps")
	}
	out := make([]MapResponse, len(maps))
	for i, m := range maps {
		out[i] = toMapResponse(m)
	}
	return out, nil
}

func (s *service) CreateMap(ctx context.Context, creatorID, themeID uuid.UUID, req CreateMapRequest) (*MapResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	count, err := s.q.CountMapsByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count maps")
		return nil, apperror.Internal("failed to count maps")
	}
	if count >= MaxMapsPerTheme {
		return nil, apperror.BadRequest(fmt.Sprintf("theme cannot have more than %d maps", MaxMapsPerTheme))
	}
	m, err := s.q.CreateMap(ctx, db.CreateMapParams{
		ThemeID:   themeID,
		Name:      req.Name,
		ImageUrl:  ptrToText(req.ImageURL),
		SortOrder: req.SortOrder,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create map")
		return nil, apperror.Internal("failed to create map")
	}
	resp := toMapResponse(m)
	return &resp, nil
}

func (s *service) UpdateMap(ctx context.Context, creatorID, mapID uuid.UUID, req UpdateMapRequest) (*MapResponse, error) {
	m, err := s.q.GetMapWithOwner(ctx, db.GetMapWithOwnerParams{ID: mapID, CreatorID: creatorID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("map not found")
		}
		s.logger.Error().Err(err).Msg("failed to get map")
		return nil, apperror.Internal("failed to get map")
	}
	updated, err := s.q.UpdateMap(ctx, db.UpdateMapParams{
		ID:        m.ID,
		Name:      req.Name,
		ImageUrl:  ptrToText(req.ImageURL),
		SortOrder: req.SortOrder,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to update map")
		return nil, apperror.Internal("failed to update map")
	}
	resp := toMapResponse(updated)
	return &resp, nil
}

func (s *service) DeleteMap(ctx context.Context, creatorID, mapID uuid.UUID) error {
	n, err := s.q.DeleteMapWithOwner(ctx, db.DeleteMapWithOwnerParams{ID: mapID, CreatorID: creatorID})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to delete map")
		return apperror.Internal("failed to delete map")
	}
	if n == 0 {
		return apperror.NotFound("map not found")
	}
	return nil
}

// --- Locations ---

func (s *service) ListLocations(ctx context.Context, creatorID, themeID uuid.UUID) ([]LocationResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	locs, err := s.q.ListLocationsByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list locations")
		return nil, apperror.Internal("failed to list locations")
	}
	out := make([]LocationResponse, len(locs))
	for i, l := range locs {
		out[i] = toLocationResponse(l)
	}
	return out, nil
}

func (s *service) CreateLocation(ctx context.Context, creatorID, themeID, mapID uuid.UUID, req CreateLocationRequest) (*LocationResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	accessPolicy, err := s.buildLocationAccessPolicyForTheme(ctx, themeID, req.RestrictedCharacters, req.FromRound, req.UntilRound)
	if err != nil {
		return nil, err
	}
	// verify map belongs to the theme via ownership check
	_, err = s.q.GetMapWithOwner(ctx, db.GetMapWithOwnerParams{ID: mapID, CreatorID: creatorID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("map not found")
		}
		s.logger.Error().Err(err).Msg("failed to get map")
		return nil, apperror.Internal("failed to get map")
	}
	count, err := s.q.CountLocationsByMap(ctx, mapID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count locations")
		return nil, apperror.Internal("failed to count locations")
	}
	if count >= MaxLocationsPerMap {
		return nil, apperror.BadRequest(fmt.Sprintf("map cannot have more than %d locations", MaxLocationsPerMap))
	}
	loc, err := s.q.CreateLocation(ctx, db.CreateLocationParams{
		ThemeID:              themeID,
		MapID:                mapID,
		Name:                 req.Name,
		RestrictedCharacters: ptrToText(accessPolicy.RestrictedCharacters),
		SortOrder:            req.SortOrder,
		FromRound:            int32PtrToPgtype(accessPolicy.FromRound),
		UntilRound:           int32PtrToPgtype(accessPolicy.UntilRound),
		ImageUrl:             ptrToText(req.ImageURL),
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create location")
		return nil, apperror.Internal("failed to create location")
	}
	resp := toLocationResponse(loc)
	return &resp, nil
}

func (s *service) UpdateLocation(ctx context.Context, creatorID, locID uuid.UUID, req UpdateLocationRequest) (*LocationResponse, error) {
	l, err := s.q.GetLocationWithOwner(ctx, db.GetLocationWithOwnerParams{ID: locID, CreatorID: creatorID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("location not found")
		}
		s.logger.Error().Err(err).Msg("failed to get location")
		return nil, apperror.Internal("failed to get location")
	}
	accessPolicy, err := s.buildLocationAccessPolicyForTheme(ctx, l.ThemeID, req.RestrictedCharacters, req.FromRound, req.UntilRound)
	if err != nil {
		return nil, err
	}
	imageURL := l.ImageUrl
	if req.ImageURL != nil {
		imageURL = ptrToText(req.ImageURL)
	}
	updated, err := s.q.UpdateLocation(ctx, db.UpdateLocationParams{
		ID:                   l.ID,
		Name:                 req.Name,
		RestrictedCharacters: ptrToText(accessPolicy.RestrictedCharacters),
		SortOrder:            req.SortOrder,
		FromRound:            int32PtrToPgtype(accessPolicy.FromRound),
		UntilRound:           int32PtrToPgtype(accessPolicy.UntilRound),
		ImageUrl:             imageURL,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to update location")
		return nil, apperror.Internal("failed to update location")
	}
	resp := toLocationResponse(updated)
	return &resp, nil
}

func (s *service) buildLocationAccessPolicyForTheme(ctx context.Context, themeID uuid.UUID, restrictedCharacters *string, fromRound, untilRound *int32) (LocationAccessPolicy, error) {
	accessPolicy, err := BuildLocationAccessPolicy(restrictedCharacters, fromRound, untilRound)
	if err != nil {
		return LocationAccessPolicy{}, err
	}
	if len(accessPolicy.RestrictedCharacterIDs) == 0 {
		return accessPolicy, nil
	}

	chars, err := s.q.GetThemeCharacters(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to validate location restricted characters")
		return LocationAccessPolicy{}, apperror.Internal("failed to validate location access policy")
	}
	allowed := make(map[string]struct{}, len(chars))
	for _, char := range chars {
		allowed[char.ID.String()] = struct{}{}
	}
	for _, rawID := range accessPolicy.RestrictedCharacterIDs {
		parsedID, err := uuid.Parse(rawID)
		if err != nil {
			return LocationAccessPolicy{}, apperror.BadRequest("restricted character must be a valid theme character")
		}
		if _, ok := allowed[parsedID.String()]; !ok {
			return LocationAccessPolicy{}, apperror.BadRequest("restricted character must belong to this theme")
		}
	}
	return accessPolicy, nil
}

// validateLocationRoundOrder enforces from_round <= until_round when both set.
func validateLocationRoundOrder(from, until *int32) error {
	if from != nil && until != nil && *from > *until {
		return apperror.BadRequest("from_round must not be greater than until_round")
	}
	return nil
}

func (s *service) DeleteLocation(ctx context.Context, creatorID, locID uuid.UUID) error {
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		var themeID uuid.UUID
		if err := tx.QueryRow(ctx, `
			SELECT l.theme_id
			FROM theme_locations l
			JOIN themes t ON l.theme_id = t.id
			WHERE l.id = $1 AND t.creator_id = $2
		`, locID, creatorID).Scan(&themeID); err != nil {
			return err
		}

		var configJSON json.RawMessage
		if err := tx.QueryRow(ctx, `
			SELECT config_json
			FROM themes
			WHERE id = $1
			FOR UPDATE
		`, themeID).Scan(&configJSON); err != nil {
			return err
		}

		cleanedConfig, changed, err := removeLocationReferencesFromConfigJSON(configJSON, locID)
		if err != nil {
			return err
		}
		if changed {
			if _, err := tx.Exec(ctx, `
				UPDATE themes
				SET config_json = $2, version = version + 1, updated_at = NOW()
				WHERE id = $1
			`, themeID, cleanedConfig); err != nil {
				return err
			}
		}

		qtx := s.q.WithTx(tx)
		n, err := qtx.DeleteLocationWithOwner(ctx, db.DeleteLocationWithOwnerParams{ID: locID, CreatorID: creatorID})
		if err != nil {
			return err
		}
		if n == 0 {
			return apperror.NotFound("location not found")
		}
		return nil
	})
	if err != nil {
		var appErr *apperror.AppError
		if errors.As(err, &appErr) {
			return appErr
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.NotFound("location not found")
		}
		s.logger.Error().Err(err).Msg("failed to delete location")
		return apperror.Internal("failed to delete location")
	}
	return nil
}

// --- Response mappers ---

func toMapResponse(m db.ThemeMap) MapResponse {
	return MapResponse{
		ID:        m.ID,
		ThemeID:   m.ThemeID,
		Name:      m.Name,
		ImageURL:  textToPtr(m.ImageUrl),
		SortOrder: m.SortOrder,
		CreatedAt: m.CreatedAt,
	}
}

func toLocationResponse(l db.ThemeLocation) LocationResponse {
	return LocationResponse{
		ID:                   l.ID,
		ThemeID:              l.ThemeID,
		MapID:                l.MapID,
		Name:                 l.Name,
		RestrictedCharacters: textToPtr(l.RestrictedCharacters),
		ImageURL:             textToPtr(l.ImageUrl),
		SortOrder:            l.SortOrder,
		CreatedAt:            l.CreatedAt,
		FromRound:            pgtypeInt4ToPtr(l.FromRound),
		UntilRound:           pgtypeInt4ToPtr(l.UntilRound),
	}
}
