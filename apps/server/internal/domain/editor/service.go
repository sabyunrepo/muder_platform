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

	// Clue relations
	GetClueRelations(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueRelationResponse, error)
	ReplaceClueRelations(ctx context.Context, creatorID, themeID uuid.UUID, reqs []ClueRelationRequest) ([]ClueRelationResponse, error)

	// Contents
	GetContent(ctx context.Context, creatorID, themeID uuid.UUID, key string) (*ContentResponse, error)
	UpsertContent(ctx context.Context, creatorID, themeID uuid.UUID, key string, body string) (*ContentResponse, error)

	// Theme detail
	GetTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error)

	// Validation
	ValidateTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ValidationResponse, error)

	// Module schemas
	GetModuleSchemas(ctx context.Context) (map[string]json.RawMessage, error)
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

// --- Theme ops ---

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

// --- Shared helpers ---

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

func int32PtrToPgtype(i *int32) pgtype.Int4 {
	if i == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: *i, Valid: true}
}

func pgtypeInt4ToPtr(i pgtype.Int4) *int32 {
	if !i.Valid {
		return nil
	}
	v := i.Int32
	return &v
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
