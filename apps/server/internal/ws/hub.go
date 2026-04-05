package ws

import (
	"sync"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// Hub manages all connected WebSocket clients, organized by game session.
// It runs a single event-loop goroutine that processes register/unregister
// events, keeping the internal maps free of lock contention.
type Hub struct {
	// sessions maps sessionID → (playerID → Client).
	sessions map[uuid.UUID]map[uuid.UUID]*Client
	// lobby holds clients not yet in a game session.
	lobby map[uuid.UUID]*Client

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
			h.mu.Unlock()
			h.logger.Info().
				Stringer("playerId", client.ID).
				Msg("client registered (lobby)")

		case client := <-h.unregister:
			h.mu.Lock()
			h.removeClientLocked(client)
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
			}
		}
	} else {
		delete(h.lobby, c.ID)
	}
}

// Register queues a client for registration.
func (h *Hub) Register(c *Client) {
	h.register <- c
}

// Unregister queues a client for removal.
func (h *Hub) Unregister(c *Client) {
	h.unregister <- c
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

// BroadcastToSession sends an envelope to every client in the given session.
func (h *Hub) BroadcastToSession(sessionID uuid.UUID, env *Envelope) {
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
	h.mu.RUnlock()

	for _, c := range clients {
		c.SendMessage(env)
	}
}

// SendToPlayer sends an envelope to a specific player by ID.
// Searches sessions first, then lobby.
func (h *Hub) SendToPlayer(playerID uuid.UUID, env *Envelope) {
	h.mu.RLock()
	c := h.findClientLocked(playerID)
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
	target := h.findClientLocked(toID)
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

// findClientLocked searches all sessions and lobby for a player.
// Caller must hold h.mu (read lock).
func (h *Hub) findClientLocked(playerID uuid.UUID) *Client {
	for _, sess := range h.sessions {
		if c, ok := sess[playerID]; ok {
			return c
		}
	}
	if c, ok := h.lobby[playerID]; ok {
		return c
	}
	return nil
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

	count := len(h.lobby)
	for _, sess := range h.sessions {
		count += len(sess)
	}
	return count
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

// Stop shuts down the hub event loop.
func (h *Hub) Stop() {
	close(h.done)
}
