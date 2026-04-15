package session_test

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/session"
	"github.com/mmp-platform/server/internal/ws"
	"github.com/rs/zerolog"
)

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

// fakeCache is an in-memory cache.Provider for tests.
type fakeCache struct {
	mu   sync.Mutex
	data map[string][]byte
	err  error // if non-nil, Set/Get return this error
}

func newFakeCache() *fakeCache {
	return &fakeCache{data: make(map[string][]byte)}
}

func (f *fakeCache) Get(_ context.Context, key string) ([]byte, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return nil, f.err
	}
	v, ok := f.data[key]
	if !ok {
		return nil, errors.New("cache: key not found")
	}
	return v, nil
}

func (f *fakeCache) Set(_ context.Context, key string, value []byte, _ time.Duration) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	f.data[key] = value
	return nil
}

func (f *fakeCache) Del(_ context.Context, keys ...string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, k := range keys {
		delete(f.data, k)
	}
	return nil
}

func (f *fakeCache) Exists(_ context.Context, key string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	_, ok := f.data[key]
	return ok, nil
}

func (f *fakeCache) Ping(_ context.Context) error { return nil }
func (f *fakeCache) Close() error                 { return nil }

func (f *fakeCache) hasKey(key string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	_, ok := f.data[key]
	return ok
}

// fakeSender records SendToPlayer calls.
type fakeSender struct {
	mu       sync.Mutex
	received []*ws.Envelope
	lastID   uuid.UUID
}

func (f *fakeSender) SendToPlayer(playerID uuid.UUID, env *ws.Envelope) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.received = append(f.received, env)
	f.lastID = playerID
}

func (f *fakeSender) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.received)
}

func (f *fakeSender) lastEnvelope() *ws.Envelope {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.received) == 0 {
		return nil
	}
	return f.received[len(f.received)-1]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func startWithSnapshot(t *testing.T, c *fakeCache, sender *fakeSender) (uuid.UUID, *session.Session, *session.SessionManager) {
	t.Helper()
	m := session.NewSessionManager(zerolog.Nop())
	m.InjectSnapshot(c, sender)

	sessionID := uuid.New()
	s, err := m.Start(context.Background(), sessionID, uuid.New(), newPlayers(2))
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitRunning(t, s)
	return sessionID, s, m
}

// ---------------------------------------------------------------------------
// Tests: snapshot serialise / persist
// ---------------------------------------------------------------------------

// TestSnapshot_CriticalSnapshotPersistsToRedis verifies that KindCriticalSnapshot
// causes the session to write a snapshot key into Redis.
func TestSnapshot_CriticalSnapshotPersistsToRedis(t *testing.T) {
	cache := newFakeCache()
	sender := &fakeSender{}
	sessionID, s, m := startWithSnapshot(t, cache, sender)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	reply := make(chan error, 1)
	if err := s.Send(session.SessionMessage{
		Kind:  session.KindCriticalSnapshot,
		Reply: reply,
		Ctx:   context.Background(),
	}); err != nil {
		t.Fatalf("Send: %v", err)
	}

	select {
	case err := <-reply:
		if err != nil {
			t.Fatalf("KindCriticalSnapshot error: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for KindCriticalSnapshot reply")
	}

	// Allow the actor goroutine time to execute persistSnapshot.
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		expectedKey := "session:" + sessionID.String() + ":snapshot"
		if cache.hasKey(expectedKey) {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Errorf("snapshot key not found in Redis after KindCriticalSnapshot")
}

// TestSnapshot_Roundtrip verifies that the persisted JSON can be deserialised
// and contains the expected session ID.
func TestSnapshot_Roundtrip(t *testing.T) {
	fc := newFakeCache()
	sender := &fakeSender{}
	sessionID, s, m := startWithSnapshot(t, fc, sender)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	reply := make(chan error, 1)
	_ = s.Send(session.SessionMessage{Kind: session.KindCriticalSnapshot, Reply: reply, Ctx: context.Background()})
	<-reply

	key := "session:" + sessionID.String() + ":snapshot"
	deadline := time.Now().Add(500 * time.Millisecond)
	var raw []byte
	for time.Now().Before(deadline) {
		if v, err := fc.Get(context.Background(), key); err == nil {
			raw = v
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	if raw == nil {
		t.Fatal("snapshot not persisted")
	}

	var snap map[string]interface{}
	if err := json.Unmarshal(raw, &snap); err != nil {
		t.Fatalf("unmarshal snapshot: %v", err)
	}
	if snap["sessionId"] != sessionID.String() {
		t.Errorf("sessionId mismatch: got %v, want %s", snap["sessionId"], sessionID)
	}
	if _, ok := snap["players"]; !ok {
		t.Error("snapshot missing 'players' field")
	}
	if _, ok := snap["persistedAt"]; !ok {
		t.Error("snapshot missing 'persistedAt' field")
	}
}

// ---------------------------------------------------------------------------
// Tests: reconnect push
// ---------------------------------------------------------------------------

// TestSnapshot_SendSnapshotOnReconnect verifies that OnPlayerRejoined pushes
// the snapshot to the reconnecting player via the sender.
func TestSnapshot_SendSnapshotOnReconnect(t *testing.T) {
	fc := newFakeCache()
	sender := &fakeSender{}
	sessionID, s, m := startWithSnapshot(t, fc, sender)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	// Persist a snapshot first.
	reply := make(chan error, 1)
	_ = s.Send(session.SessionMessage{Kind: session.KindCriticalSnapshot, Reply: reply, Ctx: context.Background()})
	<-reply

	// Wait for Redis write.
	key := "session:" + sessionID.String() + ":snapshot"
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		if fc.hasKey(key) {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}

	playerID := uuid.New()
	m.OnPlayerRejoined(sessionID, playerID)

	// SendSnapshot runs in a goroutine — poll for delivery.
	deadline = time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		if sender.count() > 0 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}

	if sender.count() == 0 {
		t.Fatal("expected snapshot envelope to be sent to reconnecting player, got none")
	}
	env := sender.lastEnvelope()
	if env.Type != "session:state" {
		t.Errorf("envelope type: got %q, want %q", env.Type, "session:state")
	}
}

// TestSnapshot_SendsLivePlayerStateWhenCacheEmpty verifies that for a running
// session SendSnapshot reconstructs the envelope from the live engine via
// BuildStateFor even when Redis has no cached blob yet. (Phase 18.1 B-2)
func TestSnapshot_SendsLivePlayerStateWhenCacheEmpty(t *testing.T) {
	fc := newFakeCache()
	sender := &fakeSender{}
	sessionID, _, m := startWithSnapshot(t, fc, sender)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	playerID := uuid.New()
	m.OnPlayerRejoined(sessionID, playerID)

	// Poll for the actor to flush the player-aware snapshot.
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		if sender.count() > 0 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}

	if sender.count() == 0 {
		t.Fatal("expected live player-aware snapshot to be sent, got none")
	}
	if env := sender.lastEnvelope(); env.Type != "session:state" {
		t.Errorf("envelope type: got %q, want %q", env.Type, "session:state")
	}
}
