package auditlog

import (
	"context"
	"sync"
	"sync/atomic"

	"github.com/rs/zerolog"
)

// Logger is the append-only audit log interface.
type Logger interface {
	// Append enqueues an audit event for persistence.
	// Returns an error if validation fails or the internal buffer is full.
	Append(ctx context.Context, evt AuditEvent) error
}

// ---------------------------------------------------------------------------
// NoOpLogger — for tests and environments without DB access.
// ---------------------------------------------------------------------------

// NoOpLogger discards all events without error.
type NoOpLogger struct{}

// Append implements Logger for NoOpLogger; always returns nil.
func (NoOpLogger) Append(_ context.Context, _ AuditEvent) error { return nil }

// ---------------------------------------------------------------------------
// DBLogger — production logger with buffered async flush.
// ---------------------------------------------------------------------------

const defaultBufferSize = 1024

// DBLogger writes audit events to the database via a Store.
// Events are buffered and flushed by an internal goroutine, making
// Append non-blocking under normal load.
type DBLogger struct {
	store     *Store
	ch        chan AuditEvent
	log       zerolog.Logger
	wg        sync.WaitGroup
	startOnce sync.Once
	stopOnce  sync.Once
	stopped   atomic.Bool
	stopCh    chan struct{}
	// persistFn overrides the default store.Append call. Used in tests only.
	persistFn func(AuditEvent)
}

// NewDBLogger constructs a DBLogger. Call Start before using Append.
func NewDBLogger(store *Store, log zerolog.Logger) *DBLogger {
	return &DBLogger{
		store:  store,
		ch:     make(chan AuditEvent, defaultBufferSize),
		log:    log,
		stopCh: make(chan struct{}),
	}
}

// Start launches the background flush goroutine. It is safe to call only once.
func (l *DBLogger) Start() {
	l.startOnce.Do(func() {
		l.wg.Add(1)
		go l.flush()
	})
}

// Stop signals the flush goroutine to drain the buffer and exit.
// Safe to call multiple times. Blocks until all pending events are drained.
//
// Stop sets the stopped gate BEFORE closing stopCh so concurrent Appends
// cannot enqueue events that would race with the drain loop exit.
func (l *DBLogger) Stop() {
	l.stopOnce.Do(func() {
		l.stopped.Store(true)
		close(l.stopCh)
		l.wg.Wait()
	})
}

// Append validates the event and enqueues it for async persistence.
// Returns ErrStopped if the logger has been stopped, or ErrBufferFull if the
// internal channel is at capacity.
func (l *DBLogger) Append(_ context.Context, evt AuditEvent) error {
	if l.stopped.Load() {
		return ErrStopped
	}
	if err := evt.Validate(); err != nil {
		return err
	}
	select {
	case l.ch <- evt:
		return nil
	default:
		l.log.Warn().Msg("auditlog: buffer full, dropping event")
		return ErrBufferFull
	}
}

// flush reads from the channel and persists events until stopCh is closed.
// After stopCh is closed it drains remaining events before returning.
func (l *DBLogger) flush() {
	defer l.wg.Done()
	for {
		select {
		case evt := <-l.ch:
			l.persist(evt)
		case <-l.stopCh:
			// Drain remaining events.
			for {
				select {
				case evt := <-l.ch:
					l.persist(evt)
				default:
					return
				}
			}
		}
	}
}

func (l *DBLogger) persist(evt AuditEvent) {
	if l.persistFn != nil {
		l.persistFn(evt)
		return
	}
	if err := l.store.Append(context.Background(), evt); err != nil {
		l.log.Error().Err(err).
			Str("session_id", evt.SessionID.String()).
			Str("action", string(evt.Action)).
			Msg("auditlog: failed to persist event")
	}
}
