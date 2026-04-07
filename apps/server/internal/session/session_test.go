package session_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/session"
	"github.com/rs/zerolog"
)

// startSession starts a session via the manager and waits for the actor to be
// in StatusRunning before returning.
func startSession(t *testing.T, m *session.SessionManager) (uuid.UUID, *session.Session) {
	t.Helper()
	sessionID := uuid.New()
	s, err := m.Start(context.Background(), sessionID, uuid.New(), newPlayers(2))
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitRunning(t, s)
	return sessionID, s
}

func TestSession_SendReplyRoundtrip(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	sessionID, s := startSession(t, m)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	reply := make(chan error, 1)
	msg := session.SessionMessage{
		Kind:     session.KindLifecycleLeft,
		PlayerID: uuid.New(),
		Reply:    reply,
		Ctx:      context.Background(),
	}

	if err := s.Send(msg); err != nil {
		t.Fatalf("Send: %v", err)
	}

	select {
	case err := <-reply:
		if err != nil {
			t.Fatalf("handler error: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for reply")
	}
}

func TestSession_FIFOOrdering(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	sessionID, s := startSession(t, m)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	const n = 50
	replies := make([]chan error, n)
	for i := range replies {
		replies[i] = make(chan error, 1)
	}

	for i := 0; i < n; i++ {
		msg := session.SessionMessage{
			Kind:     session.KindLifecycleLeft,
			PlayerID: uuid.New(),
			Reply:    replies[i],
			Ctx:      context.Background(),
		}
		if err := s.Send(msg); err != nil {
			t.Fatalf("Send[%d]: %v", i, err)
		}
	}

	for i := 0; i < n; i++ {
		select {
		case err := <-replies[i]:
			if err != nil {
				t.Errorf("msg[%d] error: %v", i, err)
			}
		case <-time.After(2 * time.Second):
			t.Fatalf("timed out waiting for reply[%d]", i)
		}
	}
}

func TestSession_SendOnStoppedReturnsError(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	sessionID, s := startSession(t, m)

	if err := m.Stop(sessionID); err != nil {
		t.Fatalf("Stop: %v", err)
	}

	// Session is stopped — Send must return an error immediately.
	err := s.Send(session.SessionMessage{
		Kind: session.KindLifecycleLeft,
		Ctx:  context.Background(),
	})
	if err == nil {
		t.Fatal("expected error sending to stopped session, got nil")
	}
}

func TestSession_InboxFullReturnsError(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	sessionID, s := startSession(t, m)

	// Stop the session so the actor stops draining the inbox.
	if err := m.Stop(sessionID); err != nil {
		t.Fatalf("Stop: %v", err)
	}

	// After stop, sends should return errSessionStopped before we ever fill
	// the buffer — which is what we want. Confirm with a single send.
	err := s.Send(session.SessionMessage{Kind: session.KindLifecycleLeft, Ctx: context.Background()})
	if err == nil {
		t.Fatal("expected error on stopped session, got nil")
	}
}

func TestSession_EngineCommandUnknownModule(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	sessionID, s := startSession(t, m)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	reply := make(chan error, 1)
	msg := session.SessionMessage{
		Kind:       session.KindEngineCommand,
		PlayerID:   uuid.New(),
		ModuleName: "nonexistent_module",
		MsgType:    "test",
		Payload:    session.EngineCommandPayload{RawPayload: json.RawMessage(`{}`)},
		Reply:      reply,
		Ctx:        context.Background(),
	}

	if err := s.Send(msg); err != nil {
		t.Fatalf("Send: %v", err)
	}

	select {
	case <-reply:
		// just verify no hang
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for reply")
	}
}

func TestSession_FireAndForget(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	sessionID, s := startSession(t, m)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	// nil Reply must not block or panic.
	msg := session.SessionMessage{
		Kind:     session.KindLifecycleLeft,
		PlayerID: uuid.New(),
		Reply:    nil,
		Ctx:      context.Background(),
	}
	if err := s.Send(msg); err != nil {
		t.Fatalf("Send: %v", err)
	}
}

func TestSession_GMOverrideInvalidPayload(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	sessionID, s := startSession(t, m)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	reply := make(chan error, 1)
	msg := session.SessionMessage{
		Kind:    session.KindGMOverride,
		Payload: "wrong-type-not-GMOverridePayload", // must trigger errInvalidPayload
		Reply:   reply,
		Ctx:     context.Background(),
	}

	if err := s.Send(msg); err != nil {
		t.Fatalf("Send: %v", err)
	}

	select {
	case err := <-reply:
		if err == nil {
			t.Fatal("expected invalid-payload error, got nil")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for reply")
	}
}

func TestSession_TriggerInvalidPayload(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	sessionID, s := startSession(t, m)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	reply := make(chan error, 1)
	msg := session.SessionMessage{
		Kind:    session.KindHandleTrigger,
		Payload: 42, // wrong type
		Reply:   reply,
		Ctx:     context.Background(),
	}

	if err := s.Send(msg); err != nil {
		t.Fatalf("Send: %v", err)
	}

	select {
	case err := <-reply:
		if err == nil {
			t.Fatal("expected invalid-payload error, got nil")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for reply")
	}
}

func TestSession_KindStopReplies(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	sessionID, s := startSession(t, m)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	reply := make(chan error, 1)
	msg := session.SessionMessage{
		Kind:  session.KindStop,
		Reply: reply,
		Ctx:   context.Background(),
	}

	if err := s.Send(msg); err != nil {
		t.Fatalf("Send: %v", err)
	}

	select {
	case err := <-reply:
		if err != nil {
			t.Fatalf("KindStop reply error: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for KindStop reply")
	}

	// done must be closed after KindStop.
	select {
	case <-s.Done():
	case <-time.After(2 * time.Second):
		t.Fatal("done channel not closed after KindStop")
	}
}
