package editor

import (
	"time"

	"github.com/google/uuid"
)

// Reading section validation constants.
const (
	MaxReadingSectionsPerTheme = 100
	MaxReadingLinesPerSection  = 500
)

// Reading advanceBy modes (must match progression.ReadingModule).
const (
	AdvanceByVoice   = "voice"
	AdvanceByGM      = "gm"
	AdvanceByRolePfx = "role:"
)

// ReadingLineDTO is the JSON shape of a single reading line as stored in
// the reading_sections.lines JSONB column. The Go field names use PascalCase
// (matching progression.ReadingLine) so that the encoding round-trips
// between editor and engine without translation.
type ReadingLineDTO struct {
	Index        int    `json:"Index"`
	Text         string `json:"Text"`
	Speaker      string `json:"Speaker,omitempty"`
	VoiceMediaID string `json:"VoiceMediaID,omitempty"`
	AdvanceBy    string `json:"AdvanceBy,omitempty"`
}

// CreateReadingSectionRequest is the JSON body for POST /editor/themes/{themeID}/reading-sections.
type CreateReadingSectionRequest struct {
	Name       string           `json:"name" validate:"required,min=1,max=200"`
	BgmMediaID *string          `json:"bgmMediaId,omitempty"`
	Lines      []ReadingLineDTO `json:"lines"`
	SortOrder  int32            `json:"sortOrder"`
}

// UpdateReadingSectionRequest is the JSON body for PATCH /editor/reading-sections/{id}.
//
// BgmMediaID uses pointer-to-pointer so the editor can distinguish three states:
//   - field omitted (BgmMediaID == nil)        → keep current value
//   - field set to null (*BgmMediaID == nil)   → clear bgm
//   - field set to "<uuid>" (**BgmMediaID set) → set to that media id
type UpdateReadingSectionRequest struct {
	Name       *string           `json:"name,omitempty" validate:"omitempty,min=1,max=200"`
	BgmMediaID **string          `json:"bgmMediaId,omitempty"`
	Lines      *[]ReadingLineDTO `json:"lines,omitempty"`
	SortOrder  *int32            `json:"sortOrder,omitempty"`
	Version    int32             `json:"version"`
}

// ReadingSectionResponse is the JSON shape returned by all reading section endpoints.
type ReadingSectionResponse struct {
	ID         uuid.UUID        `json:"id"`
	ThemeID    uuid.UUID        `json:"themeId"`
	Name       string           `json:"name"`
	BgmMediaID *string          `json:"bgmMediaId,omitempty"`
	Lines      []ReadingLineDTO `json:"lines"`
	SortOrder  int32            `json:"sortOrder"`
	Version    int32            `json:"version"`
	CreatedAt  time.Time        `json:"createdAt"`
	UpdatedAt  time.Time        `json:"updatedAt"`
}
