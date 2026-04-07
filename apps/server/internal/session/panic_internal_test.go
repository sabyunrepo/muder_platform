package session

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/rs/zerolog"
)

// newBareSession builds a Session with a real (unstarted) engine for white-box
// tests. No goroutine is started — callers invoke onPanic/safeHandleMessage
// directly on the current goroutine.
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

// TestOnPanic_CounterIncrements verifies a single onPanic call increments the
// counter but does NOT close done.
func TestOnPanic_CounterIncrements(t *testing.T) {
	s := newBareSession(t)
	onPanic(s, "test panic 1")

	if s.panicCount != 1 {
		t.Fatalf("panicCount: got %d want 1", s.panicCount)
	}
	select {
	case <-s.done:
		t.Fatal("done closed after 1 panic — should still be open")
	default:
	}
}

// TestOnPanic_TwoPanicsSessionSurvives verifies 2 panics (below threshold)
// leave the session alive.
func TestOnPanic_TwoPanicsSessionSurvives(t *testing.T) {
	s := newBareSession(t)
	onPanic(s, "panic 1")
	onPanic(s, "panic 2")

	if s.panicCount != 2 {
		t.Fatalf("panicCount: got %d want 2", s.panicCount)
	}
	select {
	case <-s.done:
		t.Fatal("done closed after 2 panics — session should be alive")
	default:
	}
}

// TestOnPanic_ThreePanicsAbort verifies that exactly panicAbortThreshold panics
// closes done and calls onAbort with the correct session ID.
func TestOnPanic_ThreePanicsAbort(t *testing.T) {
	s := newBareSession(t)

	var abortID uuid.UUID
	s.onAbort = func(id uuid.UUID) { abortID = id }

	for i := 0; i < panicAbortThreshold; i++ {
		onPanic(s, "panic")
	}

	if s.panicCount != panicAbortThreshold {
		t.Fatalf("panicCount: got %d want %d", s.panicCount, panicAbortThreshold)
	}

	select {
	case <-s.done:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("done not closed after threshold panics")
	}

	if abortID != s.ID {
		t.Fatalf("onAbort: got %v want %v", abortID, s.ID)
	}
	if s.Status() != StatusStopped {
		t.Fatalf("status: got %v want StatusStopped", s.Status())
	}
}

// TestOnPanic_FourthPanicNoDoubleAbort verifies that a 4th panic after abort
// does not panic itself (e.g. double-close of done channel).
func TestOnPanic_FourthPanicNoDoubleAbort(t *testing.T) {
	s := newBareSession(t)
	s.onAbort = func(uuid.UUID) {}

	for i := 0; i < panicAbortThreshold+1; i++ {
		// Must not panic (double-close guard in stop() protects done channel).
		onPanic(s, "panic")
	}

	if s.panicCount != panicAbortThreshold+1 {
		t.Fatalf("panicCount: got %d want %d", s.panicCount, panicAbortThreshold+1)
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
		engine: nil, // nil → nil-pointer dereference on any engine method call
		logger: zerolog.Nop(),
	}
	s.status.Store(int32(StatusRunning))

	msg := SessionMessage{
		Kind:    KindGMOverride,
		Payload: GMOverridePayload{PhaseID: "some_phase"},
	}

	// Must not propagate the panic — the outer recover must catch it.
	escaped := func() (panicked bool) {
		defer func() {
			if r := recover(); r != nil {
				panicked = true
			}
		}()
		s.safeHandleMessage(msg)
		return false
	}()

	if escaped {
		t.Fatal("safeHandleMessage let a panic escape")
	}
	if s.panicCount != 1 {
		t.Fatalf("panicCount: got %d want 1", s.panicCount)
	}
}
