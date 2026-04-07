package ws

import "github.com/google/uuid"

// SessionLifecycleListener is notified when players disconnect or reconnect within
// a game session. It is designed to be implemented by the session package's
// SessionManager, keeping the dependency arrow strictly one-directional:
//
//	ws.Hub  →  SessionLifecycleListener  ←  session.SessionManager
//
// Hub does NOT import or depend on the session package. SessionManager registers
// itself via Hub.RegisterLifecycleListener at startup (in main.go / DI root).
//
// OnPlayerLeft is called when a client's WebSocket connection drops. The graceful
// flag is true when the client sent a clean close frame; false for sudden drops.
//
// OnPlayerRejoined is called when a client with the same playerID reconnects to
// the same session within the reconnect window (30 seconds). After the window
// expires the next JoinSession call is treated as a fresh join, not a reconnect.
type SessionLifecycleListener interface {
	OnPlayerLeft(sessionID, playerID uuid.UUID, graceful bool)
	OnPlayerRejoined(sessionID, playerID uuid.UUID)
}
