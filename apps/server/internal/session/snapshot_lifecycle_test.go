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
	// M-7 + L-4: per-player key prefix under mmp: namespace.
	prefix := "mmp:session:" + sessionID.String() + ":snapshot:"

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

	// Wait for the per-player blobs to land.
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) && !cache.hasAnyKeyWithPrefix(prefix) {
		time.Sleep(5 * time.Millisecond)
	}
	if !cache.hasAnyKeyWithPrefix(prefix) {
		t.Fatal("precondition: expected per-player snapshot blobs in cache before KindStop")
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

	// All per-player snapshot blobs must be gone.
	if cache.hasAnyKeyWithPrefix(prefix) {
		t.Errorf("per-player snapshot keys still present after KindStop (expected delete)")
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

	// M-7 + L-4: blobs are per-player under mmp: namespace.
	newPrefix := "mmp:session:" + sessionID.String() + ":snapshot:"
	oldPrefix := "session:" + sessionID.String() + ":snapshot:"

	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) && !cache.hasAnyKeyWithPrefix(newPrefix) {
		time.Sleep(5 * time.Millisecond)
	}

	if !cache.hasAnyKeyWithPrefix(newPrefix) {
		t.Errorf("snapshot not found under namespaced prefix %q", newPrefix)
	}
	// Legacy un-namespaced keys must not be written. We intentionally avoid a
	// bare prefix check against `session:` because `mmp:session:` also starts
	// with it; instead look for the exact legacy shape.
	for _, k := range cache.keysWithPrefix("session:") {
		if len(k) >= len(oldPrefix) && k[:len(oldPrefix)] == oldPrefix {
			t.Errorf("snapshot written under legacy prefix %q; should use mmp: namespace", oldPrefix)
		}
	}
}
