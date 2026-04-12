package auditlog

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// ---------------------------------------------------------------------------
// mockStore — in-memory Store substitute for unit tests.
// ---------------------------------------------------------------------------

type mockAppender struct {
	appendFn    func(ctx context.Context, evt AuditEvent) error
	appendCount atomic.Int64
}

func (m *mockAppender) append(ctx context.Context, evt AuditEvent) error {
	m.appendCount.Add(1)
	if m.appendFn != nil {
		return m.appendFn(ctx, evt)
	}
	return nil
}

// newTestDBLogger builds a DBLogger that uses a mock persist function.
func newTestDBLogger(ma *mockAppender) *DBLogger {
	l := &DBLogger{
		store:  nil, // not used — persistFn overrides
		ch:     make(chan AuditEvent, defaultBufferSize),
		log:    zerolog.Nop(),
		stopCh: make(chan struct{}),
	}
	l.persistFn = func(evt AuditEvent) {
		_ = ma.append(context.Background(), evt)
	}
	return l
}

func validEvent() AuditEvent {
	return AuditEvent{
		SessionID: uuid.New(),
		Action:    ActionPlayerAction,
		Payload:   json.RawMessage(`{"key":"value"}`),
	}
}

// ---------------------------------------------------------------------------
// NoOpLogger
// ---------------------------------------------------------------------------

func TestNoOpLogger_Append(t *testing.T) {
	var l Logger = NoOpLogger{}
	if err := l.Append(context.Background(), validEvent()); err != nil {
		t.Fatalf("NoOpLogger.Append unexpected error: %v", err)
	}
}

// ---------------------------------------------------------------------------
// DBLogger — Append success
// ---------------------------------------------------------------------------

func TestDBLogger_AppendSuccess(t *testing.T) {
	ma := &mockAppender{}
	l := newTestDBLogger(ma)
	l.Start()
	defer l.Stop()

	evt := validEvent()
	if err := l.Append(context.Background(), evt); err != nil {
		t.Fatalf("Append unexpected error: %v", err)
	}

	// Give the flush goroutine time to process.
	time.Sleep(20 * time.Millisecond)
	if ma.appendCount.Load() != 1 {
		t.Fatalf("expected 1 persisted event, got %d", ma.appendCount.Load())
	}
}

// ---------------------------------------------------------------------------
// DBLogger — validation error is returned synchronously
// ---------------------------------------------------------------------------

func TestDBLogger_ValidationError(t *testing.T) {
	ma := &mockAppender{}
	l := newTestDBLogger(ma)
	l.Start()
	defer l.Stop()

	bad := AuditEvent{} // zero session_id, empty action
	err := l.Append(context.Background(), bad)
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}
}

// ---------------------------------------------------------------------------
// DBLogger — channel overflow back-pressure
// ---------------------------------------------------------------------------

func TestDBLogger_BufferFull(t *testing.T) {
	blockCh := make(chan struct{})
	ma := &mockAppender{
		// Block persist until we signal release.
		appendFn: func(_ context.Context, _ AuditEvent) error {
			<-blockCh
			return nil
		},
	}
	// Tiny buffer (2) so it fills quickly.
	l := &DBLogger{
		store:  nil,
		ch:     make(chan AuditEvent, 2),
		log:    zerolog.Nop(),
		stopCh: make(chan struct{}),
	}
	l.persistFn = func(evt AuditEvent) {
		_ = ma.append(context.Background(), evt)
	}
	l.Start()

	evt := validEvent()
	// First append is immediately consumed by flush goroutine (which then blocks).
	// Give the goroutine time to pick it up before filling the buffer.
	_ = l.Append(context.Background(), evt)
	time.Sleep(10 * time.Millisecond)
	// Now fill the buffer — flush goroutine is blocked so these stay queued.
	_ = l.Append(context.Background(), evt)
	_ = l.Append(context.Background(), evt)
	// Third queued append should hit the full buffer.
	err := l.Append(context.Background(), evt)
	if err != ErrBufferFull {
		t.Fatalf("expected ErrBufferFull, got %v", err)
	}
	// Unblock and clean up.
	close(blockCh)
	close(l.stopCh)
	l.wg.Wait()
}

// ---------------------------------------------------------------------------
// NewDBLogger — public constructor smoke test
// ---------------------------------------------------------------------------

func TestNewDBLogger_Constructor(t *testing.T) {
	// NewDBLogger must not panic and must return a usable logger.
	ma := &mockAppender{}
	store := &Store{} // pool unused — persistFn overrides
	l := NewDBLogger(store, zerolog.Nop())
	if l == nil {
		t.Fatal("NewDBLogger returned nil")
	}
	// Override persist so the nil pool isn't dereferenced.
	l.persistFn = func(evt AuditEvent) {
		_ = ma.append(context.Background(), evt)
	}
	l.Start()
	defer l.Stop()

	if err := l.Append(context.Background(), validEvent()); err != nil {
		t.Fatalf("Append unexpected error: %v", err)
	}
	time.Sleep(30 * time.Millisecond)
	if ma.appendCount.Load() != 1 {
		t.Fatalf("expected 1 persisted event, got %d", ma.appendCount.Load())
	}
}

// ---------------------------------------------------------------------------
// DBLogger — persist error branch (real store returns error)
// ---------------------------------------------------------------------------

func TestDBLogger_PersistError_Logged(t *testing.T) {
	ma := &mockAppender{
		appendFn: func(_ context.Context, _ AuditEvent) error {
			return context.DeadlineExceeded
		},
	}
	l := newTestDBLogger(ma)
	l.Start()
	defer l.Stop()

	if err := l.Append(context.Background(), validEvent()); err != nil {
		t.Fatalf("Append unexpected error: %v", err)
	}
	time.Sleep(30 * time.Millisecond)
	if ma.appendCount.Load() != 1 {
		t.Fatalf("expected persist attempt, got %d", ma.appendCount.Load())
	}
}

// ---------------------------------------------------------------------------
// DBLogger — Stop drains pending events
// ---------------------------------------------------------------------------

func TestDBLogger_StopDrainsPending(t *testing.T) {
	const n = 50
	ma := &mockAppender{}
	l := newTestDBLogger(ma)
	l.Start()

	for i := 0; i < n; i++ {
		if err := l.Append(context.Background(), validEvent()); err != nil {
			t.Fatalf("Append[%d] unexpected error: %v", i, err)
		}
	}
	l.Stop() // must drain all n events before returning

	if got := ma.appendCount.Load(); got != n {
		t.Fatalf("expected %d persisted events after Stop, got %d", n, got)
	}
}

// ---------------------------------------------------------------------------
// DBLogger — Stop is idempotent (double-Stop must not panic on closed chan)
// ---------------------------------------------------------------------------

func TestDBLogger_StopIdempotent(t *testing.T) {
	ma := &mockAppender{}
	l := newTestDBLogger(ma)
	l.Start()

	// Calling Stop multiple times must be safe — no double-close panic.
	l.Stop()
	l.Stop()
	l.Stop()

	// Append after stop must return ErrStopped.
	if err := l.Append(context.Background(), validEvent()); !errors.Is(err, ErrStopped) {
		t.Fatalf("expected ErrStopped after Stop, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// DBLogger — concurrent Append during Stop: no panic, no deadlock, post-Stop
// Appends return ErrStopped instead of racing with the drain loop.
// ---------------------------------------------------------------------------

func TestDBLogger_ConcurrentAppendDuringStop(t *testing.T) {
	ma := &mockAppender{}
	l := newTestDBLogger(ma)
	l.Start()

	const writers = 20
	var wg sync.WaitGroup
	start := make(chan struct{})

	for i := 0; i < writers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			for j := 0; j < 50; j++ {
				err := l.Append(context.Background(), validEvent())
				if errors.Is(err, ErrStopped) {
					return
				}
				// ErrBufferFull is tolerated under contention.
			}
		}()
	}

	close(start)
	// Small scheduling nudge so some Appends land before Stop.
	time.Sleep(2 * time.Millisecond)
	l.Stop()
	wg.Wait()

	// Post-Stop Appends must always return ErrStopped (never panic on a
	// closed channel), and Stop itself must not panic on double-close.
	if err := l.Append(context.Background(), validEvent()); !errors.Is(err, ErrStopped) {
		t.Fatalf("post-Stop Append: expected ErrStopped, got %v", err)
	}
}
