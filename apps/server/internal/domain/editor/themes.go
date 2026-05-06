package editor

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// --- Theme CRUD ---

// CreateTheme persists a new theme owned by creatorID. Up to 3 slug retries
// are attempted in case of unique violations (slug collisions).
func (s *service) CreateTheme(ctx context.Context, creatorID uuid.UUID, req CreateThemeRequest) (*ThemeResponse, error) {
	var theme db.Theme
	var err error

	for attempt := 0; attempt < 3; attempt++ {
		slug := generateSlug(req.Title)
		theme, err = s.q.CreateTheme(ctx, db.CreateThemeParams{
			CreatorID:   creatorID,
			Title:       req.Title,
			Slug:        slug,
			Description: ptrToText(req.Description),
			CoverImage:  ptrToText(req.CoverImage),
			MinPlayers:  req.MinPlayers,
			MaxPlayers:  req.MaxPlayers,
			DurationMin: req.DurationMin,
			Price:       req.Price,
			CoinPrice:   req.CoinPrice,
			ConfigJson:  json.RawMessage("{}"),
		})
		if err == nil {
			return toThemeResponse(theme), nil
		}
		if isUniqueViolation(err) {
			continue
		}
		break
	}
	s.logger.Error().Err(err).Msg("failed to create theme")
	return nil, apperror.Internal("failed to create theme")
}

// UpdateTheme applies a full update to an owned theme. Same slug retry policy
// as CreateTheme; a stale-version mismatch surfaces as a Conflict error.
func (s *service) UpdateTheme(ctx context.Context, creatorID, themeID uuid.UUID, req UpdateThemeRequest) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}
	coverImage := theme.CoverImage
	if req.CoverImage != nil {
		coverImage = ptrToText(req.CoverImage)
	}
	coverImageMediaID := theme.CoverImageMediaID
	if req.CoverImageMediaID.Set {
		if req.CoverImageMediaID.Value == nil {
			coverImageMediaID = pgtype.UUID{}
		} else {
			coverImageMediaID, err = s.resolveThemeImageMedia(ctx, theme.ID, req.CoverImageMediaID.Value, "theme cover image")
			coverImage = pgtype.Text{}
		}
		if err != nil {
			return nil, err
		}
	}

	var updated db.Theme
	for attempt := 0; attempt < 3; attempt++ {
		slug := generateSlug(req.Title)
		updated, err = s.q.UpdateTheme(ctx, db.UpdateThemeParams{
			ID:                theme.ID,
			Title:             req.Title,
			Slug:              slug,
			Description:       ptrToText(req.Description),
			CoverImage:        coverImage,
			CoverImageMediaID: coverImageMediaID,
			MinPlayers:        req.MinPlayers,
			MaxPlayers:        req.MaxPlayers,
			DurationMin:       req.DurationMin,
			Price:             req.Price,
			CoinPrice:         req.CoinPrice,
			Version:           theme.Version,
		})
		if err == nil {
			return toThemeResponse(updated), nil
		}
		if isUniqueViolation(err) {
			continue
		}
		break
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperror.Conflict("theme was modified by another session")
	}
	s.logger.Error().Err(err).Msg("failed to update theme")
	return nil, apperror.Internal("failed to update theme")
}

// DeleteTheme removes a draft theme. Published themes must be unpublished first.
func (s *service) DeleteTheme(ctx context.Context, creatorID, themeID uuid.UUID) error {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return err
	}
	if theme.Status != "DRAFT" {
		return apperror.BadRequest("only draft themes can be deleted")
	}
	if err := s.q.DeleteTheme(ctx, theme.ID); err != nil {
		s.logger.Error().Err(err).Msg("failed to delete theme")
		return apperror.Internal("failed to delete theme")
	}
	return nil
}

// ListMyThemes returns summary rows for all themes owned by creatorID.
func (s *service) ListMyThemes(ctx context.Context, creatorID uuid.UUID) ([]ThemeSummary, error) {
	themes, err := s.q.ListThemesByCreator(ctx, creatorID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list themes")
		return nil, apperror.Internal("failed to list themes")
	}
	out := make([]ThemeSummary, len(themes))
	for i, t := range themes {
		out[i] = ThemeSummary{
			ID:         t.ID,
			Title:      t.Title,
			Status:     t.Status,
			MinPlayers: t.MinPlayers,
			MaxPlayers: t.MaxPlayers,
			CoinPrice:  t.CoinPrice,
			Version:    t.Version,
			CreatedAt:  t.CreatedAt,
		}
	}
	return out, nil
}

// GetTheme fetches a single theme by id, enforcing creator ownership.
// The config_json is lazily normalized on read (D-20) so legacy-shaped configs
// stored in the database are transparently upgraded for API consumers.
func (s *service) GetTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}
	legacyAxes := legacyConfigAxes(theme.ConfigJson)
	normalized, err := NormalizeConfigJSON(theme.ConfigJson)
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to normalize config_json")
		return nil, apperror.Internal("failed to normalize config_json")
	}
	s.logLegacyConfigRead(themeID, legacyAxes)
	theme.ConfigJson = normalized
	return toThemeResponse(theme), nil
}

func (s *service) logLegacyConfigRead(themeID uuid.UUID, legacyAxes []string) {
	if len(legacyAxes) == 0 {
		return
	}
	s.logger.Info().
		Str("theme_id", themeID.String()).
		Strs("legacy_axes", legacyAxes).
		Msg("editor config_json legacy shape normalized on read")
}
