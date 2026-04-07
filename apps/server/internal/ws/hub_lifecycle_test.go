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
	// recordLeave=true so recentLeftAt is populated (mirrors what run() does).
	h.mu.Lock()
	h.removeClientLocked(c, true)
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

	// Disconnect (recordLeave=true so recentLeftAt is populated for reconnect detection).
	h.mu.Lock()
	h.removeClientLocked(c1, true)
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

// TestLifecycle_OnPlayerLeft_ViaRunLoop verifies that the full path
// run() → unregister channel → removeClientLocked → notifyPlayerLeft
// correctly fires OnPlayerLeft with the session captured before removal.
func TestLifecycle_OnPlayerLeft_ViaRunLoop(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	listener := &fakeLifecycleListener{}
	h.RegisterLifecycleListener(listener)

	sessionID := uuid.New()
	playerID := uuid.New()

	// Register client and join session.
	c := newTestClient(h, playerID)
	registerAndWait(h, c)
	h.JoinSession(c, sessionID)

	// Trigger unregister via the channel (the real run-loop path).
	// We can't call Unregister(c) because it calls c.Close() which panics on nil conn.
	// Instead enqueue directly into the unregister channel so run() processes it.
	h.unregister <- c

	// Wait for OnPlayerLeft to arrive.
	if !waitForCondition(t, 500*time.Millisecond, func() bool { return listener.leftCount() == 1 }) {
		t.Fatalf("OnPlayerLeft not fired via run() loop within timeout; got %d calls", listener.leftCount())
	}

	listener.mu.Lock()
	got := listener.leftCalls[0]
	listener.mu.Unlock()

	if got.SessionID != sessionID {
		t.Errorf("run-loop: OnPlayerLeft sessionID = %v, want %v", got.SessionID, sessionID)
	}
	if got.PlayerID != playerID {
		t.Errorf("run-loop: OnPlayerLeft playerID = %v, want %v", got.PlayerID, playerID)
	}
}

// TestLifecycle_LeaveSession_FiresGracefulLeft verifies that a voluntary
// LeaveSession call notifies listeners with OnPlayerLeft(graceful=true).
func TestLifecycle_LeaveSession_FiresGracefulLeft(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	listener := &fakeLifecycleListener{}
	h.RegisterLifecycleListener(listener)

	sessionID := uuid.New()
	playerID := uuid.New()

	c := newTestClient(h, playerID)
	registerAndWait(h, c)
	h.JoinSession(c, sessionID)

	// Voluntary leave — client goes back to lobby.
	h.LeaveSession(c)

	if !waitForCondition(t, 500*time.Millisecond, func() bool { return listener.leftCount() == 1 }) {
		t.Fatalf("OnPlayerLeft not called after LeaveSession; got %d calls", listener.leftCount())
	}

	listener.mu.Lock()
	got := listener.leftCalls[0]
	listener.mu.Unlock()

	if got.SessionID != sessionID {
		t.Errorf("LeaveSession: OnPlayerLeft sessionID = %v, want %v", got.SessionID, sessionID)
	}
	if got.PlayerID != playerID {
		t.Errorf("LeaveSession: OnPlayerLeft playerID = %v, want %v", got.PlayerID, playerID)
	}
	if !got.Graceful {
		t.Error("LeaveSession: OnPlayerLeft graceful = false, want true")
	}
}

// TestLifecycle_GlobalGCSweeper verifies that gcAllRecentLeft() removes stale
// entries from recentLeftAt across all sessions (not just the current one).
func TestLifecycle_GlobalGCSweeper(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	sid1, sid2 := uuid.New(), uuid.New()
	pid1, pid2, pid3 := uuid.New(), uuid.New(), uuid.New()

	stale := time.Now().Add(-(reconnectWindow + time.Second))
	fresh := time.Now().Add(-time.Second) // well within window

	h.mu.Lock()
	h.recentLeftAt[recentLeftKey(sid1, pid1)] = stale // should be swept
	h.recentLeftAt[recentLeftKey(sid2, pid2)] = stale // should be swept
	h.recentLeftAt[recentLeftKey(sid1, pid3)] = fresh // must survive
	h.mu.Unlock()

	h.gcAllRecentLeft()

	h.mu.Lock()
	remaining := len(h.recentLeftAt)
	_, pid3Alive := h.recentLeftAt[recentLeftKey(sid1, pid3)]
	_, pid1Gone := h.recentLeftAt[recentLeftKey(sid1, pid1)]
	_, pid2Gone := h.recentLeftAt[recentLeftKey(sid2, pid2)]
	h.mu.Unlock()

	if remaining != 1 {
		t.Errorf("recentLeftAt len = %d after gcAllRecentLeft, want 1", remaining)
	}
	if !pid3Alive {
		t.Error("fresh entry was incorrectly swept")
	}
	if pid1Gone {
		t.Error("stale entry sid1/pid1 should have been swept but survives")
	}
	if pid2Gone {
		t.Error("stale entry sid2/pid2 should have been swept but survives")
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
