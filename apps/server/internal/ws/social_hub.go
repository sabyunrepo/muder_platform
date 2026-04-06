package ws

import (
	"sync"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// compile-time interface check
var _ ClientHub = (*SocialHub)(nil)

// SocialHub manages WebSocket clients for the social system (chat, friends, presence).
// Unlike the game Hub which indexes by sessionID→playerID, SocialHub indexes
// by userID for direct messaging and chatRoom membership for broadcasting.
type SocialHub struct {
	// users maps userID → Client for O(1) direct messaging.
	users map[uuid.UUID]*Client
	// rooms maps chatRoomID → set of userIDs for room-level broadcasting.
	rooms map[uuid.UUID]map[uuid.UUID]struct{}

	register   chan *Client
	unregister chan *Client

	router *Router
	logger zerolog.Logger

	mu   sync.RWMutex
	done chan struct{}
}

// NewSocialHub creates a SocialHub and starts its event loop.
func NewSocialHub(router *Router, logger zerolog.Logger) *SocialHub {
	h := &SocialHub{
		users:      make(map[uuid.UUID]*Client),
		rooms:      make(map[uuid.UUID]map[uuid.UUID]struct{}),
		register:   make(chan *Client, 64),
		unregister: make(chan *Client, 64),
		router:     router,
		logger:     logger.With().Str("component", "ws.social_hub").Logger(),
		done:       make(chan struct{}),
	}
	go h.run()
	return h
}

func (h *SocialHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			// Close existing connection for the same user (single session enforcement).
			if existing, ok := h.users[client.ID]; ok {
				existing.Close()
				h.logger.Info().
					Stringer("userId", client.ID).
					Msg("replaced existing social connection")
			}
			h.users[client.ID] = client
			h.mu.Unlock()
			h.logger.Info().
				Stringer("userId", client.ID).
				Msg("social client registered")

		case client := <-h.unregister:
			h.mu.Lock()
			// Only remove if it's the current client (not a replacement).
			if current, ok := h.users[client.ID]; ok && current == client {
				delete(h.users, client.ID)
				// Remove from all rooms.
				for roomID, members := range h.rooms {
					delete(members, client.ID)
					if len(members) == 0 {
						delete(h.rooms, roomID)
					}
				}
			}
			h.mu.Unlock()
			client.Close()
			h.logger.Info().
				Stringer("userId", client.ID).
				Msg("social client unregistered")

		case <-h.done:
			return
		}
	}
}

// Register queues a client for registration.
func (h *SocialHub) Register(c *Client) {
	select {
	case h.register <- c:
	case <-h.done:
		c.Close()
	}
}

// Unregister queues a client for removal.
func (h *SocialHub) Unregister(c *Client) {
	select {
	case h.unregister <- c:
	case <-h.done:
		c.Close()
	}
}

// Route dispatches an inbound envelope to the router.
func (h *SocialHub) Route(sender *Client, env *Envelope) {
	if h.router == nil {
		h.logger.Error().Msg("router not set, dropping message")
		sender.SendMessage(NewErrorEnvelope(ErrCodeInternalError, "server misconfigured"))
		return
	}
	h.router.Route(sender, env)
}

// JoinRoom adds a user to a chat room for broadcast targeting.
func (h *SocialHub) JoinRoom(roomID, userID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	members, ok := h.rooms[roomID]
	if !ok {
		members = make(map[uuid.UUID]struct{})
		h.rooms[roomID] = members
	}
	members[userID] = struct{}{}
}

// LeaveRoom removes a user from a chat room.
func (h *SocialHub) LeaveRoom(roomID, userID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if members, ok := h.rooms[roomID]; ok {
		delete(members, userID)
		if len(members) == 0 {
			delete(h.rooms, roomID)
		}
	}
}

// SendToUser sends an envelope to a specific user. Returns false if user is offline.
func (h *SocialHub) SendToUser(userID uuid.UUID, env *Envelope) bool {
	h.mu.RLock()
	c := h.users[userID]
	h.mu.RUnlock()

	if c == nil {
		return false
	}
	c.SendMessage(env)
	return true
}

// BroadcastToRoom sends an envelope to all online members of a chat room.
func (h *SocialHub) BroadcastToRoom(roomID uuid.UUID, env *Envelope, excludeID uuid.UUID) {
	h.mu.RLock()
	members, ok := h.rooms[roomID]
	if !ok {
		h.mu.RUnlock()
		return
	}
	// Collect clients under read lock.
	clients := make([]*Client, 0, len(members))
	for uid := range members {
		if uid == excludeID {
			continue
		}
		if c, ok := h.users[uid]; ok {
			clients = append(clients, c)
		}
	}
	h.mu.RUnlock()

	for _, c := range clients {
		c.SendMessage(env)
	}
}

// IsOnline checks if a user has an active social WS connection.
func (h *SocialHub) IsOnline(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.users[userID]
	return ok
}

// OnlineCount returns the number of connected social clients.
func (h *SocialHub) OnlineCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.users)
}

// Stop shuts down the social hub event loop and closes all clients.
func (h *SocialHub) Stop() {
	close(h.done)

	h.mu.Lock()
	for _, c := range h.users {
		c.Close()
	}
	h.users = make(map[uuid.UUID]*Client)
	h.rooms = make(map[uuid.UUID]map[uuid.UUID]struct{})
	h.mu.Unlock()
}
