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
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// --- Request / Response types ---

type CreateThemeRequest struct {
	Title       string  `json:"title" validate:"required,min=2,max=100"`
	Description *string `json:"description" validate:"omitempty,max=1000"`
	CoverImage  *string `json:"cover_image" validate:"omitempty,url"`
	MinPlayers  int32   `json:"min_players" validate:"required,min=2,max=12"`
	MaxPlayers  int32   `json:"max_players" validate:"required,min=2,max=12"`
	DurationMin int32   `json:"duration_min" validate:"required,min=10,max=300"`
	Price       int32   `json:"price" validate:"min=0"`
}

type UpdateThemeRequest struct {
	Title       string  `json:"title" validate:"required,min=2,max=100"`
	Description *string `json:"description" validate:"omitempty,max=1000"`
	CoverImage  *string `json:"cover_image" validate:"omitempty,url"`
	MinPlayers  int32   `json:"min_players" validate:"required,min=2,max=12"`
	MaxPlayers  int32   `json:"max_players" validate:"required,min=2,max=12"`
	DurationMin int32   `json:"duration_min" validate:"required,min=10,max=300"`
	Price       int32   `json:"price" validate:"min=0"`
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
	Status      string          `json:"status"`
	ConfigJson  json.RawMessage `json:"config_json,omitempty"`
	Version     int32           `json:"version"`
	CreatedAt   time.Time       `json:"created_at"`
}

type ThemeSummary struct {
	ID         uuid.UUID `json:"id"`
	Title      string    `json:"title"`
	Status     string    `json:"status"`
	MinPlayers int32     `json:"min_players"`
	MaxPlayers int32     `json:"max_players"`
	Version    int32     `json:"version"`
	CreatedAt  time.Time `json:"created_at"`
}

type CreateCharacterRequest struct {
	Name        string  `json:"name" validate:"required,min=1,max=50"`
	Description *string `json:"description" validate:"omitempty,max=500"`
	ImageURL    *string `json:"image_url" validate:"omitempty,url"`
	IsCulprit   bool    `json:"is_culprit"`
	SortOrder   int32   `json:"sort_order" validate:"min=0"`
}

type UpdateCharacterRequest struct {
	Name        string  `json:"name" validate:"required,min=1,max=50"`
	Description *string `json:"description" validate:"omitempty,max=500"`
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
	CreateCharacter(ctx context.Context, creatorID, themeID uuid.UUID, req CreateCharacterRequest) (*CharacterResponse, error)
	UpdateCharacter(ctx context.Context, creatorID, charID uuid.UUID, req UpdateCharacterRequest) (*CharacterResponse, error)
	DeleteCharacter(ctx context.Context, creatorID, charID uuid.UUID) error
	UpdateConfigJson(ctx context.Context, creatorID, themeID uuid.UUID, config json.RawMessage) (*ThemeResponse, error)
}

// --- Implementation ---

type service struct {
	q      *db.Queries
	logger zerolog.Logger
}

// NewService creates a new editor service backed by sqlc queries.
func NewService(q *db.Queries, logger zerolog.Logger) Service {
	return &service{
		q:      q,
		logger: logger.With().Str("domain", "editor").Logger(),
	}
}

func (s *service) CreateTheme(ctx context.Context, creatorID uuid.UUID, req CreateThemeRequest) (*ThemeResponse, error) {
	slug := generateSlug(req.Title)

	theme, err := s.q.CreateTheme(ctx, db.CreateThemeParams{
		CreatorID:   creatorID,
		Title:       req.Title,
		Slug:        slug,
		Description: ptrToText(req.Description),
		CoverImage:  ptrToText(req.CoverImage),
		MinPlayers:  req.MinPlayers,
		MaxPlayers:  req.MaxPlayers,
		DurationMin: req.DurationMin,
		Price:       req.Price,
		ConfigJson:  json.RawMessage("{}"),
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create theme")
		return nil, apperror.Internal("failed to create theme")
	}
	return toThemeResponse(theme), nil
}

func (s *service) UpdateTheme(ctx context.Context, creatorID, themeID uuid.UUID, req UpdateThemeRequest) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}

	slug := generateSlug(req.Title)

	updated, err := s.q.UpdateTheme(ctx, db.UpdateThemeParams{
		ID:          theme.ID,
		Title:       req.Title,
		Slug:        slug,
		Description: ptrToText(req.Description),
		CoverImage:  ptrToText(req.CoverImage),
		MinPlayers:  req.MinPlayers,
		MaxPlayers:  req.MaxPlayers,
		DurationMin: req.DurationMin,
		Price:       req.Price,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to update theme")
		return nil, apperror.Internal("failed to update theme")
	}
	return toThemeResponse(updated), nil
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
			Version:    t.Version,
			CreatedAt:  t.CreatedAt,
		}
	}
	return out, nil
}

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

func (s *service) UnpublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}
	if theme.Status != "PUBLISHED" {
		return nil, apperror.BadRequest("only published themes can be unpublished")
	}

	updated, err := s.q.UpdateThemeStatus(ctx, db.UpdateThemeStatusParams{
		ID:     theme.ID,
		Status: "DRAFT",
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to unpublish theme")
		return nil, apperror.Internal("failed to unpublish theme")
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

func (s *service) UpdateConfigJson(ctx context.Context, creatorID, themeID uuid.UUID, config json.RawMessage) (*ThemeResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	updated, err := s.q.UpdateThemeConfigJson(ctx, db.UpdateThemeConfigJsonParams{
		ID:         themeID,
		ConfigJson: config,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to update config")
		return nil, apperror.Internal("failed to update config")
	}
	return toThemeResponse(updated), nil
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
		Status:      t.Status,
		Version:     t.Version,
		CreatedAt:   t.CreatedAt,
	}
	if len(t.ConfigJson) > 0 && string(t.ConfigJson) != "null" {
		resp.ConfigJson = t.ConfigJson
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
