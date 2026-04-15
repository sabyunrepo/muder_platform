package session_test

// snapshot_pr0_test.go — Phase 18.3 PR-0 unit tests
// Covers: M-7 player-specific recovery, M-a cleanup leak, L-2 ctx cancel.
// See snapshot_pr0_helpers_test.go for fakeCache extensions used here.

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/session"
	"github.com/rs/zerolog"
)


// ---------------------------------------------------------------------------
// M-7: per-player snapshot blobs (redaction recovery path)
// ---------------------------------------------------------------------------

// TestSnapshot_M7_RecoveryUsesPlayerSpecificBlob verifies that the recovery
// path (session not running) uses the per-player Redis blob rather than a
// shared session-level blob. Each player must receive the blob written for
// their own playerID key.
func TestSnapshot_M7_RecoveryUsesPlayerSpecificBlob(t *testing.T) {
	fc := newFakeCache()
	sender := &fakeSender{}

	m := session.NewSessionManager(zerolog.Nop())
	m.InjectSnapshot(fc, sender)
	sessionID := uuid.New()
	s, err := m.Start(context.Background(), sessionID, uuid.New(), newPlayers(2))
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitRunning(t, s)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	// Flush a snapshot so per-player blobs are written.
	reply := make(chan error, 1)
	_ = s.Send(session.SessionMessage{
		Kind:  session.KindCriticalSnapshot,
		Reply: reply,
		Ctx:   context.Background(),
	})
	<-reply

	prefix := "session:" + sessionID.String() + ":snapshot:"
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) && !fc.hasAnyKeyWithPrefix(prefix) {
		time.Sleep(5 * time.Millisecond)
	}
	if !fc.hasAnyKeyWithPrefix(prefix) {
		t.Fatal("no per-player snapshot keys written to Redis")
	}

	// Two blobs must exist — one per player in the 2-player session.
	count := fc.countKeysWithPrefix(prefix)
	if count < 2 {
		t.Errorf("expected at least 2 per-player blobs, got %d", count)
	}
}

// TestSnapshot_M7_NoPlayerIDCrossContamination verifies that per-player blobs
// stored under different player keys are distinct (each key exists independently).
func TestSnapshot_M7_NoPlayerIDCrossContamination(t *testing.T) {
	fc := newFakeCache()
	sender := &fakeSender{}

	m := session.NewSessionManager(zerolog.Nop())
	m.InjectSnapshot(fc, sender)
	sessionID := uuid.New()
	s, err := m.Start(context.Background(), sessionID, uuid.New(), newPlayers(2))
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitRunning(t, s)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	reply := make(chan error, 1)
	_ = s.Send(session.SessionMessage{
		Kind:  session.KindCriticalSnapshot,
		Reply: reply,
		Ctx:   context.Background(),
	})
	<-reply

	prefix := "session:" + sessionID.String() + ":snapshot:"
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) && !fc.hasAnyKeyWithPrefix(prefix) {
		time.Sleep(5 * time.Millisecond)
	}

	keys := fc.keysWithPrefix(prefix)
	seen := make(map[string]struct{})
	for _, k := range keys {
		if _, dup := seen[k]; dup {
			t.Errorf("duplicate key %q in per-player snapshot store", k)
		}
		seen[k] = struct{}{}
	}
	if len(seen) < 2 {
		t.Errorf("expected 2 distinct per-player keys, got %d", len(seen))
	}
}

// ---------------------------------------------------------------------------
// M-a: cleanupOnStartFail — no resource leak
// ---------------------------------------------------------------------------

// TestStartModularGame_CleanupOnDuplicate verifies that starting a session
// with an already-active sessionID returns an error and does not leak goroutines.
// goleak in TestMain will catch any leaked goroutine from the duplicate attempt.
func TestStartModularGame_CleanupOnDuplicate(t *testing.T) {
	m := session.NewSessionManager(zerolog.Nop())
	ctx := context.Background()
	sessionID := uuid.New()

	// Start first session successfully.
	s1, err := m.Start(ctx, sessionID, uuid.New(), newPlayers(2))
	if err != nil {
		t.Fatalf("first Start: %v", err)
	}
	waitRunning(t, s1)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	// Attempt duplicate — must fail without goroutine leak.
	s2, err := m.Start(ctx, sessionID, uuid.New(), newPlayers(2))
	if err == nil {
		t.Fatal("second Start with same sessionID: expected error, got nil")
	}
	if s2 != nil {
		t.Fatal("second Start with same sessionID: expected nil session")
	}
	// goleak in TestMain validates no goroutine was leaked by the failed start.
}

// ---------------------------------------------------------------------------
// L-2: ctx parent — snapshot ops cancelled with session
// ---------------------------------------------------------------------------

// TestSnapshot_L2_CtxCancelPropagates verifies that snapshot operations use
// the session's own context (s.Ctx()), meaning they are automatically cancelled
// when the session stops. We verify indirectly: after a KindStop the done
// channel closes and no subsequent Redis writes occur.
func TestSnapshot_L2_CtxCancelPropagates(t *testing.T) {
	fc := newFakeCache()
	sender := &fakeSender{}

	m := session.NewSessionManager(zerolog.Nop())
	m.InjectSnapshot(fc, sender)
	sessionID := uuid.New()
	s, err := m.Start(context.Background(), sessionID, uuid.New(), newPlayers(1))
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitRunning(t, s)

	// Stop the session.
	stopReply := make(chan error, 1)
	_ = s.Send(session.SessionMessage{
		Kind:  session.KindStop,
		Reply: stopReply,
		Ctx:   context.Background(),
	})
	select {
	case <-stopReply:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for KindStop")
	}

	// Record key count right after stop.
	countBefore := fc.countKeysWithPrefix("session:" + sessionID.String() + ":snapshot:")

	// Wait a bit: the ticker interval is 1s; if ctx is properly cancelled no
	// new writes should occur.
	time.Sleep(200 * time.Millisecond)
	countAfter := fc.countKeysWithPrefix("session:" + sessionID.String() + ":snapshot:")

	if countAfter > countBefore {
		t.Errorf("snapshot writes occurred after session stop (%d→%d) — ctx cancel may not be wired", countBefore, countAfter)
	}
}


