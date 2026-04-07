package session_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/session"
	"github.com/rs/zerolog"
)

// TestPanic_AbortViaManager verifies the full observable lifecycle:
// after the session is stopped (via manager), Done() is closed and
// the session is removed from the manager's active map.
func TestPanic_AbortViaManager(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	sessionID := uuid.New()

	s, err := m.Start(context.Background(), sessionID, uuid.New(), newPlayers(2))
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitRunning(t, s)

	if m.Get(sessionID) == nil {
		t.Fatal("session should be present before stop")
	}

	if err := m.Stop(sessionID); err != nil {
		t.Fatalf("Stop: %v", err)
	}

	select {
	case <-s.Done():
		// correct
	case <-time.After(2 * time.Second):
		t.Fatal("session did not stop in time")
	}

	if m.Get(sessionID) != nil {
		t.Fatal("session should be removed from manager after Stop")
	}
}

// TestPanic_SendOnStoppedSession verifies that Send to a stopped session
// returns a non-nil error immediately (not silently buffered).
func TestPanic_SendOnStoppedSession(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	sessionID := uuid.New()

	s, err := m.Start(context.Background(), sessionID, uuid.New(), newPlayers(1))
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitRunning(t, s)
	m.Stop(sessionID) //nolint:errcheck

	select {
	case <-s.Done():
	case <-time.After(2 * time.Second):
		t.Fatal("session did not stop in time")
	}

	err = s.Send(session.SessionMessage{
		Kind: session.KindLifecycleLeft,
		Ctx:  context.Background(),
	})
	if err == nil {
		t.Fatal("expected error sending to stopped session, got nil")
	}
}
