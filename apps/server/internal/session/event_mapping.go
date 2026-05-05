package session

import (
	"encoding/json"
	"strings"

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

// relayPrefixes is the set of event-type prefixes broadcast to WS clients.
// Anything else (internal engine bookkeeping, test-only events) is dropped.
// Expanded from the hardcoded phase-only list so module events reach clients
// without a curated allowlist (M-3 fix).
var relayPrefixes = []string{
	"phase:",
	"phase.",
	"clue:",
	"clue.",
	"vote:",
	"vote.",
	"game:",
	"game.",
	"player:",
	"player.",
	"module:",
	"module.",
	"ready.",
	"reading.",
	"ending.",
	"audio.",
	"presentation.",
}

// shouldRelay reports whether an engine event type should be broadcast
// to WS clients.
func shouldRelay(eventType string) bool {
	for _, p := range relayPrefixes {
		if strings.HasPrefix(eventType, p) {
			return true
		}
	}
	return false
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
	bus.SubscribeAll(func(evt engine.Event) {
		if !shouldRelay(evt.Type) {
			return
		}
		payload, err := json.Marshal(evt.Payload)
		if err != nil {
			logger.Error().Err(err).
				Str("session_id", sessionID.String()).
				Str("event_type", evt.Type).
				Msg("registerEventMapping: failed to marshal event payload")
			return
		}
		bc.BroadcastToSession(sessionID, BroadcastEnvelope{
			Type:    evt.Type,
			Payload: payload,
		})
	})
}
