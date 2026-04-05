package ws

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Envelope is the wire format for all WebSocket messages.
// Direction: client→server and server→client.
//
//	{ "type": "game:vote", "payload": {...}, "ts": 1712300000000, "seq": 42 }
type Envelope struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
	TS      int64           `json:"ts"`
	Seq     uint64          `json:"seq"`
}

// NewEnvelope creates a server-originated envelope with the current timestamp.
func NewEnvelope(msgType string, payload any) (*Envelope, error) {
	var raw json.RawMessage
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		raw = b
	}
	return &Envelope{
		Type:    msgType,
		Payload: raw,
		TS:      time.Now().UnixMilli(),
	}, nil
}

// MustEnvelope is like NewEnvelope but panics on marshal error (for static payloads).
func MustEnvelope(msgType string, payload any) *Envelope {
	env, err := NewEnvelope(msgType, payload)
	if err != nil {
		panic("ws: marshal envelope: " + err.Error())
	}
	return env
}

// --- Error protocol ---

// ErrorCode is a numeric code for WebSocket-level errors.
type ErrorCode int

const (
	ErrCodeBadMessage    ErrorCode = 4000
	ErrCodeUnauthorized  ErrorCode = 4001
	ErrCodeSessionFull   ErrorCode = 4002
	ErrCodeRateLimited   ErrorCode = 4003
	ErrCodeInternalError ErrorCode = 4010
	ErrCodeNotFound      ErrorCode = 4004
)

// ErrorPayload is sent as the payload of "error" type messages.
type ErrorPayload struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
}

// NewErrorEnvelope creates an error envelope.
func NewErrorEnvelope(code ErrorCode, msg string) *Envelope {
	return MustEnvelope("error", ErrorPayload{Code: code, Message: msg})
}

// --- System messages ---

const (
	TypePing      = "ping"
	TypePong      = "pong"
	TypeError     = "error"
	TypeConnected = "connected"
	TypeReconnect = "reconnect"
)

// ConnectedPayload is sent on successful connection/reconnection.
type ConnectedPayload struct {
	PlayerID  uuid.UUID `json:"playerId"`
	SessionID uuid.UUID `json:"sessionId,omitempty"`
	Seq       uint64    `json:"seq"` // last known seq for reconnection
}
