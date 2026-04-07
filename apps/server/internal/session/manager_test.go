package session_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/session"
	"github.com/rs/zerolog"
)

func newTestManager(t *testing.T) *session.SessionManager {
	t.Helper()
	return session.NewSessionManager(zerolog.Nop())
}

func newPlayers(n int) []session.PlayerState {
	players := make([]session.PlayerState, n)
	for i := range players {
		players[i] = session.PlayerState{PlayerID: uuid.New(), Connected: true}
	}
	return players
}

// waitRunning polls until s.Status() == StatusRunning or the deadline passes.
func waitRunning(t *testing.T, s *session.Session) {
	t.Helper()
	for i := 0; i < 200; i++ {
		if s.Status() == session.StatusRunning {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("session did not reach StatusRunning within 200ms")
}

func TestSessionManager_StartAndGet(t *testing.T) {
	m := newTestManager(t)
	ctx := context.Background()

	sessionID := uuid.New()
	s, err := m.Start(ctx, sessionID, uuid.New(), newPlayers(3))
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	if s == nil {
		t.Fatal("Start returned nil")
	}
	if s.ID != sessionID {
		t.Fatalf("ID mismatch: got %v want %v", s.ID, sessionID)
	}
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	got := m.Get(sessionID)
	if got == nil {
		t.Fatal("Get returned nil")
	}
	if got != s {
		t.Fatal("Get returned different pointer than Start")
	}
}

func TestSessionManager_StopRemovesSession(t *testing.T) {
	m := newTestManager(t)
	sessionID := uuid.New()

	s, err := m.Start(context.Background(), sessionID, uuid.New(), newPlayers(2))
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitRunning(t, s)

	if err := m.Stop(sessionID); err != nil {
		t.Fatalf("Stop: %v", err)
	}
	if got := m.Get(sessionID); got != nil {
		t.Fatalf("Get after Stop: expected nil, got %v", got)
	}
}

func TestSessionManager_StopNonExistent(t *testing.T) {
	m := newTestManager(t)
	if err := m.Stop(uuid.New()); err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestSessionManager_GetNonExistent(t *testing.T) {
	m := newTestManager(t)
	if got := m.Get(uuid.New()); got != nil {
		t.Fatalf("expected nil, got %v", got)
	}
}

func TestSessionManager_StartDuplicateRejected(t *testing.T) {
	m := newTestManager(t)
	ctx := context.Background()
	sessionID := uuid.New()

	s1, err := m.Start(ctx, sessionID, uuid.New(), newPlayers(1))
	if err != nil {
		t.Fatalf("first Start: %v", err)
	}
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	s2, err := m.Start(ctx, sessionID, uuid.New(), newPlayers(1))
	if err == nil {
		t.Fatal("second Start: expected error, got nil")
	}
	if s2 != nil {
		t.Fatal("second Start: expected nil session")
	}
	_ = s1
}

// TestSessionManager_ConcurrentStartDifferentIDs starts 20 sessions with
// different IDs concurrently — all must succeed.
func TestSessionManager_ConcurrentStartDifferentIDs(t *testing.T) {
	m := newTestManager(t)
	ctx := context.Background()
	const n = 20

	ids := make([]uuid.UUID, n)
	for i := range ids {
		ids[i] = uuid.New()
	}

	var wg sync.WaitGroup
	errs := make([]error, n)
	sessions := make([]*session.Session, n)

	wg.Add(n)
	for i := 0; i < n; i++ {
		i := i
		go func() {
			defer wg.Done()
			sessions[i], errs[i] = m.Start(ctx, ids[i], uuid.New(), newPlayers(2))
		}()
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("[%d] unexpected error: %v", i, err)
		}
		if sessions[i] == nil {
			t.Errorf("[%d] nil session", i)
		}
		m.Stop(ids[i]) //nolint:errcheck
	}
}

// TestSessionManager_ConcurrentStartSameID races N goroutines all trying to
// Start the same sessionID — exactly one must win; the rest get an error.
func TestSessionManager_ConcurrentStartSameID(t *testing.T) {
	m := newTestManager(t)
	ctx := context.Background()
	sessionID := uuid.New()

	const n = 20
	var wg sync.WaitGroup
	errs := make([]error, n)
	sessions := make([]*session.Session, n)

	wg.Add(n)
	for i := 0; i < n; i++ {
		i := i
		go func() {
			defer wg.Done()
			sessions[i], errs[i] = m.Start(ctx, sessionID, uuid.New(), newPlayers(2))
		}()
	}
	wg.Wait()

	winners := 0
	for i := 0; i < n; i++ {
		if errs[i] == nil {
			winners++
		}
	}
	if winners != 1 {
		t.Fatalf("expected exactly 1 winner, got %d", winners)
	}
	m.Stop(sessionID) //nolint:errcheck
}

func TestSessionManager_RestoreNotImplemented(t *testing.T) {
	m := newTestManager(t)
	_, err := m.Restore(context.Background(), uuid.New())
	if err != session.ErrNotImplemented {
		t.Fatalf("expected ErrNotImplemented, got %v", err)
	}
}

func TestSessionManager_StopWaitsForGoroutine(t *testing.T) {
	m := newTestManager(t)
	sessionID := uuid.New()

	s, err := m.Start(context.Background(), sessionID, uuid.New(), newPlayers(1))
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitRunning(t, s)

	if err := m.Stop(sessionID); err != nil {
		t.Fatalf("Stop: %v", err)
	}

	// After Stop returns, the done channel must already be closed.
	select {
	case <-s.Done():
		// correct
	default:
		t.Fatal("done channel not closed after Stop returned")
	}
}
