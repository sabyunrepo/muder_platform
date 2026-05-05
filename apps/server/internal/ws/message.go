package ws

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
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
	ErrCodeNotFound      ErrorCode = 4004
	ErrCodeInternalError ErrorCode = 4010
)

// ErrorPayload is sent as the payload of "error" type messages.
//
// wsgen:payload
type ErrorPayload struct {
	Code          ErrorCode `json:"code"`
	AppCode       string    `json:"app_code,omitempty"`
	Message       string    `json:"message"`
	Severity      string    `json:"severity,omitempty"`
	Retryable     bool      `json:"retryable"`
	UserAction    string    `json:"user_action,omitempty"`
	RequestID     string    `json:"request_id,omitempty"`
	CorrelationID string    `json:"correlation_id,omitempty"`
	Fatal         bool      `json:"fatal"`
}

// NewErrorEnvelope creates an error envelope.
func NewErrorEnvelope(code ErrorCode, msg string) *Envelope {
	return MustEnvelope(TypeError, NewErrorPayload(code, msg))
}

// NewFatalErrorEnvelope creates an error envelope for terminal failures where
// the server will close or invalidate the socket.
func NewFatalErrorEnvelope(code ErrorCode, msg string) *Envelope {
	payload := NewErrorPayload(code, msg)
	payload.Fatal = true
	payload.Retryable = false
	return MustEnvelope(TypeError, payload)
}

// NewAppErrorEnvelope converts an application error into the WebSocket
// ProblemDetail-lite shape. The public message comes from the error registry,
// not AppError.Detail, so game internals are not leaked to other players.
func NewAppErrorEnvelope(appErr *apperror.AppError, fatal bool) *Envelope {
	code := appErrorToWSCode(appErr)
	payload := NewErrorPayload(code, appErr.Detail)
	payload.AppCode = appErr.Code
	payload.Fatal = fatal

	if defn, ok := apperror.LookupDefinition(appErr.Code); ok {
		payload.Message = defn.DefaultKR
		payload.Severity = string(defn.Severity)
		payload.Retryable = defn.Retryable
		payload.UserAction = defn.UserAction
	} else {
		payload.Message = "요청을 처리하지 못했습니다."
	}

	return MustEnvelope(TypeError, payload)
}

// NewErrorPayload is the default WS error contract for transport-level errors.
func NewErrorPayload(code ErrorCode, msg string) ErrorPayload {
	appCode, severity, retryable, userAction := wsErrorMetadata(code)
	correlationID := uuid.NewString()
	return ErrorPayload{
		Code:          code,
		AppCode:       appCode,
		Message:       msg,
		Severity:      severity,
		Retryable:     retryable,
		UserAction:    userAction,
		RequestID:     correlationID,
		CorrelationID: correlationID,
		Fatal:         false,
	}
}

func wsErrorMetadata(code ErrorCode) (appCode, severity string, retryable bool, userAction string) {
	switch code {
	case ErrCodeBadMessage:
		return apperror.ErrBadRequest, string(apperror.SeverityMedium), false, "fix_input"
	case ErrCodeUnauthorized:
		return apperror.ErrUnauthorized, string(apperror.SeverityHigh), false, "login"
	case ErrCodeSessionFull:
		return apperror.ErrGameFull, string(apperror.SeverityMedium), false, "choose_other"
	case ErrCodeRateLimited:
		return apperror.ErrSessionInboxFull, string(apperror.SeverityMedium), true, "retry_later"
	case ErrCodeNotFound:
		return apperror.ErrNotFound, string(apperror.SeverityMedium), false, "refresh"
	case ErrCodeInternalError:
		return apperror.ErrInternal, string(apperror.SeverityHigh), true, "retry_later"
	default:
		return "", string(apperror.SeverityMedium), false, "none"
	}
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
//
// wsgen:payload
type ConnectedPayload struct {
	PlayerID  uuid.UUID `json:"playerId"`
	SessionID uuid.UUID `json:"sessionId,omitempty"`
	Seq       uint64    `json:"seq"` // last known seq for reconnection
}
