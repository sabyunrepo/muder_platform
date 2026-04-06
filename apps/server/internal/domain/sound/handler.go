package sound

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/ws"
)

const (
	// TypeSoundPlay is the WS event type for sound playback.
	TypeSoundPlay = "sound:play"
)

// soundPlayPayload is the expected payload for sound:play messages.
type soundPlayPayload struct {
	SoundID string `json:"soundId"`
}

// WSHandler handles sound-related WebSocket messages.
type WSHandler struct {
	hub    *ws.Hub
	logger zerolog.Logger
}

// NewWSHandler creates a new sound WS handler.
func NewWSHandler(hub *ws.Hub, logger zerolog.Logger) *WSHandler {
	return &WSHandler{
		hub:    hub,
		logger: logger.With().Str("component", "sound.ws").Logger(),
	}
}

// Handle processes sound namespace messages (sound:*).
// It is registered on the WS router as the "sound" namespace handler.
func (h *WSHandler) Handle(c *ws.Client, env *ws.Envelope) {
	switch env.Type {
	case TypeSoundPlay:
		h.handlePlay(c, env)
	default:
		h.logger.Warn().
			Str("type", env.Type).
			Stringer("playerID", c.ID).
			Msg("unknown sound event type")
	}
}

// handlePlay validates the sound ID and broadcasts to the session.
func (h *WSHandler) handlePlay(c *ws.Client, env *ws.Envelope) {
	if c.SessionID == uuid.Nil {
		h.logger.Warn().
			Stringer("playerID", c.ID).
			Msg("sound:play from client not in session, ignoring")
		return
	}

	var payload soundPlayPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		h.logger.Warn().
			Err(err).
			Stringer("playerID", c.ID).
			Msg("invalid sound:play payload")
		return
	}

	if !IsValidSound(payload.SoundID) {
		h.logger.Debug().
			Str("soundId", payload.SoundID).
			Stringer("playerID", c.ID).
			Msg("unknown sound ID, ignoring")
		return
	}

	// Broadcast the sound event to all clients in the session.
	broadcast, err := ws.NewEnvelope(TypeSoundPlay, payload)
	if err != nil {
		h.logger.Error().
			Err(err).
			Msg("failed to marshal sound:play envelope")
		return
	}

	h.hub.BroadcastToSession(c.SessionID, broadcast)

	h.logger.Debug().
		Str("soundId", payload.SoundID).
		Stringer("playerID", c.ID).
		Stringer("sessionID", c.SessionID).
		Msg("sound:play broadcast")
}
