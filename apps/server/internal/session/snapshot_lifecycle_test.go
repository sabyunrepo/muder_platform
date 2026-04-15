package session_test

import (
	"context"
	"testing"
	"time"

	"github.com/mmp-platform/server/internal/session"
)

// TestSnapshot_KindStopDeletesSnapshot verifies that a graceful KindStop
// removes the Redis snapshot key so PII does not linger for 24h (M-5).
// Separate test file to keep snapshot_test.go under the 200-line limit.
func TestSnapshot_KindStopDeletesSnapshot(t *testing.T) {
	cache := newFakeCache()
	sender := &fakeSender{}
	sessionID, s, _ := startWithSnapshot(t, cache, sender)
	key := "mmp:session:" + sessionID.String() + ":snapshot"

	// Populate a snapshot first via KindCriticalSnapshot.
	reply := make(chan error, 1)
	if err := s.Send(session.SessionMessage{
		Kind: session.KindCriticalSnapshot, Reply: reply, Ctx: context.Background(),
	}); err != nil {
		t.Fatalf("populate Send: %v", err)
	}
	select {
	case err := <-reply:
		if err != nil {
			t.Fatalf("KindCriticalSnapshot: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for KindCriticalSnapshot")
	}

	// Wait for the persist to land.
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) && !cache.hasKey(key) {
		time.Sleep(5 * time.Millisecond)
	}
	if !cache.hasKey(key) {
		t.Fatal("precondition: expected snapshot in cache before KindStop")
	}

	// Graceful stop.
	stopReply := make(chan error, 1)
	if err := s.Send(session.SessionMessage{
		Kind: session.KindStop, Reply: stopReply, Ctx: context.Background(),
	}); err != nil {
		t.Fatalf("stop Send: %v", err)
	}
	select {
	case err := <-stopReply:
		if err != nil {
			t.Fatalf("KindStop: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for KindStop reply")
	}

	// The snapshot key must be gone.
	if cache.hasKey(key) {
		t.Errorf("snapshot key %q still present after KindStop (expected delete)", key)
	}
}

// TestSnapshot_KeyHasMmpNamespacePrefix verifies that snapshots are written
// under the "mmp:session:{id}:snapshot" key (L-4 fix). Old "session:{id}:snapshot"
// keys auto-expire via 24h TTL.
func TestSnapshot_KeyHasMmpNamespacePrefix(t *testing.T) {
	cache := newFakeCache()
	sender := &fakeSender{}
	sessionID, s, m := startWithSnapshot(t, cache, sender)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	reply := make(chan error, 1)
	if err := s.Send(session.SessionMessage{
		Kind: session.KindCriticalSnapshot, Reply: reply, Ctx: context.Background(),
	}); err != nil {
		t.Fatalf("Send: %v", err)
	}
	select {
	case err := <-reply:
		if err != nil {
			t.Fatalf("KindCriticalSnapshot: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for KindCriticalSnapshot reply")
	}

	newKey := "mmp:session:" + sessionID.String() + ":snapshot"
	oldKey := "session:" + sessionID.String() + ":snapshot"

	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) && !cache.hasKey(newKey) {
		time.Sleep(5 * time.Millisecond)
	}

	if !cache.hasKey(newKey) {
		t.Errorf("snapshot not found at namespaced key %q", newKey)
	}
	if cache.hasKey(oldKey) {
		t.Errorf("snapshot written to legacy key %q; should use mmp: prefix", oldKey)
	}
}
