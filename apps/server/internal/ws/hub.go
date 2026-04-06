package ws

import (
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

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

	router *Router
	pubsub PubSub
	logger zerolog.Logger

	mu   sync.RWMutex
	done chan struct{}
}

// NewHub creates a Hub and starts its event loop.
func NewHub(router *Router, pubsub PubSub, logger zerolog.Logger) *Hub {
	h := &Hub{
		sessions:   make(map[uuid.UUID]map[uuid.UUID]*Client),
		lobby:      make(map[uuid.UUID]*Client),
		players:    make(map[uuid.UUID]*Client),
		buffers:    make(map[uuid.UUID]*ReconnectBuffer),
		register:   make(chan *Client, 64),
		unregister: make(chan *Client, 64),
		router:     router,
		pubsub:     pubsub,
		logger:     logger.With().Str("component", "ws.hub").Logger(),
		done:       make(chan struct{}),
	}
	go h.run()
	return h
}

// run is the main event loop. All register/unregister mutations happen here
// to avoid lock contention on the hot path.
func (h *Hub) run() {
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
			h.removeClientLocked(client)
			delete(h.players, client.ID)
			h.mu.Unlock()
			client.Close()
			h.logger.Info().
				Stringer("playerId", client.ID).
				Msg("client unregistered")

		case <-h.done:
			return
		}
	}
}

// removeClientLocked removes the client from lobby or its session.
// Caller must hold h.mu (write lock).
func (h *Hub) removeClientLocked(c *Client) {
	if c.SessionID != uuid.Nil {
		if sess, ok := h.sessions[c.SessionID]; ok {
			delete(sess, c.ID)
			if len(sess) == 0 {
				delete(h.sessions, c.SessionID)
				// Clean up empty session buffer after a delay (keep for reconnection).
			}
		}
	} else {
		delete(h.lobby, c.ID)
	}
}

// Register queues a client for registration. Safe to call after Stop().
func (h *Hub) Register(c *Client) {
	select {
	case h.register <- c:
	case <-h.done:
		c.Close()
	}
}

// Unregister queues a client for removal. Safe to call after Stop().
func (h *Hub) Unregister(c *Client) {
	select {
	case h.unregister <- c:
	case <-h.done:
		c.Close()
	}
}

// JoinSession moves a client from the lobby into a game session.
func (h *Hub) JoinSession(c *Client, sessionID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Remove from current location.
	h.removeClientLocked(c)

	// Add to session.
	c.SessionID = sessionID
	sess, ok := h.sessions[sessionID]
	if !ok {
		sess = make(map[uuid.UUID]*Client)
		h.sessions[sessionID] = sess
	}
	sess[c.ID] = c

	// Ensure session has a reconnect buffer.
	if _, ok := h.buffers[sessionID]; !ok {
		h.buffers[sessionID] = NewReconnectBuffer(reconnectBufferAge, reconnectBufferSize)
	}

	h.logger.Info().
		Stringer("playerId", c.ID).
		Stringer("sessionId", sessionID).
		Msg("client joined session")
}

// LeaveSession moves a client back to the lobby.
func (h *Hub) LeaveSession(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.removeClientLocked(c)
	c.SessionID = uuid.Nil
	h.lobby[c.ID] = c

	h.logger.Info().
		Stringer("playerId", c.ID).
		Msg("client returned to lobby")
}

// BroadcastToSession sends an envelope to every client in the given session
// and records it in the session's reconnection buffer.
func (h *Hub) BroadcastToSession(sessionID uuid.UUID, env *Envelope) {
	h.broadcastToSession(sessionID, env, uuid.Nil, true)
}

// BroadcastToSessionExcept sends an envelope to every client in the session
// except the specified sender, and records it in the reconnection buffer.
func (h *Hub) BroadcastToSessionExcept(sessionID uuid.UUID, env *Envelope, excludeID uuid.UUID) {
	h.broadcastToSession(sessionID, env, excludeID, true)
}

// BroadcastToSessionEphemeral sends an envelope to every client in the session
// but does NOT record it in the reconnection buffer. Use for ephemeral events
// like sound effects that should not be replayed on reconnect.
func (h *Hub) BroadcastToSessionEphemeral(sessionID uuid.UUID, env *Envelope) {
	h.broadcastToSession(sessionID, env, uuid.Nil, false)
}

func (h *Hub) broadcastToSession(sessionID uuid.UUID, env *Envelope, excludeID uuid.UUID, buffer bool) {
	h.mu.RLock()
	sess, ok := h.sessions[sessionID]
	if !ok {
		h.mu.RUnlock()
		return
	}
	// Copy slice under read lock.
	clients := make([]*Client, 0, len(sess))
	for _, c := range sess {
		clients = append(clients, c)
	}
	buf := h.buffers[sessionID]
	h.mu.RUnlock()

	// Push to reconnection buffer before sending.
	if buffer && buf != nil {
		buf.Push(env)
	}

	for _, c := range clients {
		if excludeID != uuid.Nil && c.ID == excludeID {
			continue
		}
		c.SendMessage(env)
	}
}

// ReplayToClient sends missed messages from the session buffer to a reconnecting client.
func (h *Hub) ReplayToClient(c *Client, lastSeq uint64) {
	if c.SessionID == uuid.Nil {
		return
	}

	h.mu.RLock()
	buf := h.buffers[c.SessionID]
	h.mu.RUnlock()

	if buf == nil {
		return
	}

	missed := buf.Since(lastSeq)
	for _, env := range missed {
		c.SendMessage(env)
	}

	h.logger.Debug().
		Stringer("playerId", c.ID).
		Stringer("sessionId", c.SessionID).
		Uint64("lastSeq", lastSeq).
		Int("replayed", len(missed)).
		Msg("replayed missed messages")
}

// SendToPlayer sends an envelope to a specific player by ID. O(1) lookup.
func (h *Hub) SendToPlayer(playerID uuid.UUID, env *Envelope) {
	h.mu.RLock()
	c := h.players[playerID]
	h.mu.RUnlock()

	if c == nil {
		h.logger.Warn().
			Stringer("playerID", playerID).
			Msg("SendToPlayer: player not found")
		return
	}
	c.SendMessage(env)
}

// Whisper sends an envelope from one player to another (private message).
func (h *Hub) Whisper(fromID, toID uuid.UUID, env *Envelope) {
	h.logger.Debug().
		Stringer("from", fromID).
		Stringer("to", toID).
		Str("type", env.Type).
		Msg("whisper")

	h.mu.RLock()
	target := h.players[toID]
	h.mu.RUnlock()

	if target == nil {
		h.logger.Warn().
			Stringer("from", fromID).
			Stringer("to", toID).
			Msg("whisper target not found")
		return
	}
	target.SendMessage(env)
}

// Route dispatches an inbound envelope to the router.
// Called from Client.ReadPump.
func (h *Hub) Route(sender *Client, env *Envelope) {
	if h.router == nil {
		h.logger.Error().Msg("router not set, dropping message")
		sender.SendMessage(NewErrorEnvelope(ErrCodeInternalError, "server misconfigured"))
		return
	}
	h.router.Route(sender, env)
}

// SessionClients returns all clients in a given session.
func (h *Hub) SessionClients(sessionID uuid.UUID) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	sess, ok := h.sessions[sessionID]
	if !ok {
		return nil
	}
	clients := make([]*Client, 0, len(sess))
	for _, c := range sess {
		clients = append(clients, c)
	}
	return clients
}

// ClientCount returns the total number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return len(h.players)
}

// SessionCount returns the number of active sessions.
func (h *Hub) SessionCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return len(h.sessions)
}

// HasSession reports whether a session exists and has at least one client.
func (h *Hub) HasSession(sessionID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	sess, ok := h.sessions[sessionID]
	return ok && len(sess) > 0
}

// SessionBuffer returns the reconnect buffer for a session (or nil).
func (h *Hub) SessionBuffer(sessionID uuid.UUID) *ReconnectBuffer {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return h.buffers[sessionID]
}

// Stop shuts down the hub event loop and closes all connected clients.
func (h *Hub) Stop() {
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
