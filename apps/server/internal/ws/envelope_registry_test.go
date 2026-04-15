package ws

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
	"github.com/rs/zerolog"
)

// --- EnvelopeRegistry tests ---

func TestEnvelopeRegistry_RegisterAndDecode(t *testing.T) {
	r := NewEnvelopeRegistry()

	type votePayload struct {
		Choice string `json:"choice"`
	}

	r.Register("game:vote", func(raw json.RawMessage) (any, error) {
		var p votePayload
		if err := json.Unmarshal(raw, &p); err != nil {
			return nil, err
		}
		return p, nil
	})

	raw := json.RawMessage(`{"choice":"suspect_a"}`)
	got, err := r.Decode("game:vote", raw)
	if err != nil {
		t.Fatalf("Decode: unexpected error: %v", err)
	}
	p, ok := got.(votePayload)
	if !ok {
		t.Fatalf("Decode: got %T, want votePayload", got)
	}
	if p.Choice != "suspect_a" {
		t.Errorf("Decode: Choice = %q, want %q", p.Choice, "suspect_a")
	}
}

func TestEnvelopeRegistry_UnknownType_ReturnsAppError(t *testing.T) {
	r := NewEnvelopeRegistry()

	_, err := r.Decode("game:unknown", json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("Decode: expected error for unknown type, got nil")
	}

	var appErr *apperror.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("Decode: expected *apperror.AppError, got %T: %v", err, err)
	}
	if appErr.Code != apperror.ErrWSUnknownMessageType {
		t.Errorf("Decode: Code = %q, want %q", appErr.Code, apperror.ErrWSUnknownMessageType)
	}
}

func TestEnvelopeRegistry_IsKnown(t *testing.T) {
	r := NewEnvelopeRegistry()
	r.Register("chat:send", func(raw json.RawMessage) (any, error) { return nil, nil })

	if !r.IsKnown("chat:send") {
		t.Error("IsKnown: expected true for registered type")
	}
	if r.IsKnown("chat:delete") {
		t.Error("IsKnown: expected false for unregistered type")
	}
}

func TestEnvelopeRegistry_DuplicateRegister_SameFnIdempotent(t *testing.T) {
	r := NewEnvelopeRegistry()
	fn := func(raw json.RawMessage) (any, error) { return "ok", nil }

	r.Register("game:start", fn)
	// Second registration of the SAME decoder pointer must not panic
	// (idempotent bootstrap path).
	r.Register("game:start", fn)

	got, err := r.Decode("game:start", json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("Decode: unexpected error: %v", err)
	}
	if got != "ok" {
		t.Errorf("Decode: expected %q, got %v", "ok", got)
	}
}

func TestEnvelopeRegistry_DuplicateRegister_DifferentFnPanics(t *testing.T) {
	r := NewEnvelopeRegistry()
	first := func(raw json.RawMessage) (any, error) { return "first", nil }
	second := func(raw json.RawMessage) (any, error) { return "second", nil }
	r.Register("game:start", first)

	defer func() {
		if rec := recover(); rec == nil {
			t.Error("Register: expected panic on conflicting decoder, got none")
		}
	}()
	// Different decoder for the same type — programmer error, must panic.
	r.Register("game:start", second)
}

func TestEnvelopeRegistry_Decode_RejectsOverlongType(t *testing.T) {
	r := NewEnvelopeRegistry()
	longType := ""
	for i := 0; i <= maxTypeLength; i++ {
		longType += "a"
	}
	if len(longType) <= maxTypeLength {
		t.Fatalf("precondition: fixture length %d must exceed %d", len(longType), maxTypeLength)
	}
	_, err := r.Decode(longType, json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("Decode: expected error for overlong type, got nil")
	}
}

// --- Hub.Route session forwarding tests ---

// stubSessionSender records calls to SendToSession for assertion.
type stubSessionSender struct {
	received []SessionMessage
	err      error
}

func (s *stubSessionSender) SendToSession(msg SessionMessage) error {
	s.received = append(s.received, msg)
	return s.err
}

func TestHub_Route_SessionForwarding_Success(t *testing.T) {
	router := NewRouter(zerolog.Nop())
	h := newTestHub(router)
	defer h.Stop()

	reg := NewEnvelopeRegistry()
	reg.Register("game:vote", func(raw json.RawMessage) (any, error) { return nil, nil })
	h.SetRegistry(reg)

	sender := &stubSessionSender{}
	h.SetSessionSender(sender)

	sessionID := uuid.New()
	playerID := uuid.New()
	c := newTestClient(h, playerID)
	c.SessionID = sessionID

	env := MustEnvelope("game:vote", map[string]string{"choice": "a"})
	h.Route(c, env)

	if len(sender.received) != 1 {
		t.Fatalf("Route: expected 1 forwarded message, got %d", len(sender.received))
	}
	got := sender.received[0]
	if got.SessionID != sessionID {
		t.Errorf("Route: SessionID = %v, want %v", got.SessionID, sessionID)
	}
	if got.PlayerID != playerID {
		t.Errorf("Route: PlayerID = %v, want %v", got.PlayerID, playerID)
	}
	if got.MsgType != "game:vote" {
		t.Errorf("Route: MsgType = %q, want %q", got.MsgType, "game:vote")
	}
	// M-1: the forwarded SessionMessage.Ctx must carry a deadline so a
	// stuck actor handler cannot occupy the goroutine indefinitely.
	if got.Ctx == nil {
		t.Fatal("Route: SessionMessage.Ctx is nil, want a bounded context")
	}
	if _, ok := got.Ctx.Deadline(); !ok {
		t.Error("Route: SessionMessage.Ctx has no deadline (M-1 regression)")
	}
}

func TestHub_Route_UnknownType_Rejected(t *testing.T) {
	router := NewRouter(zerolog.Nop())
	h := newTestHub(router)
	defer h.Stop()

	reg := NewEnvelopeRegistry()
	// Register nothing — all non-system types are unknown.
	h.SetRegistry(reg)

	sender := &stubSessionSender{}
	h.SetSessionSender(sender)

	sessionID := uuid.New()
	playerID := uuid.New()
	c := newTestClient(h, playerID)
	c.SessionID = sessionID

	env := MustEnvelope("game:unknown_action", nil)
	h.Route(c, env)

	// Session sender must NOT have been called.
	if len(sender.received) != 0 {
		t.Errorf("Route: expected 0 forwarded messages for unknown type, got %d", len(sender.received))
	}

	// Client must have received an error envelope.
	errEnv := readEnvelope(c, 100*time.Millisecond)
	if errEnv == nil {
		t.Fatal("Route: expected error envelope to client, got nil")
	}
	if errEnv.Type != TypeError {
		t.Errorf("Route: envelope type = %q, want %q", errEnv.Type, TypeError)
	}
}

func TestHub_Route_NoSessionSender_FallsBackToRouter(t *testing.T) {
	routerCalled := false
	router := NewRouter(zerolog.Nop())
	router.Handle("lobby", func(c *Client, env *Envelope) {
		routerCalled = true
	})
	h := newTestHub(router)
	defer h.Stop()

	// No session sender wired — all messages go to router.
	playerID := uuid.New()
	c := newTestClient(h, playerID)
	// Client NOT in a session (SessionID == uuid.Nil).

	env := MustEnvelope("lobby:join", nil)
	h.Route(c, env)

	if !routerCalled {
		t.Error("Route: expected router to be called for lobby message without session sender")
	}
}
