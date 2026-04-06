package voice

import (
	"context"

	"github.com/google/uuid"
)

// TokenRequest is the payload for requesting a voice room token.
type TokenRequest struct {
	SessionID string `json:"session_id" validate:"required"`
	RoomType  string `json:"room_type"  validate:"required,oneof=main whisper"`
	RoomName  string `json:"room_name"  validate:"omitempty,max=64"`
}

// TokenResponse contains the LiveKit connection parameters.
type TokenResponse struct {
	Token    string `json:"token"`
	URL      string `json:"livekit_url"`
	RoomName string `json:"room_name"`
}

// Service defines the voice domain operations.
type Service interface {
	GetToken(ctx context.Context, userID uuid.UUID, req TokenRequest) (*TokenResponse, error)
}
