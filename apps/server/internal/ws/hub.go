// Package ws implements the WebSocket transport layer.
//
// Hub is split across three files:
//
//   - hub.go             struct, constructor, event loop, Stop, constants
//   - hub_lifecycle.go   Register/Unregister/Join/Leave + reconnect tracking
//   - lifecycle listener fan-out
//   - hub_broadcast.go   Broadcast/Send/Route + session accessors
//
// Kept together they implement the single `Hub` type and its private `mu`
// invariants — callers only ever see Hub, not individual file layout.
package ws

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// reconnectWindow is how long after a player disconnects that a new JoinSession
// call with the same playerID in the same session is considered a reconnect.
const reconnectWindow = 30 * time.Second

// routeMsgTimeout bounds the SessionMessage.Ctx delivered to the actor so a
// stuck handler can't occupy the goroutine indefinitely (M-1 fix).
const routeMsgTimeout = 10 * time.Second

const (
	// reconnectBufferAge is how long messages are kept for reconnection replay.
	reconnectBufferAge = 60 * time.Second
	// reconnectBufferSize is the max number of messages per session buffer.
	reconnectBufferSize = 1000
)

// compile-time interface check
var _ ClientHub = (*Hub)(nil)

// Hub manages all connected WebSocket clients, organized by game session.
// It runs a single event-loop goroutine that processes register/unregister
// events, keeping the internal maps free of lock contention.
type Hub struct {
	// sessions maps sessionID → (playerID → Client).
	sessions map[uuid.UUID]map[uuid.UUID]*Client
	// lobby holds clients not yet in a game session.
	lobby map[uuid.UUID]*Client
	// players is a global index for O(1) player lookups.
	players map[uuid.UUID]*Client
	// buffers holds per-session reconnection buffers.
	buffers map[uuid.UUID]*ReconnectBuffer

	register   chan *Client
	unregister chan *Client

	router        *Router
	pubsub        PubSub
	registry      *EnvelopeRegistry
	sessionSender SessionSender // nil until PR-2 wires it up
	logger        zerolog.Logger

	mu   sync.RWMutex
	done chan struct{}

	// Lifecycle listener support.
	// lifecycleMu protects lifecycleListeners (separate from mu to avoid
	// priority inversion between the hot-path broadcast lock and listener calls).
	lifecycleMu        sync.RWMutex
	lifecycleListeners []SessionLifecycleListener

	// recentLeftAt tracks when each playerID last disconnected per session,
	// so that JoinSession can detect reconnects within reconnectWindow.
	// Structure: sessionID → playerID → disconnect time.
	// O(1) lookup per (session, player) pair — no prefix scan needed.
	// Protected by mu (same lock as sessions map).
	recentLeftAt map[uuid.UUID]map[uuid.UUID]time.Time

	// closing is set to true when Stop() is called. broadcastToSession checks
	// this flag so it does not write to maps that Stop() is clearing (L-5 fix).
	closing atomic.Bool
}

// NewHub creates a Hub and starts its event loop.
// registry may be nil (no type-checking enforced until one is set via SetRegistry).
// sender may be nil until PR-2 wires the session layer.
func NewHub(router *Router, pubsub PubSub, logger zerolog.Logger) *Hub {
	h := &Hub{
		sessions:     make(map[uuid.UUID]map[uuid.UUID]*Client),
		lobby:        make(map[uuid.UUID]*Client),
		players:      make(map[uuid.UUID]*Client),
		buffers:      make(map[uuid.UUID]*ReconnectBuffer),
		recentLeftAt: make(map[uuid.UUID]map[uuid.UUID]time.Time),
		register:     make(chan *Client, 64),
		unregister:   make(chan *Client, 64),
		router:       router,
		pubsub:       pubsub,
		logger:       logger.With().Str("component", "ws.hub").Logger(),
		done:         make(chan struct{}),
	}
	go h.run()
	return h
}

// SetRegistry attaches an EnvelopeRegistry so that Hub.Route validates message
// types before forwarding. Call before accepting connections.
func (h *Hub) SetRegistry(r *EnvelopeRegistry) {
	h.registry = r
}

// SetSessionSender wires the session delivery layer (PR-2 adapter).
// Messages with a client in a game session are forwarded via this sender.
func (h *Hub) SetSessionSender(s SessionSender) {
	h.sessionSender = s
}

// run is the main event loop. All register/unregister mutations happen here
// to avoid lock contention on the hot path.
func (h *Hub) run() {
	gcTicker := time.NewTicker(time.Minute)
	defer gcTicker.Stop()

	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.lobby[client.ID] = client
			h.players[client.ID] = client
			h.mu.Unlock()
			h.logger.Info().
				Stringer("playerId", client.ID).
				Msg("client registered (lobby)")

		case client := <-h.unregister:
			h.mu.Lock()
			sessionID := client.SessionID // capture before removal clears it
			h.removeClientLocked(client, true)
			delete(h.players, client.ID)
			h.mu.Unlock()
			client.Close()
			h.logger.Info().
				Stringer("playerId", client.ID).
				Msg("client unregistered")
			if sessionID != uuid.Nil {
				h.notifyPlayerLeft(sessionID, client.ID, false)
			}

		case <-gcTicker.C:
			h.gcAllRecentLeft()

		case <-h.done:
			return
		}
	}
}

// Stop shuts down the hub event loop and closes all connected clients.
// It sets closing=true before acquiring the lock so concurrent broadcastToSession
// calls bail out before touching the maps being cleared (L-5 fix).
func (h *Hub) Stop() {
	// Signal broadcast loops to stop before we wipe the maps.
	h.closing.Store(true)
	close(h.done)

	// Close all connected clients to prevent goroutine leaks.
	h.mu.Lock()
	for _, c := range h.players {
		c.Close()
	}
	h.lobby = make(map[uuid.UUID]*Client)
	h.sessions = make(map[uuid.UUID]map[uuid.UUID]*Client)
	h.players = make(map[uuid.UUID]*Client)
	h.buffers = make(map[uuid.UUID]*ReconnectBuffer)
	h.mu.Unlock()
}
