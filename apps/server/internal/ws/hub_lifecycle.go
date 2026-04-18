package ws

import (
	"fmt"
	"runtime/debug"
	"time"

	"github.com/google/uuid"
)

// removeClientLocked removes the client from lobby or its session.
// When recordLeave is true and the client is in a session, it records the
// departure time in recentLeftAt for reconnect detection. Pass recordLeave=false
// when the client is merely switching sessions (JoinSession path) to avoid
// polluting recentLeftAt with entries that will never be matched.
// Caller must hold h.mu (write lock).
func (h *Hub) removeClientLocked(c *Client, recordLeave bool) {
	if c.SessionID != uuid.Nil {
		if sess, ok := h.sessions[c.SessionID]; ok {
			delete(sess, c.ID)
			if len(sess) == 0 {
				delete(h.sessions, c.SessionID)
				// Keep buffer alive for reconnection replay.
			}
		}
		if recordLeave {
			// Record departure for reconnect window tracking.
			if h.recentLeftAt[c.SessionID] == nil {
				h.recentLeftAt[c.SessionID] = make(map[uuid.UUID]time.Time)
			}
			h.recentLeftAt[c.SessionID][c.ID] = time.Now()
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
// If the same playerID disconnected from this session within reconnectWindow,
// the join is treated as a reconnect and all registered SessionLifecycleListeners
// are notified via OnPlayerRejoined. Otherwise it is a fresh join (no notification).
func (h *Hub) JoinSession(c *Client, sessionID uuid.UUID) {
	h.mu.Lock()

	// Detect reconnect before removing the client from its current location,
	// because removeClientLocked would otherwise overwrite recentLeftAt.
	isReconnect := h.isReconnectLocked(sessionID, c.ID)

	// GC expired entries in recentLeftAt for this session.
	h.gcRecentLeftLocked(sessionID)

	// Remove from current location. recordLeave=false: the player is switching
	// sessions (or joining from lobby), not truly disconnecting, so we must not
	// write a new recentLeftAt entry that would spuriously fire OnPlayerRejoined.
	h.removeClientLocked(c, false)

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

	// Clear the recentLeftAt entry now that the player has rejoined.
	if isReconnect {
		if sub := h.recentLeftAt[sessionID]; sub != nil {
			delete(sub, c.ID)
			if len(sub) == 0 {
				delete(h.recentLeftAt, sessionID)
			}
		}
	}

	h.mu.Unlock()

	h.logger.Info().
		Stringer("playerId", c.ID).
		Stringer("sessionId", sessionID).
		Bool("reconnect", isReconnect).
		Msg("client joined session")

	if isReconnect {
		h.notifyPlayerRejoined(sessionID, c.ID)
	}
}

// isReconnectLocked returns true if the player disconnected from sessionID within
// reconnectWindow. Caller must hold h.mu (read or write).
func (h *Hub) isReconnectLocked(sessionID, playerID uuid.UUID) bool {
	sub, ok := h.recentLeftAt[sessionID]
	if !ok {
		return false
	}
	leftAt, ok := sub[playerID]
	if !ok {
		return false
	}
	return time.Since(leftAt) <= reconnectWindow
}

// gcRecentLeftLocked removes stale entries (older than reconnectWindow) from
// recentLeftAt for the given session. O(P) where P = players in session.
// Caller must hold h.mu (write lock).
func (h *Hub) gcRecentLeftLocked(sessionID uuid.UUID) {
	sub, ok := h.recentLeftAt[sessionID]
	if !ok {
		return
	}
	now := time.Now()
	for playerID, leftAt := range sub {
		if now.Sub(leftAt) > reconnectWindow {
			delete(sub, playerID)
		}
	}
	if len(sub) == 0 {
		delete(h.recentLeftAt, sessionID)
	}
}

// LeaveSession moves a client back to the lobby.
// If the client was in a session, all registered SessionLifecycleListeners are
// notified via OnPlayerLeft(graceful=true) after the lock is released.
func (h *Hub) LeaveSession(c *Client) {
	h.mu.Lock()
	oldSessionID := c.SessionID // capture before removeClientLocked clears it
	h.removeClientLocked(c, true)
	c.SessionID = uuid.Nil
	h.lobby[c.ID] = c
	h.mu.Unlock()

	h.logger.Info().
		Stringer("playerId", c.ID).
		Msg("client returned to lobby")

	if oldSessionID != uuid.Nil {
		h.notifyPlayerLeft(oldSessionID, c.ID, true)
	}
}

// RegisterLifecycleListener registers l to receive player lifecycle callbacks.
// Passing nil is a no-op (ignored silently). Safe to call concurrently.
// Listeners are called in registration order.
func (h *Hub) RegisterLifecycleListener(l SessionLifecycleListener) {
	if l == nil {
		return
	}
	h.lifecycleMu.Lock()
	h.lifecycleListeners = append(h.lifecycleListeners, l)
	h.lifecycleMu.Unlock()
}

// notifyPlayerLeft fires OnPlayerLeft on all registered listeners in a goroutine
// so that the hub event loop is never blocked by slow listener implementations.
// The listener slice is copied under RLock so that concurrent RegisterLifecycleListener
// calls (which may trigger a backing-array reallocation via append) cannot race with
// the goroutine's iteration. A deferred recover() prevents a panicking listener from
// crashing the process.
func (h *Hub) notifyPlayerLeft(sessionID, playerID uuid.UUID, graceful bool) {
	h.lifecycleMu.RLock()
	listeners := append([]SessionLifecycleListener(nil), h.lifecycleListeners...)
	h.lifecycleMu.RUnlock()

	if len(listeners) == 0 {
		return
	}
	go func() {
		defer func() {
			if r := recover(); r != nil {
				// L-6: emit panic value as string to avoid file-path leakage;
				// stack trace logged separately at debug level.
				h.logger.Error().
					Str("panic", fmt.Sprint(r)).
					Stringer("sessionId", sessionID).
					Stringer("playerId", playerID).
					Msg("lifecycle listener panicked in OnPlayerLeft")
				h.logger.Debug().
					Bytes("stack", debug.Stack()).
					Msg("lifecycle listener panic stack (OnPlayerLeft)")
			}
		}()
		for _, l := range listeners {
			l.OnPlayerLeft(sessionID, playerID, graceful)
		}
	}()
}

// notifyPlayerRejoined fires OnPlayerRejoined on all registered listeners in a
// goroutine so that the hub event loop is never blocked.
// Same copy-under-RLock and panic-recovery guarantees as notifyPlayerLeft.
func (h *Hub) notifyPlayerRejoined(sessionID, playerID uuid.UUID) {
	h.lifecycleMu.RLock()
	listeners := append([]SessionLifecycleListener(nil), h.lifecycleListeners...)
	h.lifecycleMu.RUnlock()

	if len(listeners) == 0 {
		return
	}
	go func() {
		defer func() {
			if r := recover(); r != nil {
				// L-6: emit panic value as string to avoid file-path leakage;
				// stack trace logged separately at debug level.
				h.logger.Error().
					Str("panic", fmt.Sprint(r)).
					Stringer("sessionId", sessionID).
					Stringer("playerId", playerID).
					Msg("lifecycle listener panicked in OnPlayerRejoined")
				h.logger.Debug().
					Bytes("stack", debug.Stack()).
					Msg("lifecycle listener panic stack (OnPlayerRejoined)")
			}
		}()
		for _, l := range listeners {
			l.OnPlayerRejoined(sessionID, playerID)
		}
	}()
}

// gcAllRecentLeft removes all recentLeftAt entries older than reconnectWindow.
// Called by the run() event loop once per minute so that stale entries from
// sessions whose players never reconnected are eventually freed.
func (h *Hub) gcAllRecentLeft() {
	now := time.Now()
	h.mu.Lock()
	for sessionID, sub := range h.recentLeftAt {
		for playerID, leftAt := range sub {
			if now.Sub(leftAt) > reconnectWindow {
				delete(sub, playerID)
			}
		}
		if len(sub) == 0 {
			delete(h.recentLeftAt, sessionID)
		}
	}
	h.mu.Unlock()
}
