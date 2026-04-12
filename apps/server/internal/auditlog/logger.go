package auditlog

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

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

const (
	defaultBufferSize     = 1024
	defaultPersistTimeout = 5 * time.Second
)

// queuedEvent wraps the caller ctx alongside the AuditEvent so the flush
// goroutine can propagate cancellation and trace context into persist().
type queuedEvent struct {
	ctx context.Context
	evt AuditEvent
}

// DBLogger writes audit events to the database via a Store.
// Events are buffered and flushed by an internal goroutine, making
// Append non-blocking under normal load.
type DBLogger struct {
	store          *Store
	ch             chan queuedEvent
	log            zerolog.Logger
	wg             sync.WaitGroup
	startOnce      sync.Once
	stopOnce       sync.Once
	stopped        atomic.Bool
	stopCh         chan struct{}
	persistTimeout time.Duration
	// persistFn overrides the default store.Append call. Used in tests only.
	persistFn func(context.Context, AuditEvent) error
}

// DBLoggerOption configures a DBLogger at construction time.
type DBLoggerOption func(*DBLogger)

// WithPersistTimeout overrides the default per-event persist timeout.
// A non-positive duration disables the timeout wrapper entirely.
func WithPersistTimeout(d time.Duration) DBLoggerOption {
	return func(l *DBLogger) {
		l.persistTimeout = d
	}
}

// NewDBLogger constructs a DBLogger. Call Start before using Append.
func NewDBLogger(store *Store, log zerolog.Logger, opts ...DBLoggerOption) *DBLogger {
	l := &DBLogger{
		store:          store,
		ch:             make(chan queuedEvent, defaultBufferSize),
		log:            log,
		stopCh:         make(chan struct{}),
		persistTimeout: defaultPersistTimeout,
	}
	for _, opt := range opts {
		opt(l)
	}
	return l
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
// Returns ErrStopped if the logger has been stopped, the caller ctx error if
// ctx is already cancelled, or ErrBufferFull if the internal channel is at
// capacity.
//
// The caller ctx is carried through to persist() so OTel trace context and
// per-call cancellation survive the async hop through the buffered channel.
func (l *DBLogger) Append(ctx context.Context, evt AuditEvent) error {
	if l.stopped.Load() {
		return ErrStopped
	}
	if err := evt.Validate(); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	select {
	case l.ch <- queuedEvent{ctx: ctx, evt: evt}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
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
		case qe := <-l.ch:
			l.persist(qe)
		case <-l.stopCh:
			// Drain remaining events.
			for {
				select {
				case qe := <-l.ch:
					l.persist(qe)
				default:
					return
				}
			}
		}
	}
}

func (l *DBLogger) persist(qe queuedEvent) {
	ctx := qe.ctx
	if l.persistTimeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, l.persistTimeout)
		defer cancel()
	}
	if l.persistFn != nil {
		if err := l.persistFn(ctx, qe.evt); err != nil {
			l.log.Error().Err(err).
				Str("session_id", qe.evt.SessionID.String()).
				Str("action", string(qe.evt.Action)).
				Msg("auditlog: failed to persist event")
		}
		return
	}
	if err := l.store.Append(ctx, qe.evt); err != nil {
		l.log.Error().Err(err).
			Str("session_id", qe.evt.SessionID.String()).
			Str("action", string(qe.evt.Action)).
			Msg("auditlog: failed to persist event")
	}
}
