package session

import (
	"context"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/rs/zerolog"
)

const (
	// inboxBufferSize is the capacity of the Session inbox channel.
	// Large enough to absorb burst traffic without blocking WS handlers.
	inboxBufferSize = 256

	// snapshotInterval is how often the actor checks whether a dirty snapshot
	// should be flushed to Redis (PR-7 will act on this tick).
	snapshotInterval = 5 * time.Second
)

// Sentinel errors returned by Send so callers (PR-3 BaseModuleHandler) can map
// them to the correct HTTP/WS status codes without string matching.
var (
	// errInboxFull is returned when the session inbox channel is at capacity.
	errInboxFull = apperror.New(
		apperror.ErrSessionInboxFull,
		http.StatusServiceUnavailable,
		"session inbox full — try again shortly",
	)

	// errSessionStopped is returned when Send is called on a stopped session.
	errSessionStopped = apperror.New(
		apperror.ErrSessionStopped,
		http.StatusGone,
		"session has been stopped",
	)

	// errInvalidPayload is returned when a message carries the wrong payload type.
	errInvalidPayload = apperror.New(
		apperror.ErrInvalidPayload,
		http.StatusBadRequest,
		"invalid message payload type",
	)
)

// Session is the single-goroutine actor that owns a PhaseEngine.
// ALL mutations to the engine MUST flow through Session.inbox — no caller
// may hold a reference to the engine and call its methods directly.
//
// Concurrency contract: Session.Run occupies exactly one goroutine. The
// engine field is never accessed from any other goroutine.
type Session struct {
	// ID is the session identifier (1:1 with a room in a single game).
	ID uuid.UUID

	// inbox is the single entry point for all messages directed at this actor.
	inbox chan SessionMessage

	// done is closed when the session exits its event loop (normal stop or abort).
	done chan struct{}

	// engine is NOT thread-safe; only the Run goroutine may call its methods.
	engine *engine.PhaseEngine

	// players tracks per-player connection state.
	players map[uuid.UUID]*PlayerState

	// status is the current lifecycle state. Written atomically by stop() and
	// in the ctx.Done() exit path; read atomically by Status().
	status atomic.Int32

	// panicCount is the cumulative number of panics recovered in handleMessage.
	// Accessed only by the Run goroutine (no lock needed).
	panicCount int

	// onAbort is called by panic_guard when panicCount reaches the abort threshold.
	// Typically set to SessionManager.removeSession.
	onAbort func(uuid.UUID)

	// snapshotFields holds optional Redis persist and hub send dependencies.
	// Populated via injectSnapshot; zero-value means snapshot is disabled.
	snapshotFields

	// runCtx is set atomically on Run entry and exposed via Ctx() so callbacks
	// (e.g., lifecycle listeners) can bound their sends to the session's lifetime
	// instead of context.Background(). Using atomic.Pointer eliminates the data
	// race between Run (writer) and OnPlayerLeft/Rejoined (readers). (H-1 fix)
	runCtx atomic.Pointer[context.Context]

	logger zerolog.Logger
}

// Ctx returns the session's run context. Before Run is called this returns
// context.Background(). Once Run starts it returns the per-session context
// which cancels when the session stops. Safe for concurrent use.
func (s *Session) Ctx() context.Context {
	if p := s.runCtx.Load(); p != nil {
		return *p
	}
	return context.Background()
}

// newSession constructs a Session. Call go s.Run(ctx) to start the actor loop.
func newSession(
	id uuid.UUID,
	eng *engine.PhaseEngine,
	players []PlayerState,
	logger zerolog.Logger,
) *Session {
	playerMap := make(map[uuid.UUID]*PlayerState, len(players))
	for i := range players {
		p := players[i]
		playerMap[p.PlayerID] = &p
	}

	s := &Session{
		ID:      id,
		inbox:   make(chan SessionMessage, inboxBufferSize),
		done:    make(chan struct{}),
		engine:  eng,
		players: playerMap,
		logger:  logger.With().Str("component", "session.actor").Str("session_id", id.String()).Logger(),
	}
	s.status.Store(int32(StatusStarting))
	return s
}

// Run is the actor event loop. It MUST be called in its own goroutine.
// It returns when ctx is cancelled or the done channel is closed.
// On return the done channel is always closed and status is StatusStopped.
func (s *Session) Run(ctx context.Context) {
	s.runCtx.Store(&ctx)
	s.status.Store(int32(StatusRunning))
	s.logger.Info().Msg("session actor started")

	ticker := time.NewTicker(snapshotInterval)
	defer ticker.Stop()

	for {
		select {
		case msg := <-s.inbox:
			s.safeHandleMessage(msg)
		case <-ticker.C:
			s.maybeSnapshot()
		case <-s.done:
			s.logger.Info().Msg("session actor stopped via done channel")
			return
		case <-ctx.Done():
			s.logger.Info().Msg("session actor stopped via context cancellation")
			// stop() is idempotent: closes done and sets StatusStopped atomically.
			// This ensures any caller blocked on <-s.Done() unblocks, and the
			// engine gets an opportunity to clean up via the manager's Stop path.
			s.stop()
			return
		}
	}
}

// Send delivers a message to the session inbox without blocking.
// Returns errSessionStopped if the session is no longer running,
// or errInboxFull if the inbox buffer is at capacity.
func (s *Session) Send(msg SessionMessage) error {
	// Check stopped first to avoid silently buffering into a dead session.
	select {
	case <-s.done:
		return errSessionStopped
	default:
	}

	select {
	case s.inbox <- msg:
		return nil
	default:
		s.logger.Warn().
			Str("session_id", s.ID.String()).
			Int("kind", int(msg.Kind)).
			Msg("session inbox full, message dropped")
		return errInboxFull
	}
}

// Done returns a channel that is closed when the session has stopped.
func (s *Session) Done() <-chan struct{} {
	return s.done
}

// Status returns the current lifecycle state.
// Safe to call from any goroutine (atomic read).
func (s *Session) Status() SessionStatus {
	return SessionStatus(s.status.Load())
}

// stop closes the done channel and atomically marks status as stopped.
// Safe to call multiple times (idempotent via select guard).
func (s *Session) stop() {
	select {
	case <-s.done:
		// already closed — idempotent
	default:
		s.status.Store(int32(StatusStopped))
		close(s.done)
	}
}

// safeHandleMessage wraps handleMessage in a deferred recover so a single
// panicking message cannot kill the session goroutine.
func (s *Session) safeHandleMessage(msg SessionMessage) {
	defer func() {
		if p := recover(); p != nil {
			onPanic(s, p)
		}
	}()
	s.handleMessage(msg)
}

// handleMessage dispatches a SessionMessage to the appropriate engine method.
func (s *Session) handleMessage(msg SessionMessage) {
	var err error

	switch msg.Kind {
	case KindEngineCommand:
		err = s.handleEngineCommand(msg)

	case KindLifecycleLeft:
		err = s.handleLifecycleLeft(msg)

	case KindLifecycleRejoined:
		err = s.handleLifecycleRejoined(msg)

	case KindAdvance:
		var advanced bool
		advanced, err = s.engine.AdvancePhase(msg.Ctx)
		if err == nil && advanced {
			// Phase transition is a critical event — flush snapshot immediately.
			s.flushSnapshot()
		}

	case KindGMOverride:
		// Use exported GMOverridePayload so callers outside the package can
		// construct valid messages. Swallowing an !ok with a zero-value string
		// would silently jump to phase "" — we return a typed error instead.
		p, ok := msg.Payload.(GMOverridePayload)
		if !ok {
			err = errInvalidPayload
		} else {
			err = s.engine.SkipToPhase(msg.Ctx, p.PhaseID)
			if err == nil {
				s.flushSnapshot()
			}
		}

	case KindHandleTrigger:
		// Triggers are handled via PhaseEngine.DispatchAction in the new design.
		// Keep the message kind for backward compatibility; convert to a dispatch.
		tp, ok := msg.Payload.(TriggerPayload)
		if !ok {
			err = errInvalidPayload
		} else {
			err = s.engine.DispatchAction(msg.Ctx, engine.PhaseActionPayload{
				Action: engine.PhaseAction(tp.TriggerType),
				Params: tp.Condition,
			})
			if err == nil {
				s.markDirty()
			}
		}

	case KindCriticalSnapshot:
		s.flushSnapshot()

	case KindSnapshotFor:
		// Player-aware snapshot rebuild — executed inside the actor so the
		// engine (non-thread-safe) is touched from its owning goroutine only.
		s.sendSnapshotForActor(msg.PlayerID)

	case KindEngineStart:
		p, ok := msg.Payload.(EngineStartPayload)
		if !ok {
			err = errInvalidPayload
		} else {
			err = s.engine.Start(msg.Ctx, p.ModuleConfigs)
			if err == nil {
				s.markDirty()
			}
		}

	case KindStop:
		// Flush snapshot before stopping so the last state is durable.
		s.flushSnapshot()
		s.stop()
		// Reply before returning so callers waiting on a KindStop reply don't hang.
		s.replyTo(msg, nil)
		return

	default:
		s.logger.Warn().Int("kind", int(msg.Kind)).Msg("unknown message kind, dropping")
	}

	s.replyTo(msg, err)
}

// replyTo sends err to msg.Reply in a non-blocking select. If the receiver
// has abandoned the channel, the send is dropped with a warning log rather
// than blocking the actor goroutine.
func (s *Session) replyTo(msg SessionMessage, err error) {
	if msg.Reply == nil {
		return
	}
	select {
	case msg.Reply <- err:
	default:
		s.logger.Warn().
			Str("session_id", s.ID.String()).
			Int("kind", int(msg.Kind)).
			Msg("orphaned reply channel, dropping response")
	}
}

func (s *Session) handleEngineCommand(msg SessionMessage) error {
	p, ok := msg.Payload.(EngineCommandPayload)
	if !ok && msg.Payload != nil {
		return errInvalidPayload
	}
	var raw []byte
	if ok {
		raw = p.RawPayload
	}
	return s.engine.HandleMessage(msg.Ctx, msg.PlayerID, msg.ModuleName, msg.MsgType, raw)
}

func (s *Session) handleLifecycleLeft(msg SessionMessage) error {
	if p, ok := s.players[msg.PlayerID]; ok {
		p.Connected = false
		s.logger.Info().Str("player_id", msg.PlayerID.String()).Msg("player left")
	}
	return nil
}

func (s *Session) handleLifecycleRejoined(msg SessionMessage) error {
	if p, ok := s.players[msg.PlayerID]; ok {
		p.Connected = true
		s.logger.Info().Str("player_id", msg.PlayerID.String()).Msg("player rejoined")
	}
	return nil
}

// Ensure atomic.Int32 is used (not the bare int32 field embedded incorrectly).
var _ = (*atomic.Int32)(nil)
