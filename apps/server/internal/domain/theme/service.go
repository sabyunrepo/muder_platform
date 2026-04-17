package theme

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// ThemeSummary is the compact representation used in list endpoints.
type ThemeSummary struct {
	ID          uuid.UUID `json:"id"`
	Title       string    `json:"title"`
	Slug        string    `json:"slug"`
	Description *string   `json:"description,omitempty"`
	CoverImage  *string   `json:"cover_image,omitempty"`
	MinPlayers  int32     `json:"min_players"`
	MaxPlayers  int32     `json:"max_players"`
	DurationMin int32     `json:"duration_min"`
	Price       int32     `json:"price"`
	CoinPrice   int32     `json:"coin_price"`
	CreatorID   uuid.UUID `json:"creator_id"`
}

// ThemeResponse is the full theme detail including config and metadata.
type ThemeResponse struct {
	ThemeSummary
	Status      string          `json:"status"`
	ConfigJson  json.RawMessage `json:"config_json,omitempty"`
	Version     int32           `json:"version"`
	PublishedAt *time.Time      `json:"published_at,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
}

// CharacterResponse is the public character representation.
// IsCulprit is intentionally excluded to prevent spoilers.
type CharacterResponse struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	ImageURL    *string   `json:"image_url,omitempty"`
	SortOrder   int32     `json:"sort_order"`
}

// Service defines theme domain operations.
type Service interface {
	GetTheme(ctx context.Context, themeID uuid.UUID) (*ThemeResponse, error)
	GetThemeBySlug(ctx context.Context, slug string) (*ThemeResponse, error)
	ListPublished(ctx context.Context, limit, offset int32) ([]ThemeSummary, error)
	GetCharacters(ctx context.Context, themeID uuid.UUID) ([]CharacterResponse, error)
}

type service struct {
	queries *db.Queries
	logger  zerolog.Logger
}

// NewService creates a new theme service.
func NewService(queries *db.Queries, logger zerolog.Logger) Service {
	return &service{
		queries: queries,
		logger:  logger.With().Str("domain", "theme").Logger(),
	}
}

func (s *service) GetTheme(ctx context.Context, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.queries.GetTheme(ctx, themeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("theme not found")
		}
		s.logger.Error().Err(err).Stringer("theme_id", themeID).Msg("failed to get theme")
		return nil, apperror.Internal("failed to get theme")
	}
	return toThemeResponse(theme), nil
}

func (s *service) GetThemeBySlug(ctx context.Context, slug string) (*ThemeResponse, error) {
	theme, err := s.queries.GetThemeBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("theme not found")
		}
		s.logger.Error().Err(err).Str("slug", slug).Msg("failed to get theme by slug")
		return nil, apperror.Internal("failed to get theme")
	}
	return toThemeResponse(theme), nil
}

func (s *service) ListPublished(ctx context.Context, limit, offset int32) ([]ThemeSummary, error) {
	themes, err := s.queries.ListPublishedThemes(ctx, db.ListPublishedThemesParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list published themes")
		return nil, apperror.Internal("failed to list themes")
	}

	result := make([]ThemeSummary, len(themes))
	for i, t := range themes {
		result[i] = toThemeSummary(t)
	}
	return result, nil
}

func (s *service) GetCharacters(ctx context.Context, themeID uuid.UUID) ([]CharacterResponse, error) {
	chars, err := s.queries.GetThemeCharacters(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("theme_id", themeID).Msg("failed to get theme characters")
		return nil, apperror.Internal("failed to get characters")
	}

	result := make([]CharacterResponse, len(chars))
	for i, c := range chars {
		result[i] = CharacterResponse{
			ID:          c.ID,
			Name:        c.Name,
			Description: textToPtr(c.Description),
			ImageURL:    textToPtr(c.ImageUrl),
			SortOrder:   c.SortOrder,
		}
	}
	return result, nil
}

func toThemeSummary(t db.Theme) ThemeSummary {
	return ThemeSummary{
		ID:          t.ID,
		Title:       t.Title,
		Slug:        t.Slug,
		Description: textToPtr(t.Description),
		CoverImage:  textToPtr(t.CoverImage),
		MinPlayers:  t.MinPlayers,
		MaxPlayers:  t.MaxPlayers,
		DurationMin: t.DurationMin,
		Price:       t.Price,
		CoinPrice:   t.CoinPrice,
		CreatorID:   t.CreatorID,
	}
}

func toThemeResponse(t db.Theme) *ThemeResponse {
	return &ThemeResponse{
		ThemeSummary: toThemeSummary(t),
		Status:       t.Status,
		ConfigJson:   t.ConfigJson,
		Version:      t.Version,
		PublishedAt:  timestampToPtr(t.PublishedAt),
		CreatedAt:    t.CreatedAt,
	}
}

func textToPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

func timestampToPtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}
