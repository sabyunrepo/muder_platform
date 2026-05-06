package editor

import (
	"time"

	"github.com/google/uuid"
)

const (
	MaxStoryInfoTitleLength = 200
	MaxStoryInfoBodyLength  = 20000
	MaxStoryInfoRefs        = 100
)

type CreateStoryInfoRequest struct {
	Title               string   `json:"title"`
	Body                string   `json:"body"`
	ImageMediaID        *string  `json:"imageMediaId,omitempty"`
	RelatedCharacterIDs []string `json:"relatedCharacterIds"`
	RelatedClueIDs      []string `json:"relatedClueIds"`
	RelatedLocationIDs  []string `json:"relatedLocationIds"`
	SortOrder           int32    `json:"sortOrder"`
}

type UpdateStoryInfoRequest struct {
	Title               *string   `json:"title,omitempty"`
	Body                *string   `json:"body,omitempty"`
	ImageMediaID        **string  `json:"imageMediaId,omitempty"`
	RelatedCharacterIDs *[]string `json:"relatedCharacterIds,omitempty"`
	RelatedClueIDs      *[]string `json:"relatedClueIds,omitempty"`
	RelatedLocationIDs  *[]string `json:"relatedLocationIds,omitempty"`
	SortOrder           *int32    `json:"sortOrder,omitempty"`
	Version             int32     `json:"version"`
}

type StoryInfoResponse struct {
	ID                  uuid.UUID `json:"id"`
	ThemeID             uuid.UUID `json:"themeId"`
	Title               string    `json:"title"`
	Body                string    `json:"body"`
	ImageMediaID        *string   `json:"imageMediaId,omitempty"`
	RelatedCharacterIDs []string  `json:"relatedCharacterIds"`
	RelatedClueIDs      []string  `json:"relatedClueIds"`
	RelatedLocationIDs  []string  `json:"relatedLocationIds"`
	SortOrder           int32     `json:"sortOrder"`
	Version             int32     `json:"version"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}
