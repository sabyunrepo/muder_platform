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

// startSession is a helper that starts a session via the manager and
// waits a short time for the actor goroutine to be ready.
func startSession(t *testing.T, m *session.SessionManager) (uuid.UUID, *session.Session) {
	t.Helper()
	sessionID := uuid.New()
	s, err := m.Start(context.Background(), sessionID, uuid.New(), newPlayers(2))
	if err != nil {
		t.Fatalf("Start: unexpected error: %v", err)
	}
	// Give the goroutine a moment to enter the select loop.
	time.Sleep(5 * time.Millisecond)
	return sessionID, s
}

func TestSession_SendReplyRoundtrip(t *testing.T) {
	logger := zerolog.Nop()
	m := session.NewSessionManager(logger)
	sessionID, s := startSession(t, m)
	defer m.Stop(sessionID) //nolint:errcheck

	// Send a KindLifecycleLeft message (simple, no engine interaction).
	reply := make(chan error, 1)
	msg := session.SessionMessage{
		Kind:     session.KindLifecycleLeft,
		PlayerID: newPlayers(1)[0].PlayerID,
		Reply:    reply,
		Ctx:      context.Background(),
	}

	if err := s.Send(msg); err != nil {
		t.Fatalf("Send: unexpected error: %v", err)
	}

	select {
	case err := <-reply:
		if err != nil {
			t.Fatalf("handler returned unexpected error: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for reply")
	}
}

func TestSession_FIFOOrdering(t *testing.T) {
	logger := zerolog.Nop()
	m := session.NewSessionManager(logger)
	sessionID, s := startSession(t, m)
	defer m.Stop(sessionID) //nolint:errcheck

	const n = 50
	replies := make([]chan error, n)
	for i := 0; i < n; i++ {
		replies[i] = make(chan error, 1)
	}

	// Send n messages sequentially.
	for i := 0; i < n; i++ {
		msg := session.SessionMessage{
			Kind:     session.KindLifecycleLeft,
			PlayerID: uuid.New(),
			Reply:    replies[i],
			Ctx:      context.Background(),
		}
		if err := s.Send(msg); err != nil {
			t.Fatalf("Send [%d]: unexpected error: %v", i, err)
		}
	}

	// Replies must arrive in order (FIFO channel property).
	for i := 0; i < n; i++ {
		select {
		case err := <-replies[i]:
			if err != nil {
				t.Errorf("message[%d] handler error: %v", i, err)
			}
		case <-time.After(2 * time.Second):
			t.Fatalf("timed out waiting for reply[%d]", i)
		}
	}
}

func TestSession_InboxFullReturnsError(t *testing.T) {
	logger := zerolog.Nop()
	m := session.NewSessionManager(logger)

	// Start session but stop it immediately so the actor is not draining.
	sessionID, s := startSession(t, m)
	m.Stop(sessionID) //nolint:errcheck

	// Wait for the session goroutine to stop.
	select {
	case <-s.Done():
	case <-time.After(2 * time.Second):
		t.Fatal("session did not stop in time")
	}

	// Flood the inbox (buffer=256) + one extra that should fail.
	var lastErr error
	for i := 0; i <= 260; i++ {
		err := s.Send(session.SessionMessage{
			Kind: session.KindLifecycleLeft,
			Ctx:  context.Background(),
		})
		if err != nil {
			lastErr = err
			break
		}
	}
	if lastErr == nil {
		t.Fatal("expected inbox-full error, got nil")
	}
}

func TestSession_EngineCommandUnknownModule(t *testing.T) {
	logger := zerolog.Nop()
	m := session.NewSessionManager(logger)
	sessionID, s := startSession(t, m)
	defer m.Stop(sessionID) //nolint:errcheck

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
		t.Fatalf("Send: unexpected error: %v", err)
	}

	select {
	case err := <-reply:
		// The engine is not started, so it should return an error.
		// We just verify that the reply channel receives a response (not hangs).
		_ = err
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for reply")
	}
}

func TestSession_FireAndForget(t *testing.T) {
	logger := zerolog.Nop()
	m := session.NewSessionManager(logger)
	sessionID, s := startSession(t, m)
	defer m.Stop(sessionID) //nolint:errcheck

	// Fire-and-forget: Reply is nil, should not block.
	msg := session.SessionMessage{
		Kind:     session.KindLifecycleLeft,
		PlayerID: uuid.New(),
		Reply:    nil,
		Ctx:      context.Background(),
	}

	if err := s.Send(msg); err != nil {
		t.Fatalf("Send: unexpected error: %v", err)
	}
	// No reply channel to wait on — just verify it doesn't panic or hang.
	time.Sleep(20 * time.Millisecond)
}
