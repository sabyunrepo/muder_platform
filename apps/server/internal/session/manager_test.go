package session_test

import (
	"context"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/session"
	"github.com/rs/zerolog"
)

func newTestManager(t *testing.T) *session.SessionManager {
	t.Helper()
	logger := zerolog.Nop()
	return session.NewSessionManager(logger)
}

func newPlayers(n int) []session.PlayerState {
	players := make([]session.PlayerState, n)
	for i := range players {
		players[i] = session.PlayerState{
			PlayerID:  uuid.New(),
			Connected: true,
		}
	}
	return players
}

func TestSessionManager_StartAndGet(t *testing.T) {
	m := newTestManager(t)
	ctx := context.Background()

	sessionID := uuid.New()
	themeID := uuid.New()
	players := newPlayers(3)

	s, err := m.Start(ctx, sessionID, themeID, players)
	if err != nil {
		t.Fatalf("Start: unexpected error: %v", err)
	}
	if s == nil {
		t.Fatal("Start: returned nil session")
	}
	if s.ID != sessionID {
		t.Fatalf("Start: session ID mismatch: got %v want %v", s.ID, sessionID)
	}
	defer m.Stop(sessionID) //nolint:errcheck

	got := m.Get(sessionID)
	if got == nil {
		t.Fatal("Get: expected session, got nil")
	}
	if got != s {
		t.Fatal("Get: returned different session pointer than Start")
	}
}

func TestSessionManager_StopRemovesSession(t *testing.T) {
	m := newTestManager(t)
	ctx := context.Background()

	sessionID := uuid.New()
	_, err := m.Start(ctx, sessionID, uuid.New(), newPlayers(2))
	if err != nil {
		t.Fatalf("Start: unexpected error: %v", err)
	}

	if err := m.Stop(sessionID); err != nil {
		t.Fatalf("Stop: unexpected error: %v", err)
	}

	if got := m.Get(sessionID); got != nil {
		t.Fatalf("Get after Stop: expected nil, got %v", got)
	}
}

func TestSessionManager_StopNonExistent(t *testing.T) {
	m := newTestManager(t)
	err := m.Stop(uuid.New())
	if err == nil {
		t.Fatal("Stop on non-existent session: expected error, got nil")
	}
}

func TestSessionManager_GetNonExistent(t *testing.T) {
	m := newTestManager(t)
	got := m.Get(uuid.New())
	if got != nil {
		t.Fatalf("Get on non-existent session: expected nil, got %v", got)
	}
}

func TestSessionManager_StartDuplicateSessionIDRejected(t *testing.T) {
	m := newTestManager(t)
	ctx := context.Background()

	sessionID := uuid.New()
	themeID := uuid.New()

	s1, err := m.Start(ctx, sessionID, themeID, newPlayers(1))
	if err != nil {
		t.Fatalf("first Start: unexpected error: %v", err)
	}
	defer m.Stop(sessionID) //nolint:errcheck

	s2, err := m.Start(ctx, sessionID, themeID, newPlayers(1))
	if err == nil {
		t.Fatal("second Start with same sessionID: expected error, got nil")
	}
	if s2 != nil {
		t.Fatal("second Start with same sessionID: expected nil session")
	}
	_ = s1
}

func TestSessionManager_ConcurrentStart(t *testing.T) {
	m := newTestManager(t)
	ctx := context.Background()

	const goroutines = 20
	ids := make([]uuid.UUID, goroutines)
	for i := range ids {
		ids[i] = uuid.New()
	}

	var wg sync.WaitGroup
	errs := make([]error, goroutines)
	sessions := make([]*session.Session, goroutines)

	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		i := i
		go func() {
			defer wg.Done()
			sessions[i], errs[i] = m.Start(ctx, ids[i], uuid.New(), newPlayers(2))
		}()
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("goroutine %d: unexpected error: %v", i, err)
		}
		if sessions[i] == nil {
			t.Errorf("goroutine %d: expected session, got nil", i)
		}
		_ = m.Stop(ids[i])
	}
}

func TestSessionManager_RestoreNotImplemented(t *testing.T) {
	m := newTestManager(t)
	_, err := m.Restore(context.Background(), uuid.New())
	if err == nil {
		t.Fatal("Restore: expected ErrNotImplemented, got nil")
	}
	if err != session.ErrNotImplemented {
		t.Fatalf("Restore: expected ErrNotImplemented, got %v", err)
	}
}
