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
	"github.com/mmp-platform/server/internal/infra/storage"
)

const publishedStatus = "PUBLISHED"
const (
	mediaTypeImage = "IMAGE"
	sourceTypeFile = "FILE"
	mediaURLTTL    = 15 * time.Minute
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
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Description  *string   `json:"description,omitempty"`
	ImageURL     *string   `json:"image_url,omitempty"`
	ImageMediaID *string   `json:"image_media_id,omitempty"`
	SortOrder    int32     `json:"sort_order"`
}

// Service defines theme domain operations.
type Service interface {
	GetTheme(ctx context.Context, themeID uuid.UUID) (*ThemeResponse, error)
	GetThemeBySlug(ctx context.Context, slug string) (*ThemeResponse, error)
	ListPublished(ctx context.Context, limit, offset int32) ([]ThemeSummary, error)
	GetCharacters(ctx context.Context, themeID uuid.UUID) ([]CharacterResponse, error)
}

type themeQueries interface {
	GetPublishedTheme(ctx context.Context, id uuid.UUID) (db.GetPublishedThemeRow, error)
	GetPublishedThemeBySlug(ctx context.Context, slug string) (db.GetPublishedThemeBySlugRow, error)
	ListPublishedThemes(ctx context.Context, arg db.ListPublishedThemesParams) ([]db.ListPublishedThemesRow, error)
	GetPublishedThemeCharacters(ctx context.Context, themeID uuid.UUID) ([]db.GetPublishedThemeCharactersRow, error)
	GetMedia(ctx context.Context, id uuid.UUID) (db.ThemeMedium, error)
}

type service struct {
	queries themeQueries
	storage storage.Provider
	logger  zerolog.Logger
}

// NewService creates a new theme service.
func NewService(queries *db.Queries, logger zerolog.Logger) Service {
	return NewServiceWithStorage(queries, nil, logger)
}

// NewServiceWithStorage creates a theme service that can resolve public file media URLs.
func NewServiceWithStorage(queries *db.Queries, storageProvider storage.Provider, logger zerolog.Logger) Service {
	return &service{
		queries: queries,
		storage: storageProvider,
		logger:  logger.With().Str("domain", "theme").Logger(),
	}
}

func (s *service) GetTheme(ctx context.Context, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.queries.GetPublishedTheme(ctx, themeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("theme not found")
		}
		s.logger.Error().Err(err).Stringer("theme_id", themeID).Msg("failed to get theme")
		return nil, apperror.Internal("failed to get theme")
	}
	return toThemeResponseFromPublishedTheme(theme), nil
}

func (s *service) GetThemeBySlug(ctx context.Context, slug string) (*ThemeResponse, error) {
	theme, err := s.queries.GetPublishedThemeBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("theme not found")
		}
		s.logger.Error().Err(err).Str("slug", slug).Msg("failed to get theme by slug")
		return nil, apperror.Internal("failed to get theme")
	}
	return toThemeResponseFromPublishedThemeBySlug(theme), nil
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
		result[i] = toThemeSummaryFromListRow(t)
	}
	return result, nil
}

func (s *service) GetCharacters(ctx context.Context, themeID uuid.UUID) ([]CharacterResponse, error) {
	if _, err := s.queries.GetPublishedTheme(ctx, themeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("theme not found")
		}
		s.logger.Error().Err(err).Stringer("theme_id", themeID).Msg("failed to get theme")
		return nil, apperror.Internal("failed to get characters")
	}

	chars, err := s.queries.GetPublishedThemeCharacters(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("theme_id", themeID).Msg("failed to get theme characters")
		return nil, apperror.Internal("failed to get characters")
	}

	result := make([]CharacterResponse, 0, len(chars))
	for _, c := range chars {
		imageURL := s.resolveCharacterImageURL(ctx, c.ThemeID, textToPtr(c.ImageUrl), c.ImageMediaID)
		result = append(result, CharacterResponse{
			ID:           c.ID,
			Name:         c.Name,
			Description:  textToPtr(c.Description),
			ImageURL:     imageURL,
			ImageMediaID: pgUUIDToStringPtr(c.ImageMediaID),
			SortOrder:    c.SortOrder,
		})
	}
	return result, nil
}

func (s *service) resolveCharacterImageURL(ctx context.Context, themeID uuid.UUID, currentURL *string, mediaID pgtype.UUID) *string {
	if currentURL != nil || !mediaID.Valid || s.storage == nil {
		return currentURL
	}
	id := uuid.UUID(mediaID.Bytes)
	media, err := s.queries.GetMedia(ctx, id)
	if err != nil {
		s.logger.Warn().Err(err).Stringer("media_id", id).Msg("failed to resolve character image media")
		return currentURL
	}
	if media.ThemeID != themeID {
		s.logger.Warn().
			Stringer("media_id", id).
			Stringer("media_theme_id", media.ThemeID).
			Stringer("character_theme_id", themeID).
			Msg("character image media belongs to another theme")
		return currentURL
	}
	if media.Type != mediaTypeImage || media.SourceType != sourceTypeFile || !media.StorageKey.Valid {
		return currentURL
	}
	if _, err := s.storage.HeadObject(ctx, media.StorageKey.String); err != nil {
		if errors.Is(err, storage.ErrObjectNotFound) {
			s.logger.Warn().Stringer("media_id", id).Str("storage_key", media.StorageKey.String).Msg("character image media object not found")
			return currentURL
		}
		s.logger.Warn().Err(err).Stringer("media_id", id).Str("storage_key", media.StorageKey.String).Msg("failed to verify character image media")
		return currentURL
	}
	url, err := s.storage.GenerateDownloadURL(ctx, media.StorageKey.String, mediaURLTTL)
	if err != nil {
		s.logger.Warn().Err(err).Stringer("media_id", id).Str("storage_key", media.StorageKey.String).Msg("failed to generate character image URL")
		return currentURL
	}
	if url == "" {
		return currentURL
	}
	return &url
}

func pgUUIDToStringPtr(value pgtype.UUID) *string {
	if !value.Valid {
		return nil
	}
	id := uuid.UUID(value.Bytes).String()
	return &id
}

func toThemeSummaryFromListRow(t db.ListPublishedThemesRow) ThemeSummary {
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

func toThemeResponseFromPublishedTheme(t db.GetPublishedThemeRow) *ThemeResponse {
	return &ThemeResponse{
		ThemeSummary: ThemeSummary{
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
		},
		Status:      t.Status,
		Version:     t.Version,
		PublishedAt: timestampToPtr(t.PublishedAt),
		CreatedAt:   t.CreatedAt,
	}
}

func toThemeResponseFromPublishedThemeBySlug(t db.GetPublishedThemeBySlugRow) *ThemeResponse {
	return &ThemeResponse{
		ThemeSummary: ThemeSummary{
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
		},
		Status:      t.Status,
		Version:     t.Version,
		PublishedAt: timestampToPtr(t.PublishedAt),
		CreatedAt:   t.CreatedAt,
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
