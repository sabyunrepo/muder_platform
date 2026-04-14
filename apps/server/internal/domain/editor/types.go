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
}

type UpdateLocationRequest struct {
	Name                 string  `json:"name" validate:"required,min=1,max=100"`
	RestrictedCharacters *string `json:"restricted_characters"`
	SortOrder            int32   `json:"sort_order" validate:"min=0"`
}

type LocationResponse struct {
	ID                   uuid.UUID `json:"id"`
	ThemeID              uuid.UUID `json:"theme_id"`
	MapID                uuid.UUID `json:"map_id"`
	Name                 string    `json:"name"`
	RestrictedCharacters *string   `json:"restricted_characters,omitempty"`
	SortOrder            int32     `json:"sort_order"`
	CreatedAt            time.Time `json:"created_at"`
}

// --- Clue types ---

type CreateClueRequest struct {
	LocationID  *uuid.UUID `json:"location_id"`
	Name        string     `json:"name" validate:"required,min=1,max=200"`
	Description *string    `json:"description" validate:"omitempty,max=2000"`
	ImageURL    *string    `json:"image_url" validate:"omitempty,url"`
	IsCommon    bool       `json:"is_common"`
	Level       int32      `json:"level" validate:"min=1,max=10"`
	ClueType    string     `json:"clue_type" validate:"required,oneof=normal weapon evidence alibi"`
	SortOrder   int32      `json:"sort_order" validate:"min=0"`
	IsUsable    bool       `json:"is_usable"`
	UseEffect   *string    `json:"use_effect" validate:"omitempty,oneof=peek steal reveal block swap"`
	UseTarget   *string    `json:"use_target" validate:"omitempty,oneof=player clue self"`
	UseConsumed bool       `json:"use_consumed"`
}

type UpdateClueRequest struct {
	LocationID  *uuid.UUID `json:"location_id"`
	Name        string     `json:"name" validate:"required,min=1,max=200"`
	Description *string    `json:"description" validate:"omitempty,max=2000"`
	ImageURL    *string    `json:"image_url" validate:"omitempty,url"`
	IsCommon    bool       `json:"is_common"`
	Level       int32      `json:"level" validate:"min=1,max=10"`
	ClueType    string     `json:"clue_type" validate:"required,oneof=normal weapon evidence alibi"`
	SortOrder   int32      `json:"sort_order" validate:"min=0"`
	IsUsable    bool       `json:"is_usable"`
	UseEffect   *string    `json:"use_effect" validate:"omitempty,oneof=peek steal reveal block swap"`
	UseTarget   *string    `json:"use_target" validate:"omitempty,oneof=player clue self"`
	UseConsumed bool       `json:"use_consumed"`
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
	ClueType    string     `json:"clue_type"`
	SortOrder   int32      `json:"sort_order"`
	CreatedAt   time.Time  `json:"created_at"`
	IsUsable    bool       `json:"is_usable"`
	UseEffect   *string    `json:"use_effect,omitempty"`
	UseTarget   *string    `json:"use_target,omitempty"`
	UseConsumed bool       `json:"use_consumed"`
}

// --- Clue relation types ---

// ClueRelationRequest is the input for a single clue relation.
type ClueRelationRequest struct {
	SourceID uuid.UUID `json:"sourceId"`
	TargetID uuid.UUID `json:"targetId"`
	Mode     string    `json:"mode"` // "AND" or "OR"
}

// ClueRelationResponse is the output for a single clue relation.
type ClueRelationResponse struct {
	ID       uuid.UUID `json:"id"`
	SourceID uuid.UUID `json:"sourceId"`
	TargetID uuid.UUID `json:"targetId"`
	Mode     string    `json:"mode"`
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
