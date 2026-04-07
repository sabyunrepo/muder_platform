package session

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
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

// Session is the single-goroutine actor that owns a GameProgressionEngine.
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
	engine *engine.GameProgressionEngine

	// players tracks per-player connection state.
	players map[uuid.UUID]*PlayerState

	// status is the current lifecycle state. Written by the Run goroutine only;
	// read atomically by external callers via Status().
	status atomic.Int32

	// panicCount is the cumulative number of panics recovered in handleMessage.
	// Accessed only by the Run goroutine (no lock needed).
	panicCount int

	// onAbort is called by panic_guard when panicCount reaches the abort threshold.
	// Typically set to SessionManager.removeSession.
	onAbort func(uuid.UUID)

	logger zerolog.Logger
}

// newSession constructs a Session. Call go s.Run(ctx) to start the actor loop.
func newSession(
	id uuid.UUID,
	eng *engine.GameProgressionEngine,
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
//
// status is written ONLY inside this goroutine to avoid data races.
func (s *Session) Run(ctx context.Context) {
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
			s.status.Store(int32(StatusStopped))
			return
		}
	}
}

// Send delivers a message to the session inbox.
// It is non-blocking if the inbox has capacity; drops the message and
// returns an error if the inbox is full (back-pressure signal).
func (s *Session) Send(msg SessionMessage) error {
	select {
	case s.inbox <- msg:
		return nil
	default:
		return fmt.Errorf("session %s: inbox full, message dropped (kind=%d)", s.ID, msg.Kind)
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
// Uses atomic.Store so it is safe to call from any goroutine.
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
		_, err = s.engine.Advance(msg.Ctx)
	case KindGMOverride:
		phaseID, _ := msg.Payload.(string)
		err = s.engine.GMOverride(msg.Ctx, phaseID)
	case KindHandleTrigger:
		type triggerPayload struct {
			TriggerType string
			Condition   json.RawMessage
		}
		if tp, ok := msg.Payload.(triggerPayload); ok {
			err = s.engine.HandleTrigger(msg.Ctx, tp.TriggerType, tp.Condition)
		}
	case KindCriticalSnapshot:
		// PR-7 will implement actual snapshot; for now just acknowledge.
		s.logger.Debug().Msg("critical snapshot requested (not yet implemented)")
	case KindStop:
		s.stop()
		return
	default:
		s.logger.Warn().Int("kind", int(msg.Kind)).Msg("unknown message kind")
	}

	if msg.Reply != nil {
		msg.Reply <- err
	}
}

func (s *Session) handleEngineCommand(msg SessionMessage) error {
	var raw json.RawMessage
	if msg.Payload != nil {
		if p, ok := msg.Payload.(EngineCommandPayload); ok {
			raw = p.RawPayload
		}
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

// maybeSnapshot is called on each snapshot ticker tick.
// PR-7 will implement dirty-flag checking and Redis flush.
func (s *Session) maybeSnapshot() {
	// no-op until PR-7
}
