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

// Reading block types. An empty Type is treated as dialogue for backward
// compatibility with sections created before the block editor.
const (
	ReadingBlockDialogue = "dialogue"
	ReadingBlockImage    = "image"
	ReadingBlockVideo    = "video"
	ReadingBlockSFX      = "sfx"
	ReadingBlockBGM      = "bgm"
	ReadingBlockGMNote   = "gmNote"
)

const (
	ReadingBGMModeLoop = "loop"
	ReadingBGMModeOnce = "once"
	ReadingBGMModeStop = "stop"
)

// ReadingLineDTO is the JSON shape of a single reading line as stored in
// the reading_sections.lines JSONB column. The Go field names use PascalCase
// so engine-compatible fields and editor-only media cues round-trip without
// translation.
type ReadingLineDTO struct {
	Index        int    `json:"Index"`
	Type         string `json:"Type,omitempty"`
	Text         string `json:"Text,omitempty"`
	Speaker      string `json:"Speaker,omitempty"`
	VoiceMediaID string `json:"VoiceMediaID,omitempty"`
	ImageMediaID string `json:"ImageMediaID,omitempty"`
	AdvanceBy    string `json:"AdvanceBy,omitempty"`

	// Block editor fields. These are intentionally stored in the same JSONB
	// array so legacy dialogue lines and new production blocks can coexist
	// while the runtime reader is migrated incrementally.
	MediaID      string `json:"MediaID,omitempty"`
	Position     string `json:"Position,omitempty"`
	Size         string `json:"Size,omitempty"`
	Autoplay     bool   `json:"Autoplay,omitempty"`
	WaitUntilEnd bool   `json:"WaitUntilEnd,omitempty"`
	BGMMode      string `json:"BGMMode,omitempty"`
}

// CreateReadingSectionRequest is the JSON body for POST /editor/themes/{themeID}/reading-sections.
type CreateReadingSectionRequest struct {
	Name                string           `json:"name" validate:"required,min=1,max=200"`
	BgmMediaID          *string          `json:"bgmMediaId,omitempty"`
	BgmMode             string           `json:"bgmMode,omitempty"`
	NarratorCharacterID *string          `json:"narratorCharacterId,omitempty"`
	Lines               []ReadingLineDTO `json:"lines"`
	SortOrder           int32            `json:"sortOrder"`
}

// UpdateReadingSectionRequest is the JSON body for PATCH /editor/reading-sections/{id}.
//
// BgmMediaID uses pointer-to-pointer so the editor can distinguish three states:
//   - field omitted (BgmMediaID == nil)        → keep current value
//   - field set to null (*BgmMediaID == nil)   → clear bgm
//   - field set to "<uuid>" (**BgmMediaID set) → set to that media id
type UpdateReadingSectionRequest struct {
	Name                *string           `json:"name,omitempty" validate:"omitempty,min=1,max=200"`
	BgmMediaID          **string          `json:"bgmMediaId,omitempty"`
	BgmMode             *string           `json:"bgmMode,omitempty"`
	NarratorCharacterID *string           `json:"narratorCharacterId,omitempty"`
	Lines               *[]ReadingLineDTO `json:"lines,omitempty"`
	SortOrder           *int32            `json:"sortOrder,omitempty"`
	Version             int32             `json:"version"`
}

// ReadingSectionResponse is the JSON shape returned by all reading section endpoints.
type ReadingSectionResponse struct {
	ID                  uuid.UUID        `json:"id"`
	ThemeID             uuid.UUID        `json:"themeId"`
	Name                string           `json:"name"`
	BgmMediaID          *string          `json:"bgmMediaId,omitempty"`
	BgmMode             string           `json:"bgmMode"`
	NarratorCharacterID *string          `json:"narratorCharacterId,omitempty"`
	Lines               []ReadingLineDTO `json:"lines"`
	SortOrder           int32            `json:"sortOrder"`
	Version             int32            `json:"version"`
	CreatedAt           time.Time        `json:"createdAt"`
	UpdatedAt           time.Time        `json:"updatedAt"`
}
