package ws

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
)

// SessionMessage is the minimal representation of a player action routed from
// the WebSocket layer to a session actor. PR-2 maps this to session.SessionMessage.
type SessionMessage struct {
	// SessionID is the destination session.
	SessionID uuid.UUID
	// PlayerID is the originating player.
	PlayerID uuid.UUID
	// MsgType is the full envelope type (e.g. "game:vote").
	MsgType string
	// Payload is the raw JSON payload from the envelope.
	Payload json.RawMessage
	// Ctx carries the request deadline/cancellation from the WS read pump.
	Ctx context.Context
}

// SessionSender is implemented by the session layer (PR-2: session.SessionManager
// adapter) and injected into the Hub so the WS layer never imports the session
// package directly — avoiding circular dependency.
type SessionSender interface {
	// SendToSession delivers msg to the session actor identified by msg.SessionID.
	// Returns an error if the session does not exist, is stopped, or the inbox
	// is full. The caller (Hub.Route) sends the appropriate WS error back to the
	// client on non-nil return.
	SendToSession(msg SessionMessage) error
}
