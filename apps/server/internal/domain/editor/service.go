package editor

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

const (
	MaxMapsPerTheme    = 20
	MaxLocationsPerMap = 50
	MaxCluesPerTheme   = 500
)

var validContentKeyRe = regexp.MustCompile(`^(story|rules|epilogue|role:[a-z0-9_-]{1,50})$`)

// --- Request / Response types ---

type CreateThemeRequest struct {
	Title       string  `json:"title" validate:"required,min=2,max=100"`
	Description *string `json:"description" validate:"omitempty,max=2000"`
	CoverImage  *string `json:"cover_image" validate:"omitempty,url"`
	MinPlayers  int32   `json:"min_players" validate:"required,min=2,max=20"`
	MaxPlayers  int32   `json:"max_players" validate:"required,min=2,max=20"`
	DurationMin int32   `json:"duration_min" validate:"required,min=10,max=300"`
	Price       int32   `json:"price" validate:"min=0"`
	CoinPrice   int32   `json:"coin_price" validate:"min=0,max=100000"`
}

type UpdateThemeRequest struct {
	Title       string  `json:"title" validate:"required,min=2,max=100"`
	Description *string `json:"description" validate:"omitempty,max=2000"`
	CoverImage  *string `json:"cover_image" validate:"omitempty,url"`
	MinPlayers  int32   `json:"min_players" validate:"required,min=2,max=20"`
	MaxPlayers  int32   `json:"max_players" validate:"required,min=2,max=20"`
	DurationMin int32   `json:"duration_min" validate:"required,min=10,max=300"`
	Price       int32   `json:"price" validate:"min=0"`
	CoinPrice   int32   `json:"coin_price" validate:"min=0,max=100000"`
}

type ThemeResponse struct {
	ID          uuid.UUID       `json:"id"`
	Title       string          `json:"title"`
	Slug        string          `json:"slug"`
	Description *string         `json:"description,omitempty"`
	CoverImage  *string         `json:"cover_image,omitempty"`
	MinPlayers  int32           `json:"min_players"`
	MaxPlayers  int32           `json:"max_players"`
	DurationMin int32           `json:"duration_min"`
	Price       int32           `json:"price"`
	CoinPrice   int32           `json:"coin_price"`
	Status      string          `json:"status"`
	ConfigJson  json.RawMessage `json:"config_json,omitempty"`
	Version     int32           `json:"version"`
	CreatedAt   time.Time       `json:"created_at"`
	ReviewNote  *string         `json:"review_note,omitempty"`
	ReviewedAt  *time.Time      `json:"reviewed_at,omitempty"`
	ReviewedBy  *uuid.UUID      `json:"reviewed_by,omitempty"`
}

type ThemeSummary struct {
	ID         uuid.UUID `json:"id"`
	Title      string    `json:"title"`
	Status     string    `json:"status"`
	MinPlayers int32     `json:"min_players"`
	MaxPlayers int32     `json:"max_players"`
	CoinPrice  int32     `json:"coin_price"`
	Version    int32     `json:"version"`
	CreatedAt  time.Time `json:"created_at"`
}

type CreateCharacterRequest struct {
	Name        string  `json:"name" validate:"required,min=1,max=50"`
	Description *string `json:"description" validate:"omitempty,max=2000"`
	ImageURL    *string `json:"image_url" validate:"omitempty,url"`
	IsCulprit   bool    `json:"is_culprit"`
	SortOrder   int32   `json:"sort_order" validate:"min=0"`
}

type UpdateCharacterRequest struct {
	Name        string  `json:"name" validate:"required,min=1,max=50"`
	Description *string `json:"description" validate:"omitempty,max=2000"`
	ImageURL    *string `json:"image_url" validate:"omitempty,url"`
	IsCulprit   bool    `json:"is_culprit"`
	SortOrder   int32   `json:"sort_order" validate:"min=0"`
}

type CharacterResponse struct {
	ID          uuid.UUID `json:"id"`
	ThemeID     uuid.UUID `json:"theme_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	ImageURL    *string   `json:"image_url,omitempty"`
	IsCulprit   bool      `json:"is_culprit"`
	SortOrder   int32     `json:"sort_order"`
}

// --- Service interface ---

type Service interface {
	CreateTheme(ctx context.Context, creatorID uuid.UUID, req CreateThemeRequest) (*ThemeResponse, error)
	UpdateTheme(ctx context.Context, creatorID, themeID uuid.UUID, req UpdateThemeRequest) (*ThemeResponse, error)
	DeleteTheme(ctx context.Context, creatorID, themeID uuid.UUID) error
	ListMyThemes(ctx context.Context, creatorID uuid.UUID) ([]ThemeSummary, error)
	PublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error)
	UnpublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error)
	SubmitForReview(ctx context.Context, userID, themeID uuid.UUID) (*ThemeResponse, error)
	CreateCharacter(ctx context.Context, creatorID, themeID uuid.UUID, req CreateCharacterRequest) (*CharacterResponse, error)
	UpdateCharacter(ctx context.Context, creatorID, charID uuid.UUID, req UpdateCharacterRequest) (*CharacterResponse, error)
	DeleteCharacter(ctx context.Context, creatorID, charID uuid.UUID) error
	ListCharacters(ctx context.Context, creatorID, themeID uuid.UUID) ([]CharacterResponse, error)
	UpdateConfigJson(ctx context.Context, creatorID, themeID uuid.UUID, config json.RawMessage) (*ThemeResponse, error)

	// Maps
	CreateMap(ctx context.Context, creatorID, themeID uuid.UUID, req CreateMapRequest) (*MapResponse, error)
	UpdateMap(ctx context.Context, creatorID, mapID uuid.UUID, req UpdateMapRequest) (*MapResponse, error)
	DeleteMap(ctx context.Context, creatorID, mapID uuid.UUID) error
	ListMaps(ctx context.Context, creatorID, themeID uuid.UUID) ([]MapResponse, error)

	// Locations
	CreateLocation(ctx context.Context, creatorID, themeID, mapID uuid.UUID, req CreateLocationRequest) (*LocationResponse, error)
	UpdateLocation(ctx context.Context, creatorID, locID uuid.UUID, req UpdateLocationRequest) (*LocationResponse, error)
	DeleteLocation(ctx context.Context, creatorID, locID uuid.UUID) error
	ListLocations(ctx context.Context, creatorID, themeID uuid.UUID) ([]LocationResponse, error)

	// Clues
	CreateClue(ctx context.Context, creatorID, themeID uuid.UUID, req CreateClueRequest) (*ClueResponse, error)
	UpdateClue(ctx context.Context, creatorID, clueID uuid.UUID, req UpdateClueRequest) (*ClueResponse, error)
	DeleteClue(ctx context.Context, creatorID, clueID uuid.UUID) error
	ListClues(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueResponse, error)

	// Contents
	GetContent(ctx context.Context, creatorID, themeID uuid.UUID, key string) (*ContentResponse, error)
	UpsertContent(ctx context.Context, creatorID, themeID uuid.UUID, key string, body string) (*ContentResponse, error)

	// Theme detail
	GetTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error)

	// Validation
	ValidateTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ValidationResponse, error)
}

// --- Implementation ---

type service struct {
	q      *db.Queries
	pool   *pgxpool.Pool
	logger zerolog.Logger
}

// NewService creates a new editor service backed by sqlc queries.
func NewService(q *db.Queries, pool *pgxpool.Pool, logger zerolog.Logger) Service {
	return &service{
		q:      q,
		pool:   pool,
		logger: logger.With().Str("domain", "editor").Logger(),
	}
}

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

func (s *service) UpdateTheme(ctx context.Context, creatorID, themeID uuid.UUID, req UpdateThemeRequest) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}

	var updated db.Theme
	for attempt := 0; attempt < 3; attempt++ {
		slug := generateSlug(req.Title)
		updated, err = s.q.UpdateTheme(ctx, db.UpdateThemeParams{
			ID:          theme.ID,
			Title:       req.Title,
			Slug:        slug,
			Description: ptrToText(req.Description),
			CoverImage:  ptrToText(req.CoverImage),
			MinPlayers:  req.MinPlayers,
			MaxPlayers:  req.MaxPlayers,
			DurationMin: req.DurationMin,
			Price:       req.Price,
			CoinPrice:   req.CoinPrice,
			Version:     theme.Version,
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

func (s *service) GetTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}
	return toThemeResponse(theme), nil
}

// PublishTheme directly publishes a theme (admin-only use).
func (s *service) PublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}
	if theme.Status != "DRAFT" {
		return nil, apperror.BadRequest("only draft themes can be published")
	}

	charCount, err := s.q.CountThemeCharacters(ctx, theme.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count characters")
		return nil, apperror.Internal("failed to count characters")
	}
	if charCount < int64(theme.MinPlayers) {
		return nil, apperror.BadRequest(fmt.Sprintf("theme requires at least %d characters, has %d", theme.MinPlayers, charCount))
	}

	if len(theme.ConfigJson) == 0 || string(theme.ConfigJson) == "{}" || string(theme.ConfigJson) == "null" {
		return nil, apperror.BadRequest("theme config_json must be set before publishing")
	}

	updated, err := s.q.UpdateThemeStatus(ctx, db.UpdateThemeStatusParams{
		ID:     theme.ID,
		Status: "PUBLISHED",
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to publish theme")
		return nil, apperror.Internal("failed to publish theme")
	}
	return toThemeResponse(updated), nil
}

// UnpublishTheme moves a published theme to UNPUBLISHED status.
func (s *service) UnpublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}
	if theme.Status != "PUBLISHED" {
		return nil, apperror.BadRequest("only published themes can be unpublished")
	}

	updated, err := s.q.UnpublishTheme(ctx, theme.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to unpublish theme")
		return nil, apperror.Internal("failed to unpublish theme")
	}
	return toThemeResponse(updated), nil
}

// SubmitForReview submits a theme for admin review.
// Trusted creators are auto-approved and published immediately.
func (s *service) SubmitForReview(ctx context.Context, userID, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, userID, themeID)
	if err != nil {
		return nil, err
	}

	if theme.Status != "DRAFT" && theme.Status != "REJECTED" {
		return nil, apperror.BadRequest("only draft or rejected themes can be submitted for review")
	}

	charCount, err := s.q.CountThemeCharacters(ctx, theme.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count characters")
		return nil, apperror.Internal("failed to count characters")
	}
	if charCount < int64(theme.MinPlayers) {
		return nil, apperror.BadRequest(fmt.Sprintf("theme requires at least %d characters, has %d", theme.MinPlayers, charCount))
	}
	if len(theme.ConfigJson) == 0 || string(theme.ConfigJson) == "{}" || string(theme.ConfigJson) == "null" {
		return nil, apperror.BadRequest("theme config_json must be set before submitting")
	}

	trusted, err := s.q.GetUserTrustedCreator(ctx, userID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to check trusted creator status")
		return nil, apperror.Internal("failed to check trusted creator status")
	}

	if trusted {
		updated, err := s.q.ApproveTheme(ctx, db.ApproveThemeParams{
			ID:         theme.ID,
			ReviewedBy: pgtype.UUID{Bytes: userID, Valid: true},
			ReviewNote: pgtype.Text{String: "auto-approved (trusted creator)", Valid: true},
		})
		if err != nil {
			s.logger.Error().Err(err).Msg("failed to auto-approve theme")
			return nil, apperror.Internal("failed to auto-approve theme")
		}
		return toThemeResponse(updated), nil
	}

	updated, err := s.q.SubmitThemeForReview(ctx, theme.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to submit theme for review")
		return nil, apperror.Internal("failed to submit theme for review")
	}
	return toThemeResponse(updated), nil
}

func (s *service) CreateCharacter(ctx context.Context, creatorID, themeID uuid.UUID, req CreateCharacterRequest) (*CharacterResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	char, err := s.q.CreateThemeCharacter(ctx, db.CreateThemeCharacterParams{
		ThemeID:     themeID,
		Name:        req.Name,
		Description: ptrToText(req.Description),
		ImageUrl:    ptrToText(req.ImageURL),
		IsCulprit:   req.IsCulprit,
		SortOrder:   req.SortOrder,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create character")
		return nil, apperror.Internal("failed to create character")
	}
	return toCharacterResponse(char), nil
}

func (s *service) UpdateCharacter(ctx context.Context, creatorID, charID uuid.UUID, req UpdateCharacterRequest) (*CharacterResponse, error) {
	char, err := s.q.GetThemeCharacter(ctx, charID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("character not found")
		}
		s.logger.Error().Err(err).Msg("failed to get character")
		return nil, apperror.Internal("failed to get character")
	}
	if _, err := s.getOwnedTheme(ctx, creatorID, char.ThemeID); err != nil {
		return nil, err
	}

	updated, err := s.q.UpdateThemeCharacter(ctx, db.UpdateThemeCharacterParams{
		ID:          charID,
		Name:        req.Name,
		Description: ptrToText(req.Description),
		ImageUrl:    ptrToText(req.ImageURL),
		IsCulprit:   req.IsCulprit,
		SortOrder:   req.SortOrder,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to update character")
		return nil, apperror.Internal("failed to update character")
	}
	return toCharacterResponse(updated), nil
}

func (s *service) DeleteCharacter(ctx context.Context, creatorID, charID uuid.UUID) error {
	char, err := s.q.GetThemeCharacter(ctx, charID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.NotFound("character not found")
		}
		s.logger.Error().Err(err).Msg("failed to get character")
		return apperror.Internal("failed to get character")
	}
	if _, err := s.getOwnedTheme(ctx, creatorID, char.ThemeID); err != nil {
		return err
	}

	if err := s.q.DeleteThemeCharacter(ctx, charID); err != nil {
		s.logger.Error().Err(err).Msg("failed to delete character")
		return apperror.Internal("failed to delete character")
	}
	return nil
}

func (s *service) ListCharacters(ctx context.Context, creatorID, themeID uuid.UUID) ([]CharacterResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	chars, err := s.q.GetThemeCharacters(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list characters")
		return nil, apperror.Internal("failed to list characters")
	}
	out := make([]CharacterResponse, len(chars))
	for i, c := range chars {
		out[i] = *toCharacterResponse(c)
	}
	return out, nil
}

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
			return nil, apperror.Conflict("theme was modified by another session")
		}
		s.logger.Error().Err(err).Msg("failed to update config")
		return nil, apperror.Internal("failed to update config")
	}
	return toThemeResponse(updated), nil
}

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
	// verify map belongs to the theme via ownership check
	_, err := s.q.GetMapWithOwner(ctx, db.GetMapWithOwnerParams{ID: mapID, CreatorID: creatorID})
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
		RestrictedCharacters: ptrToText(req.RestrictedCharacters),
		SortOrder:            req.SortOrder,
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
	updated, err := s.q.UpdateLocation(ctx, db.UpdateLocationParams{
		ID:                   l.ID,
		Name:                 req.Name,
		RestrictedCharacters: ptrToText(req.RestrictedCharacters),
		SortOrder:            req.SortOrder,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to update location")
		return nil, apperror.Internal("failed to update location")
	}
	resp := toLocationResponse(updated)
	return &resp, nil
}

func (s *service) DeleteLocation(ctx context.Context, creatorID, locID uuid.UUID) error {
	n, err := s.q.DeleteLocationWithOwner(ctx, db.DeleteLocationWithOwnerParams{ID: locID, CreatorID: creatorID})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to delete location")
		return apperror.Internal("failed to delete location")
	}
	if n == 0 {
		return apperror.NotFound("location not found")
	}
	return nil
}

// --- Clues ---

func (s *service) ListClues(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	clues, err := s.q.ListCluesByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list clues")
		return nil, apperror.Internal("failed to list clues")
	}
	out := make([]ClueResponse, len(clues))
	for i, c := range clues {
		out[i] = toClueResponse(c)
	}
	return out, nil
}

func (s *service) CreateClue(ctx context.Context, creatorID, themeID uuid.UUID, req CreateClueRequest) (*ClueResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	count, err := s.q.CountCluesByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count clues")
		return nil, apperror.Internal("failed to count clues")
	}
	if count >= MaxCluesPerTheme {
		return nil, apperror.BadRequest(fmt.Sprintf("theme cannot have more than %d clues", MaxCluesPerTheme))
	}
	clue, err := s.q.CreateClue(ctx, db.CreateClueParams{
		ThemeID:     themeID,
		LocationID:  uuidPtrToPgtype(req.LocationID),
		Name:        req.Name,
		Description: ptrToText(req.Description),
		ImageUrl:    ptrToText(req.ImageURL),
		IsCommon:    req.IsCommon,
		Level:       req.Level,
		ClueType:    req.ClueType,
		SortOrder:   req.SortOrder,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create clue")
		return nil, apperror.Internal("failed to create clue")
	}
	resp := toClueResponse(clue)
	return &resp, nil
}

func (s *service) UpdateClue(ctx context.Context, creatorID, clueID uuid.UUID, req UpdateClueRequest) (*ClueResponse, error) {
	c, err := s.q.GetClueWithOwner(ctx, db.GetClueWithOwnerParams{ID: clueID, CreatorID: creatorID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("clue not found")
		}
		s.logger.Error().Err(err).Msg("failed to get clue")
		return nil, apperror.Internal("failed to get clue")
	}
	updated, err := s.q.UpdateClue(ctx, db.UpdateClueParams{
		ID:          c.ID,
		LocationID:  uuidPtrToPgtype(req.LocationID),
		Name:        req.Name,
		Description: ptrToText(req.Description),
		ImageUrl:    ptrToText(req.ImageURL),
		IsCommon:    req.IsCommon,
		Level:       req.Level,
		ClueType:    req.ClueType,
		SortOrder:   req.SortOrder,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to update clue")
		return nil, apperror.Internal("failed to update clue")
	}
	resp := toClueResponse(updated)
	return &resp, nil
}

func (s *service) DeleteClue(ctx context.Context, creatorID, clueID uuid.UUID) error {
	n, err := s.q.DeleteClueWithOwner(ctx, db.DeleteClueWithOwnerParams{ID: clueID, CreatorID: creatorID})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to delete clue")
		return apperror.Internal("failed to delete clue")
	}
	if n == 0 {
		return apperror.NotFound("clue not found")
	}
	return nil
}

// --- Contents ---

func (s *service) GetContent(ctx context.Context, creatorID, themeID uuid.UUID, key string) (*ContentResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	if !validContentKeyRe.MatchString(key) {
		return nil, apperror.BadRequest("invalid content key format")
	}
	content, err := s.q.GetContent(ctx, db.GetContentParams{ThemeID: themeID, Key: key})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("content not found")
		}
		s.logger.Error().Err(err).Msg("failed to get content")
		return nil, apperror.Internal("failed to get content")
	}
	resp := toContentResponse(content)
	return &resp, nil
}

func (s *service) UpsertContent(ctx context.Context, creatorID, themeID uuid.UUID, key string, body string) (*ContentResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	if !validContentKeyRe.MatchString(key) {
		return nil, apperror.BadRequest("invalid content key format")
	}
	content, err := s.q.UpsertContent(ctx, db.UpsertContentParams{
		ThemeID: themeID,
		Key:     key,
		Body:    body,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to upsert content")
		return nil, apperror.Internal("failed to upsert content")
	}
	resp := toContentResponse(content)
	return &resp, nil
}

// --- Validation ---

func (s *service) ValidateTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ValidationResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}

	charCount, err := s.q.CountThemeCharacters(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count characters")
		return nil, apperror.Internal("failed to validate theme")
	}
	mapCount, err := s.q.CountMapsByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count maps")
		return nil, apperror.Internal("failed to validate theme")
	}
	clueCount, err := s.q.CountCluesByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count clues")
		return nil, apperror.Internal("failed to validate theme")
	}

	// count locations across all maps
	locs, err := s.q.ListLocationsByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list locations")
		return nil, apperror.Internal("failed to validate theme")
	}
	locCount := int64(len(locs))

	var errs []string
	if charCount < int64(theme.MinPlayers) {
		errs = append(errs, fmt.Sprintf("최소 %d명의 캐릭터가 필요합니다 (현재 %d명)", theme.MinPlayers, charCount))
	}
	if mapCount == 0 {
		errs = append(errs, "최소 1개의 맵이 필요합니다")
	}

	// check culprit character exists
	chars, err := s.q.GetThemeCharacters(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get characters")
		return nil, apperror.Internal("failed to validate theme")
	}
	hasCulprit := false
	for _, c := range chars {
		if c.IsCulprit {
			hasCulprit = true
			break
		}
	}
	if !hasCulprit {
		errs = append(errs, "범인 캐릭터가 지정되어야 합니다")
	}

	return &ValidationResponse{
		Valid:  len(errs) == 0,
		Errors: errs,
		Stats: ValidationStats{
			Characters: int(charCount),
			Maps:       int(mapCount),
			Locations:  int(locCount),
			Clues:      int(clueCount),
		},
	}, nil
}

// --- Helpers ---

// getOwnedTheme fetches a theme and verifies creator ownership.
func (s *service) getOwnedTheme(ctx context.Context, creatorID, themeID uuid.UUID) (db.Theme, error) {
	theme, err := s.q.GetTheme(ctx, themeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Theme{}, apperror.NotFound("theme not found")
		}
		s.logger.Error().Err(err).Msg("failed to get theme")
		return db.Theme{}, apperror.Internal("failed to get theme")
	}
	if theme.CreatorID != creatorID {
		return db.Theme{}, apperror.Forbidden("you do not own this theme")
	}
	return theme, nil
}

func textToPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

func ptrToText(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

var slugCleanRe = regexp.MustCompile(`[^a-z0-9-]+`)

func generateSlug(title string) string {
	s := strings.ToLower(strings.TrimSpace(title))
	s = strings.ReplaceAll(s, " ", "-")
	s = slugCleanRe.ReplaceAllString(s, "")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "theme"
	}

	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		// fallback: use timestamp-based suffix
		return fmt.Sprintf("%s-%d", s, time.Now().UnixMilli()%10000)
	}
	return fmt.Sprintf("%s-%s", s, hex.EncodeToString(b)[:4])
}

// isUniqueViolation returns true if err is a PostgreSQL unique constraint violation (code 23505).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func toThemeResponse(t db.Theme) *ThemeResponse {
	resp := &ThemeResponse{
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
		Status:      t.Status,
		Version:     t.Version,
		CreatedAt:   t.CreatedAt,
	}
	if len(t.ConfigJson) > 0 && string(t.ConfigJson) != "null" {
		resp.ConfigJson = t.ConfigJson
	}
	if t.ReviewNote.Valid {
		s := t.ReviewNote.String
		resp.ReviewNote = &s
	}
	if t.ReviewedAt.Valid {
		ts := t.ReviewedAt.Time
		resp.ReviewedAt = &ts
	}
	if t.ReviewedBy.Valid {
		id := t.ReviewedBy.Bytes
		uid := uuid.UUID(id)
		resp.ReviewedBy = &uid
	}
	return resp
}

func toCharacterResponse(c db.ThemeCharacter) *CharacterResponse {
	return &CharacterResponse{
		ID:          c.ID,
		ThemeID:     c.ThemeID,
		Name:        c.Name,
		Description: textToPtr(c.Description),
		ImageURL:    textToPtr(c.ImageUrl),
		IsCulprit:   c.IsCulprit,
		SortOrder:   c.SortOrder,
	}
}

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
		SortOrder:            l.SortOrder,
		CreatedAt:            l.CreatedAt,
	}
}

func toClueResponse(c db.ThemeClue) ClueResponse {
	return ClueResponse{
		ID:          c.ID,
		ThemeID:     c.ThemeID,
		LocationID:  pgtypeUUIDToPtr(c.LocationID),
		Name:        c.Name,
		Description: textToPtr(c.Description),
		ImageURL:    textToPtr(c.ImageUrl),
		IsCommon:    c.IsCommon,
		Level:       c.Level,
		ClueType:    c.ClueType,
		SortOrder:   c.SortOrder,
		CreatedAt:   c.CreatedAt,
	}
}

func toContentResponse(c db.ThemeContent) ContentResponse {
	return ContentResponse{
		ID:        c.ID,
		ThemeID:   c.ThemeID,
		Key:       c.Key,
		Body:      c.Body,
		UpdatedAt: c.UpdatedAt,
	}
}

func uuidPtrToPgtype(u *uuid.UUID) pgtype.UUID {
	if u == nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: *u, Valid: true}
}

func pgtypeUUIDToPtr(u pgtype.UUID) *uuid.UUID {
	if !u.Valid {
		return nil
	}
	id := uuid.UUID(u.Bytes)
	return &id
}
