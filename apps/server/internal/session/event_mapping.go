package session

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/rs/zerolog"
)

// Broadcaster is the subset of ws.Hub used by startModularGame to relay
// engine events to connected WebSocket clients.
// Using an interface keeps the session package free of a direct import on ws.
type Broadcaster interface {
	BroadcastToSession(sessionID uuid.UUID, env BroadcastEnvelope)
}

// BroadcastEnvelope is the minimal envelope type the Broadcaster needs.
// It mirrors ws.Envelope without importing the ws package.
type BroadcastEnvelope struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// engineEventTypes is the set of engine events relayed to WS clients.
var engineEventTypes = []string{
	"phase:entered",
	"phase:exiting",
}

// registerEventMapping subscribes to engine events and relays them as WS
// broadcasts. Each event is serialised to JSON and sent via the Broadcaster.
// This function is safe to call before PhaseEngine.Start — the EventBus
// accepts subscriptions before the first Publish.
func registerEventMapping(
	sessionID uuid.UUID,
	bus *engine.EventBus,
	bc Broadcaster,
	logger zerolog.Logger,
) {
	for _, evtType := range engineEventTypes {
		t := evtType // capture loop variable
		bus.Subscribe(t, func(evt engine.Event) {
			payload, err := json.Marshal(evt.Payload)
			if err != nil {
				logger.Error().Err(err).
					Str("session_id", sessionID.String()).
					Str("event_type", t).
					Msg("registerEventMapping: failed to marshal event payload")
				return
			}
			bc.BroadcastToSession(sessionID, BroadcastEnvelope{
				Type:    t,
				Payload: payload,
			})
		})
	}
}
