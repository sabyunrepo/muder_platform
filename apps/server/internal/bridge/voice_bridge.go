package bridge

import (
	"context"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/domain/voice"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/mmp-platform/server/internal/ws"
)

// VoiceBridge forwards engine voice events to WebSocket clients
// and handles LiveKit room cleanup on session teardown.
// One bridge per game session — created at engine start, torn down at engine stop.
type VoiceBridge struct {
	sessionID    uuid.UUID
	hub          *ws.Hub
	provider     voice.VoiceProvider
	eventBus     *engine.EventBus
	subIDs       []int
	whisperRooms []string
	logger       zerolog.Logger
}

// NewVoiceBridge creates a bridge that subscribes to engine voice events
// and forwards them to WebSocket clients via the Hub.
func NewVoiceBridge(
	sessionID uuid.UUID,
	eventBus *engine.EventBus,
	hub *ws.Hub,
	provider voice.VoiceProvider,
	logger zerolog.Logger,
) *VoiceBridge {
	b := &VoiceBridge{
		sessionID: sessionID,
		hub:       hub,
		provider:  provider,
		eventBus:  eventBus,
		logger:    logger.With().Str("component", "voice_bridge").Stringer("sessionId", sessionID).Logger(),
	}
	b.subscribe()
	return b
}

// subscribe registers handlers for all voice-related engine events.
// Handlers are non-blocking — they build an envelope and broadcast via Hub.
func (b *VoiceBridge) subscribe() {
	events := []string{
		"voice.joined",
		"voice.left",
		"voice.mute_changed",
		"spatial.moved",
	}
	for _, eventType := range events {
		et := eventType // capture
		id := b.eventBus.Subscribe(et, func(event engine.Event) {
			b.forward(et, event.Payload)
		})
		b.subIDs = append(b.subIDs, id)
	}
	b.logger.Info().Int("subscriptions", len(b.subIDs)).Msg("voice bridge started")
}

// forward converts an engine event to a WS envelope and broadcasts to the session.
func (b *VoiceBridge) forward(eventType string, payload any) {
	env, err := ws.NewEnvelope("voice:"+eventType, payload)
	if err != nil {
		b.logger.Error().Err(err).Str("event", eventType).Msg("failed to create envelope")
		return
	}
	b.hub.BroadcastToSession(b.sessionID, env)
}

// AddWhisperRoom registers a whisper room name so it is destroyed on Teardown.
// Call this whenever a whisper room is created for this session.
func (b *VoiceBridge) AddWhisperRoom(name string) {
	b.whisperRooms = append(b.whisperRooms, name)
}

// Teardown unsubscribes from all events and destroys LiveKit rooms for this session.
// Call this when the game engine stops.
func (b *VoiceBridge) Teardown(ctx context.Context) {
	// Unsubscribe from all events.
	for _, id := range b.subIDs {
		b.eventBus.Unsubscribe(id)
	}
	b.subIDs = nil

	// Destroy main room.
	// Room names follow the pattern: {sessionID}_{roomType}
	mainRoom := b.sessionID.String() + "_main"
	if err := b.provider.DestroyRoom(ctx, mainRoom); err != nil {
		b.logger.Warn().Err(err).Str("room", mainRoom).Msg("failed to destroy main room")
	}

	// Destroy all tracked whisper rooms.
	for _, wr := range b.whisperRooms {
		if err := b.provider.DestroyRoom(ctx, wr); err != nil {
			b.logger.Warn().Err(err).Str("room", wr).Msg("failed to destroy whisper room")
		}
	}
	b.whisperRooms = nil

	b.logger.Info().Msg("voice bridge torn down")
}
