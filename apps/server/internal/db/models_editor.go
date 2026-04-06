package db

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type ThemeMap struct {
	ID        uuid.UUID   `json:"id"`
	ThemeID   uuid.UUID   `json:"theme_id"`
	Name      string      `json:"name"`
	ImageUrl  pgtype.Text `json:"image_url"`
	SortOrder int32       `json:"sort_order"`
	CreatedAt time.Time   `json:"created_at"`
}

type ThemeLocation struct {
	ID                   uuid.UUID   `json:"id"`
	ThemeID              uuid.UUID   `json:"theme_id"`
	MapID                uuid.UUID   `json:"map_id"`
	Name                 string      `json:"name"`
	RestrictedCharacters pgtype.Text `json:"restricted_characters"`
	SortOrder            int32       `json:"sort_order"`
	CreatedAt            time.Time   `json:"created_at"`
}

type ThemeClue struct {
	ID          uuid.UUID   `json:"id"`
	ThemeID     uuid.UUID   `json:"theme_id"`
	LocationID  pgtype.UUID `json:"location_id"`
	Name        string      `json:"name"`
	Description pgtype.Text `json:"description"`
	ImageUrl    pgtype.Text `json:"image_url"`
	IsCommon    bool        `json:"is_common"`
	Level       int32       `json:"level"`
	ClueType    string      `json:"clue_type"`
	SortOrder   int32       `json:"sort_order"`
	CreatedAt   time.Time   `json:"created_at"`
}

type ThemeContent struct {
	ID        uuid.UUID `json:"id"`
	ThemeID   uuid.UUID `json:"theme_id"`
	Key       string    `json:"key"`
	Body      string    `json:"body"`
	UpdatedAt time.Time `json:"updated_at"`
}
