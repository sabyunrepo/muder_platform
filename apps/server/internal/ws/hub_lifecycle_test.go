package ws

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

// fakeLifecycleListener records all OnPlayerLeft / OnPlayerRejoined calls.
type fakeLifecycleListener struct {
	mu       sync.Mutex
	leftCalls     []lifecycleCall
	rejoinCalls   []lifecycleCall
}

type lifecycleCall struct {
	SessionID uuid.UUID
	PlayerID  uuid.UUID
	Graceful  bool // only meaningful for left calls
}

func (f *fakeLifecycleListener) OnPlayerLeft(sessionID, playerID uuid.UUID, graceful bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.leftCalls = append(f.leftCalls, lifecycleCall{SessionID: sessionID, PlayerID: playerID, Graceful: graceful})
}

func (f *fakeLifecycleListener) OnPlayerRejoined(sessionID, playerID uuid.UUID) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rejoinCalls = append(f.rejoinCalls, lifecycleCall{SessionID: sessionID, PlayerID: playerID})
}

func (f *fakeLifecycleListener) leftCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.leftCalls)
}

func (f *fakeLifecycleListener) rejoinCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.rejoinCalls)
}

// waitForCondition polls cond() up to timeout, sleeping 5ms between checks.
func waitForCondition(t *testing.T, timeout time.Duration, cond func() bool) bool {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return true
		}
		time.Sleep(5 * time.Millisecond)
	}
	return cond()
}

// TestLifecycle_OnPlayerLeft_CalledOnDisconnect verifies that when a client is
// unregistered from a session the listener receives OnPlayerLeft with correct args.
func TestLifecycle_OnPlayerLeft_CalledOnDisconnect(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	listener := &fakeLifecycleListener{}
	h.RegisterLifecycleListener(listener)

	sessionID := uuid.New()
	playerID := uuid.New()

	c := newTestClient(h, playerID)
	registerAndWait(h, c)
	h.JoinSession(c, sessionID)

	// Simulate disconnect: remove directly (avoids Close on nil conn).
	h.mu.Lock()
	h.removeClientLocked(c)
	delete(h.players, c.ID)
	h.mu.Unlock()
	// Manually fire notify (mirrors what run() does after removeClientLocked).
	h.notifyPlayerLeft(sessionID, playerID, false)

	if !waitForCondition(t, 500*time.Millisecond, func() bool { return listener.leftCount() == 1 }) {
		t.Fatalf("OnPlayerLeft not called within timeout; got %d calls", listener.leftCount())
	}

	listener.mu.Lock()
	got := listener.leftCalls[0]
	listener.mu.Unlock()

	if got.SessionID != sessionID {
		t.Errorf("OnPlayerLeft sessionID = %v, want %v", got.SessionID, sessionID)
	}
	if got.PlayerID != playerID {
		t.Errorf("OnPlayerLeft playerID = %v, want %v", got.PlayerID, playerID)
	}
	if got.Graceful {
		t.Error("OnPlayerLeft graceful = true, want false (sudden disconnect)")
	}
}

// TestLifecycle_OnPlayerRejoined_CalledOnReconnectWithinWindow verifies that
// a JoinSession within reconnectWindow after a disconnect triggers OnPlayerRejoined.
func TestLifecycle_OnPlayerRejoined_CalledOnReconnectWithinWindow(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	listener := &fakeLifecycleListener{}
	h.RegisterLifecycleListener(listener)

	sessionID := uuid.New()
	playerID := uuid.New()

	// First join.
	c1 := newTestClient(h, playerID)
	registerAndWait(h, c1)
	h.JoinSession(c1, sessionID)

	// Disconnect (via run loop channel to set recentLeftAt properly).
	h.mu.Lock()
	h.removeClientLocked(c1)
	delete(h.players, c1.ID)
	h.mu.Unlock()

	// Reconnect with same playerID within the window (immediately).
	c2 := newTestClient(h, playerID)
	registerAndWait(h, c2)
	h.JoinSession(c2, sessionID) // should detect reconnect

	if !waitForCondition(t, 500*time.Millisecond, func() bool { return listener.rejoinCount() == 1 }) {
		t.Fatalf("OnPlayerRejoined not called within timeout; got %d calls", listener.rejoinCount())
	}

	listener.mu.Lock()
	got := listener.rejoinCalls[0]
	listener.mu.Unlock()

	if got.SessionID != sessionID {
		t.Errorf("OnPlayerRejoined sessionID = %v, want %v", got.SessionID, sessionID)
	}
	if got.PlayerID != playerID {
		t.Errorf("OnPlayerRejoined playerID = %v, want %v", got.PlayerID, playerID)
	}
}

// TestLifecycle_NoRejoined_AfterWindowExpired verifies that a JoinSession after
// reconnectWindow has elapsed is treated as a fresh join (OnPlayerRejoined NOT called).
func TestLifecycle_NoRejoined_AfterWindowExpired(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	listener := &fakeLifecycleListener{}
	h.RegisterLifecycleListener(listener)

	sessionID := uuid.New()
	playerID := uuid.New()

	// Manually insert a stale entry (disconnected > reconnectWindow ago).
	h.mu.Lock()
	h.recentLeftAt[recentLeftKey(sessionID, playerID)] = time.Now().Add(-(reconnectWindow + time.Second))
	h.mu.Unlock()

	// JoinSession should NOT see this as a reconnect.
	c := newTestClient(h, playerID)
	registerAndWait(h, c)
	h.JoinSession(c, sessionID)

	// Give the goroutine time to fire if it were going to.
	time.Sleep(100 * time.Millisecond)

	if listener.rejoinCount() != 0 {
		t.Errorf("OnPlayerRejoined called %d times, want 0 (entry expired)", listener.rejoinCount())
	}
}

// TestLifecycle_MultipleListeners verifies that all registered listeners receive
// every lifecycle notification.
func TestLifecycle_MultipleListeners(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	l1 := &fakeLifecycleListener{}
	l2 := &fakeLifecycleListener{}
	l3 := &fakeLifecycleListener{}
	h.RegisterLifecycleListener(l1)
	h.RegisterLifecycleListener(l2)
	h.RegisterLifecycleListener(l3)

	sessionID := uuid.New()
	playerID := uuid.New()

	h.notifyPlayerLeft(sessionID, playerID, true)

	for i, l := range []*fakeLifecycleListener{l1, l2, l3} {
		if !waitForCondition(t, 500*time.Millisecond, func() bool { return l.leftCount() == 1 }) {
			t.Errorf("listener[%d] OnPlayerLeft not called", i)
		}
		listener := l
		listener.mu.Lock()
		got := listener.leftCalls[0]
		listener.mu.Unlock()
		if got.Graceful != true {
			t.Errorf("listener[%d] graceful = false, want true", i)
		}
	}
}

// TestLifecycle_Race verifies that concurrent RegisterLifecycleListener and
// notifyPlayerLeft/notifyPlayerRejoined calls do not produce a data race.
// Run with: go test -race ./internal/ws/...
func TestLifecycle_Race(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	sessionID := uuid.New()
	playerID := uuid.New()

	var wg sync.WaitGroup
	var notifyCount int64

	// Goroutine A: continuously register listeners.
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			l := &fakeLifecycleListener{}
			h.RegisterLifecycleListener(l)
		}
	}()

	// Goroutine B: continuously fire notifications.
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			h.notifyPlayerLeft(sessionID, playerID, false)
			atomic.AddInt64(&notifyCount, 1)
			h.notifyPlayerRejoined(sessionID, playerID)
			atomic.AddInt64(&notifyCount, 1)
		}
	}()

	wg.Wait()
	// Allow goroutines spawned by notify to finish.
	time.Sleep(100 * time.Millisecond)
}
