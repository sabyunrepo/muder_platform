package ws

import (
	"context"

	"github.com/google/uuid"
)

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
	// L-5: if Stop() is in progress, the maps are being cleared — bail early.
	if h.closing.Load() {
		return
	}
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

// Route dispatches an inbound envelope from a client.
// Called from Client.ReadPump.
//
// Routing priority:
//  1. Registry validation — rejects unknown types with WS error 4000.
//  2. Session forwarding — if the client is in a game session AND a
//     SessionSender is wired, the message is delivered to the session actor.
//  3. Router fallback — all other messages (lobby, system) go to the Router.
func (h *Hub) Route(sender *Client, env *Envelope) {
	// 1. Registry validation (when a registry is configured).
	if h.registry != nil && !isSystemType(env.Type) {
		if !h.registry.IsKnown(env.Type) {
			h.logger.Warn().
				Str("type", env.Type).
				Stringer("playerID", sender.ID).
				Msg("unknown message type rejected")
			sender.SendMessage(NewErrorEnvelope(ErrCodeBadMessage, "unknown message type: "+env.Type))
			return
		}
	}

	// 2. Session forwarding for in-session clients.
	if sender.SessionID != uuid.Nil && h.sessionSender != nil {
		// Bound the message context so a stuck handler can't occupy the actor
		// indefinitely (M-1 fix). The inbox is non-blocking, so we can't defer
		// cancel — rely on the timer to self-release at deadline.
		msgCtx, cancel := context.WithTimeout(context.Background(), routeMsgTimeout)
		_ = cancel
		msg := SessionMessage{
			SessionID: sender.SessionID,
			PlayerID:  sender.ID,
			MsgType:   env.Type,
			Payload:   env.Payload,
			Ctx:       msgCtx,
		}
		if err := h.sessionSender.SendToSession(msg); err != nil {
			h.logger.Error().
				Err(err).
				Stringer("sessionID", sender.SessionID).
				Stringer("playerID", sender.ID).
				Str("type", env.Type).
				Msg("session send failed")
			sender.SendMessage(NewErrorEnvelope(ErrCodeInternalError, "failed to deliver message"))
		}
		return
	}

	// 3. Router fallback (lobby messages, system messages, etc.).
	if h.router == nil {
		h.logger.Error().Msg("router not set, dropping message")
		sender.SendMessage(NewErrorEnvelope(ErrCodeInternalError, "server misconfigured"))
		return
	}
	h.router.Route(sender, env)
}

// isSystemType reports whether the envelope type is a built-in system message
// that bypasses registry validation.
func isSystemType(t string) bool {
	switch t {
	case TypePing, TypePong, TypeError, TypeConnected, TypeReconnect:
		return true
	}
	return false
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
