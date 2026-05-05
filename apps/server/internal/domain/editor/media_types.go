package editor

import (
	"time"

	"github.com/google/uuid"
)

// Media constants
const (
	MaxMediaPerTheme   = 100
	MaxMediaFileSize   = 20 << 20  // 20MB
	MaxStoragePerTheme = 500 << 20 // 500MB
	MaxStoragePerUser  = 2 << 30   // 2GB

	MediaTypeBGM      = "BGM"
	MediaTypeSFX      = "SFX"
	MediaTypeVoice    = "VOICE"
	MediaTypeVideo    = "VIDEO"
	MediaTypeDocument = "DOCUMENT"
	MediaTypeImage    = "IMAGE"

	SourceTypeFile    = "FILE"
	SourceTypeYouTube = "YOUTUBE"
)

// AllowedAudioMIMEs defines allowed MIME types for audio files.
var AllowedAudioMIMEs = map[string]string{
	"audio/mpeg": ".mp3",
	"audio/ogg":  ".ogg",
	"audio/wav":  ".wav",
}

// AllowedDocumentMIMEs defines allowed MIME types for document role sheets.
var AllowedDocumentMIMEs = map[string]string{
	"application/pdf": ".pdf",
}

var AllowedMediaImageMIMEs = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type RequestMediaUploadRequest struct {
	Name     string `json:"name" validate:"required,min=1,max=200"`
	Type     string `json:"type" validate:"required,oneof=BGM SFX VOICE VIDEO DOCUMENT IMAGE"`
	MimeType string `json:"mime_type" validate:"required"`
	FileSize int64  `json:"file_size" validate:"required,min=1"`
}

type MediaDownloadURLResponse struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expires_at"`
}

type UploadURLResponse struct {
	UploadID  uuid.UUID `json:"upload_id"`
	UploadURL string    `json:"upload_url"`
	ExpiresAt time.Time `json:"expires_at"`
}

type ConfirmUploadRequest struct {
	UploadID uuid.UUID `json:"upload_id" validate:"required"`
}

type CreateMediaYouTubeRequest struct {
	Name string `json:"name" validate:"required,min=1,max=200"`
	Type string `json:"type" validate:"required,oneof=BGM SFX VOICE VIDEO"`
	URL  string `json:"url" validate:"required,url"`
}

type UpdateMediaRequest struct {
	Name      string   `json:"name" validate:"required,min=1,max=200"`
	Type      string   `json:"type" validate:"required,oneof=BGM SFX VOICE VIDEO DOCUMENT IMAGE"`
	Duration  *int32   `json:"duration,omitempty"`
	Tags      []string `json:"tags" validate:"max=10,dive,max=50"`
	SortOrder int32    `json:"sort_order" validate:"min=0"`
}

type MediaResponse struct {
	ID         uuid.UUID `json:"id"`
	ThemeID    uuid.UUID `json:"theme_id"`
	Name       string    `json:"name"`
	Type       string    `json:"type"`
	SourceType string    `json:"source_type"`
	URL        *string   `json:"url,omitempty"`
	Duration   *int32    `json:"duration,omitempty"`
	FileSize   *int64    `json:"file_size,omitempty"`
	MimeType   *string   `json:"mime_type,omitempty"`
	Tags       []string  `json:"tags"`
	SortOrder  int32     `json:"sort_order"`
	CreatedAt  time.Time `json:"created_at"`
}
