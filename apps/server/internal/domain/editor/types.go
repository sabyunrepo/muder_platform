package editor

import (
	"time"

	"github.com/google/uuid"
)

// --- Map types ---

type CreateMapRequest struct {
	Name      string  `json:"name" validate:"required,min=1,max=100"`
	ImageURL  *string `json:"image_url" validate:"omitempty,url"`
	SortOrder int32   `json:"sort_order" validate:"min=0"`
}

type UpdateMapRequest struct {
	Name      string  `json:"name" validate:"required,min=1,max=100"`
	ImageURL  *string `json:"image_url" validate:"omitempty,url"`
	SortOrder int32   `json:"sort_order" validate:"min=0"`
}

type MapResponse struct {
	ID        uuid.UUID `json:"id"`
	ThemeID   uuid.UUID `json:"theme_id"`
	Name      string    `json:"name"`
	ImageURL  *string   `json:"image_url,omitempty"`
	SortOrder int32     `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

// --- Location types ---

type CreateLocationRequest struct {
	Name                 string  `json:"name" validate:"required,min=1,max=100"`
	RestrictedCharacters *string `json:"restricted_characters"`
	SortOrder            int32   `json:"sort_order" validate:"min=0"`
	FromRound            *int32  `json:"from_round" validate:"omitempty,min=1"`
	UntilRound           *int32  `json:"until_round" validate:"omitempty,min=1"`
}

type UpdateLocationRequest struct {
	Name                 string  `json:"name" validate:"required,min=1,max=100"`
	RestrictedCharacters *string `json:"restricted_characters"`
	SortOrder            int32   `json:"sort_order" validate:"min=0"`
	FromRound            *int32  `json:"from_round" validate:"omitempty,min=1"`
	UntilRound           *int32  `json:"until_round" validate:"omitempty,min=1"`
}

type LocationResponse struct {
	ID                   uuid.UUID `json:"id"`
	ThemeID              uuid.UUID `json:"theme_id"`
	MapID                uuid.UUID `json:"map_id"`
	Name                 string    `json:"name"`
	RestrictedCharacters *string   `json:"restricted_characters,omitempty"`
	SortOrder            int32     `json:"sort_order"`
	CreatedAt            time.Time `json:"created_at"`
	FromRound            *int32    `json:"from_round,omitempty"`
	UntilRound           *int32    `json:"until_round,omitempty"`
}

// --- Clue types ---

type CreateClueRequest struct {
	LocationID  *uuid.UUID `json:"location_id"`
	Name        string     `json:"name" validate:"required,min=1,max=200"`
	Description *string    `json:"description" validate:"omitempty,max=2000"`
	ImageURL    *string    `json:"image_url" validate:"omitempty,url"`
	IsCommon    bool       `json:"is_common"`
	Level       int32      `json:"level" validate:"min=1,max=10"`
	SortOrder   int32      `json:"sort_order" validate:"min=0"`
	IsUsable    bool       `json:"is_usable"`
	UseEffect   *string    `json:"use_effect" validate:"omitempty,oneof=peek steal reveal block swap"`
	UseTarget   *string    `json:"use_target" validate:"omitempty,oneof=player clue self"`
	UseConsumed bool       `json:"use_consumed"`
	RevealRound *int32     `json:"reveal_round" validate:"omitempty,min=1"`
	HideRound   *int32     `json:"hide_round" validate:"omitempty,min=1"`
}

type UpdateClueRequest struct {
	LocationID  *uuid.UUID `json:"location_id"`
	Name        string     `json:"name" validate:"required,min=1,max=200"`
	Description *string    `json:"description" validate:"omitempty,max=2000"`
	ImageURL    *string    `json:"image_url" validate:"omitempty,url"`
	IsCommon    bool       `json:"is_common"`
	Level       int32      `json:"level" validate:"min=1,max=10"`
	SortOrder   int32      `json:"sort_order" validate:"min=0"`
	IsUsable    bool       `json:"is_usable"`
	UseEffect   *string    `json:"use_effect" validate:"omitempty,oneof=peek steal reveal block swap"`
	UseTarget   *string    `json:"use_target" validate:"omitempty,oneof=player clue self"`
	UseConsumed bool       `json:"use_consumed"`
	RevealRound *int32     `json:"reveal_round" validate:"omitempty,min=1"`
	HideRound   *int32     `json:"hide_round" validate:"omitempty,min=1"`
}

type ClueResponse struct {
	ID          uuid.UUID  `json:"id"`
	ThemeID     uuid.UUID  `json:"theme_id"`
	LocationID  *uuid.UUID `json:"location_id,omitempty"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	ImageURL    *string    `json:"image_url,omitempty"`
	IsCommon    bool       `json:"is_common"`
	Level       int32      `json:"level"`
	SortOrder   int32      `json:"sort_order"`
	CreatedAt   time.Time  `json:"created_at"`
	IsUsable    bool       `json:"is_usable"`
	UseEffect   *string    `json:"use_effect,omitempty"`
	UseTarget   *string    `json:"use_target,omitempty"`
	UseConsumed bool       `json:"use_consumed"`
	RevealRound *int32     `json:"reveal_round,omitempty"`
	HideRound   *int32     `json:"hide_round,omitempty"`
}

// --- Clue edge (unified group) types ---
//
// Phase 20 PR-4: replaces ClueRelationRequest/Response. A "group" pairs one
// target clue with N source clues under a (trigger, mode) semantic.
//   - Trigger=AUTO: target auto-unlocks when mode (AND/OR) over sources is satisfied
//   - Trigger=CRAFT: target stays locked until engine observes the full source
//     set in evidence via a `combine` command (OR mode rejected by CHECK+service)

type ClueEdgeGroupRequest struct {
	TargetID uuid.UUID   `json:"targetId"`
	Sources  []uuid.UUID `json:"sources"`
	Trigger  string      `json:"trigger"`
	Mode     string      `json:"mode"`
}

type ClueEdgeGroupResponse struct {
	ID       uuid.UUID   `json:"id"`
	TargetID uuid.UUID   `json:"targetId"`
	Sources  []uuid.UUID `json:"sources"`
	Trigger  string      `json:"trigger"`
	Mode     string      `json:"mode"`
}

// --- Content types ---

type ContentResponse struct {
	ID        uuid.UUID `json:"id"`
	ThemeID   uuid.UUID `json:"theme_id"`
	Key       string    `json:"key"`
	Body      string    `json:"body"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UpsertContentRequest struct {
	Body string `json:"body" validate:"max=50000"`
}

// --- Role sheet types ---

const (
	RoleSheetFormatMarkdown = "markdown"
)

type RoleSheetMarkdown struct {
	Body string `json:"body"`
}

type RoleSheetResponse struct {
	CharacterID uuid.UUID          `json:"character_id"`
	ThemeID     uuid.UUID          `json:"theme_id"`
	Format      string             `json:"format"`
	Markdown    *RoleSheetMarkdown `json:"markdown,omitempty"`
	UpdatedAt   *time.Time         `json:"updated_at,omitempty"`
}

type UpsertRoleSheetRequest struct {
	Format   string             `json:"format"`
	Markdown *RoleSheetMarkdown `json:"markdown,omitempty"`
}

// --- Validation types ---

type ValidationStats struct {
	Characters int `json:"characters"`
	Maps       int `json:"maps"`
	Locations  int `json:"locations"`
	Clues      int `json:"clues"`
}

type ValidationResponse struct {
	Valid  bool            `json:"valid"`
	Errors []string        `json:"errors"`
	Stats  ValidationStats `json:"stats"`
}
