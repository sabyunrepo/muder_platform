package session

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/rs/zerolog"
)

// newBareSession builds a Session with a real (unstarted) engine for white-box tests.
// The session is NOT running a goroutine — tests call onPanic/safeHandleMessage directly.
func newBareSession(t *testing.T) *Session {
	t.Helper()
	id := uuid.New()
	eng := engine.NewEngine(id, &zerologAdapter{logger: zerolog.Nop()})
	s := &Session{
		ID:      id,
		inbox:   make(chan SessionMessage, inboxBufferSize),
		done:    make(chan struct{}),
		engine:  eng,
		players: make(map[uuid.UUID]*PlayerState),
		logger:  zerolog.Nop(),
	}
	s.status.Store(int32(StatusRunning))
	return s
}

// TestOnPanic_CounterIncrements verifies that a single onPanic call increments
// the counter but does NOT close the done channel.
func TestOnPanic_CounterIncrements(t *testing.T) {
	s := newBareSession(t)

	onPanic(s, "test panic 1")

	if s.panicCount != 1 {
		t.Fatalf("panicCount: got %d, want 1", s.panicCount)
	}

	select {
	case <-s.done:
		t.Fatal("done channel closed after only 1 panic — expected still open")
	default:
		// correct: channel still open
	}
}

// TestOnPanic_ThreePanicsAbort verifies that after panicAbortThreshold panics
// the done channel is closed and onAbort is called.
func TestOnPanic_ThreePanicsAbort(t *testing.T) {
	s := newBareSession(t)

	abortCalled := false
	abortID := uuid.Nil
	s.onAbort = func(sid uuid.UUID) {
		abortCalled = true
		abortID = sid
	}

	for i := 0; i < panicAbortThreshold; i++ {
		onPanic(s, "test panic")
	}

	if s.panicCount != panicAbortThreshold {
		t.Fatalf("panicCount: got %d, want %d", s.panicCount, panicAbortThreshold)
	}

	select {
	case <-s.done:
		// correct
	case <-time.After(100 * time.Millisecond):
		t.Fatal("done channel not closed after threshold panics")
	}

	if !abortCalled {
		t.Fatal("onAbort was not called")
	}
	if abortID != s.ID {
		t.Fatalf("onAbort called with wrong ID: got %v, want %v", abortID, s.ID)
	}
	if s.Status() != StatusStopped {
		t.Fatalf("status: got %v, want StatusStopped", s.Status())
	}
}

// TestOnPanic_TwoPanicsSessionSurvives verifies that 2 panics (below threshold)
// leave the session alive.
func TestOnPanic_TwoPanicsSessionSurvives(t *testing.T) {
	s := newBareSession(t)

	onPanic(s, "panic 1")
	onPanic(s, "panic 2")

	if s.panicCount != 2 {
		t.Fatalf("panicCount: got %d, want 2", s.panicCount)
	}

	select {
	case <-s.done:
		t.Fatal("done closed after only 2 panics — session should still be alive")
	default:
		// correct
	}
}

// TestSafeHandleMessage_RecoversPanic verifies that a nil-engine panic inside
// handleMessage does NOT escape safeHandleMessage.
func TestSafeHandleMessage_RecoversPanic(t *testing.T) {
	id := uuid.New()
	s := &Session{
		ID:     id,
		inbox:  make(chan SessionMessage, inboxBufferSize),
		done:   make(chan struct{}),
		engine: nil, // nil engine causes nil-pointer dereference on use
		logger: zerolog.Nop(),
	}
	s.status.Store(int32(StatusRunning))

	msg := SessionMessage{
		Kind:    KindGMOverride,
		Payload: "some_phase",
	}

	// Must not propagate the panic.
	didPanic := func() (panicked bool) {
		defer func() {
			if r := recover(); r != nil {
				panicked = true
			}
		}()
		s.safeHandleMessage(msg)
		return false
	}()

	if didPanic {
		t.Fatal("safeHandleMessage let a panic escape — recover did not work")
	}

	if s.panicCount != 1 {
		t.Fatalf("panicCount: got %d, want 1", s.panicCount)
	}
}
