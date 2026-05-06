// Package editor implements the in-game editor domain (themes, characters,
// maps, locations, clues, and more). The domain is deliberately split
// across sibling files:
//
//   - service.go            interface + constructor + Request/Response DTOs
//   - themes.go             Theme CRUD (Create/Update/Delete/Get/List)
//   - publication.go        Publish / Unpublish / SubmitForReview
//   - helpers.go            getOwnedTheme, pgtype converters, slug/unique-violation helpers, toThemeResponse
//   - service_character.go  character-scoped methods
//   - service_location.go   map/location-scoped methods
//   - service_clue.go       clue-scoped methods
//   - service_config.go     module config + content methods
//   - service_validation.go theme validation
//   - clue_edge_service.go  Phase 20 PR-4 unified clue edge schema
//
// Callers depend only on the public Service interface defined here.
package editor

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/engine"
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
	Name                string               `json:"name" validate:"required,min=1,max=50"`
	Description         *string              `json:"description" validate:"omitempty,max=2000"`
	ImageURL            *string              `json:"image_url" validate:"omitempty,optional_url"`
	ImageMediaID        *uuid.UUID           `json:"image_media_id"`
	IsCulprit           bool                 `json:"is_culprit"`
	MysteryRole         string               `json:"mystery_role" validate:"omitempty,oneof=suspect culprit accomplice detective"`
	SortOrder           int32                `json:"sort_order" validate:"min=0"`
	IsPlayable          *bool                `json:"is_playable"`
	ShowInIntro         *bool                `json:"show_in_intro"`
	CanSpeakInReading   *bool                `json:"can_speak_in_reading"`
	IsVotingCandidate   *bool                `json:"is_voting_candidate"`
	EndcardTitle        *string              `json:"endcard_title" validate:"omitempty,max=80"`
	EndcardBody         *string              `json:"endcard_body" validate:"omitempty,max=3000"`
	EndcardImageURL     *string              `json:"endcard_image_url" validate:"omitempty,optional_url"`
	EndcardImageMediaID *uuid.UUID           `json:"endcard_image_media_id"`
	AliasRules          []CharacterAliasRule `json:"alias_rules"`
}

type UpdateCharacterRequest struct {
	Name                string               `json:"name" validate:"required,min=1,max=50"`
	Description         *string              `json:"description" validate:"omitempty,max=2000"`
	ImageURL            *string              `json:"image_url" validate:"omitempty,optional_url"`
	ImageMediaID        OptionalUUID         `json:"image_media_id"`
	IsCulprit           bool                 `json:"is_culprit"`
	MysteryRole         string               `json:"mystery_role" validate:"omitempty,oneof=suspect culprit accomplice detective"`
	SortOrder           int32                `json:"sort_order" validate:"min=0"`
	IsPlayable          *bool                `json:"is_playable"`
	ShowInIntro         *bool                `json:"show_in_intro"`
	CanSpeakInReading   *bool                `json:"can_speak_in_reading"`
	IsVotingCandidate   *bool                `json:"is_voting_candidate"`
	EndcardTitle        *string              `json:"endcard_title" validate:"omitempty,max=80"`
	EndcardBody         *string              `json:"endcard_body" validate:"omitempty,max=3000"`
	EndcardImageURL     *string              `json:"endcard_image_url" validate:"omitempty,optional_url"`
	EndcardImageMediaID OptionalUUID         `json:"endcard_image_media_id"`
	AliasRules          []CharacterAliasRule `json:"alias_rules"`
}

type CharacterAliasRule = engine.CharacterAliasRule

type CharacterResponse struct {
	ID                  uuid.UUID            `json:"id"`
	ThemeID             uuid.UUID            `json:"theme_id"`
	Name                string               `json:"name"`
	Description         *string              `json:"description,omitempty"`
	ImageURL            *string              `json:"image_url,omitempty"`
	ImageMediaID        *uuid.UUID           `json:"image_media_id,omitempty"`
	IsCulprit           bool                 `json:"is_culprit"`
	MysteryRole         string               `json:"mystery_role"`
	SortOrder           int32                `json:"sort_order"`
	IsPlayable          bool                 `json:"is_playable"`
	ShowInIntro         bool                 `json:"show_in_intro"`
	CanSpeakInReading   bool                 `json:"can_speak_in_reading"`
	IsVotingCandidate   bool                 `json:"is_voting_candidate"`
	EndcardTitle        *string              `json:"endcard_title,omitempty"`
	EndcardBody         *string              `json:"endcard_body,omitempty"`
	EndcardImageURL     *string              `json:"endcard_image_url,omitempty"`
	EndcardImageMediaID *uuid.UUID           `json:"endcard_image_media_id,omitempty"`
	AliasRules          []CharacterAliasRule `json:"alias_rules"`
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

	// Clue edges (Phase 20 PR-4 unified schema: groups + members)
	GetClueEdges(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueEdgeGroupResponse, error)
	ReplaceClueEdges(ctx context.Context, creatorID, themeID uuid.UUID, reqs []ClueEdgeGroupRequest) ([]ClueEdgeGroupResponse, error)

	// Contents
	GetContent(ctx context.Context, creatorID, themeID uuid.UUID, key string) (*ContentResponse, error)
	UpsertContent(ctx context.Context, creatorID, themeID uuid.UUID, key string, body string) (*ContentResponse, error)

	// Role sheets
	GetCharacterRoleSheet(ctx context.Context, creatorID, charID uuid.UUID) (*RoleSheetResponse, error)
	UpsertCharacterRoleSheet(ctx context.Context, creatorID, charID uuid.UUID, req UpsertRoleSheetRequest) (*RoleSheetResponse, error)

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

	// preUpdateHook is called inside UpdateConfigJson between the getOwnedTheme
	// read and the UpdateThemeConfigJson write. It is nil in production; tests
	// can set it to inject a controlled version bump and make the optimistic-lock
	// conflict path deterministic (replaces the previous goroutine+race approach).
	preUpdateHook func(ctx context.Context, themeID uuid.UUID)
}

// NewService creates a new editor service backed by sqlc queries.
func NewService(q *db.Queries, pool *pgxpool.Pool, logger zerolog.Logger) Service {
	return &service{
		q:      q,
		pool:   pool,
		logger: logger.With().Str("domain", "editor").Logger(),
	}
}
