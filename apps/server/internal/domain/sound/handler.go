package sound

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/ws"
)

const (
	// TypeSoundPlay is the WS event type for sound playback.
	TypeSoundPlay = "sound:play"

	// soundCooldown is the minimum interval between sound:play per client.
	soundCooldown = 200 * time.Millisecond

	// maxSoundPayloadSize is the max allowed payload size for sound:play.
	maxSoundPayloadSize = 256
)

// soundPlayPayload is the expected payload for sound:play messages.
type soundPlayPayload struct {
	SoundID string `json:"soundId"`
}

// WSHandler handles sound-related WebSocket messages.
// NOTE: No Service layer — sound:play is a stateless broadcast with whitelist
// validation. Introduce a Service interface if persistence or permission
// logic is added.
type WSHandler struct {
	hub      *ws.Hub
	logger   zerolog.Logger
	lastPlay sync.Map // playerID (uuid.UUID) → time.Time
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
			Stringer("playerId", c.ID).
			Msg("unknown sound event type")
	}
}

// handlePlay validates the sound ID and broadcasts to the session.
func (h *WSHandler) handlePlay(c *ws.Client, env *ws.Envelope) {
	// Session check
	if c.SessionID == uuid.Nil {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeUnauthorized, "must join a session first"))
		h.logger.Warn().
			Stringer("playerId", c.ID).
			Msg("sound:play from client not in session")
		return
	}

	// Rate limiting per client
	if last, ok := h.lastPlay.Load(c.ID); ok {
		if time.Since(last.(time.Time)) < soundCooldown {
			c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeRateLimited, "sound:play rate limited"))
			return
		}
	}
	h.lastPlay.Store(c.ID, time.Now())

	// Payload size guard
	if len(env.Payload) > maxSoundPayloadSize {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "payload too large"))
		h.logger.Warn().Int("size", len(env.Payload)).Stringer("playerId", c.ID).
			Msg("sound:play payload exceeds size limit")
		return
	}

	var payload soundPlayPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "invalid sound:play payload"))
		h.logger.Warn().
			Err(err).
			Stringer("playerId", c.ID).
			Msg("invalid sound:play payload")
		return
	}

	if !IsValidSound(payload.SoundID) {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "unknown sound ID"))
		h.logger.Debug().
			Str("soundId", payload.SoundID).
			Stringer("playerId", c.ID).
			Msg("unknown sound ID")
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
		Stringer("playerId", c.ID).
		Stringer("sessionId", c.SessionID).
		Msg("sound:play broadcast")
}
