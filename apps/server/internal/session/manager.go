package session

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/mmp-platform/server/internal/infra/cache"
	"github.com/rs/zerolog"
)

// ErrNotImplemented is returned by Restore until PR-7 implements snapshot restore.
var ErrNotImplemented = errors.New("session: Restore not implemented (pending PR-7)")

// errSessionAlreadyActive is returned when Start is called for a sessionID that already has a running Session.
var errSessionAlreadyActive = apperror.New(
	apperror.ErrConflict,
	http.StatusConflict,
	"session already active for this room",
)

// errSessionNotFound is returned by Stop when the sessionID is not present.
var errSessionNotFound = apperror.New(
	apperror.ErrSessionNotFound,
	http.StatusNotFound,
	"session not found",
)

// stopTimeout is the maximum time Stop waits for the session goroutine to exit.
const stopTimeout = 5 * time.Second

// SessionManager owns the lifecycle of all active Session actors.
// It is safe for concurrent use; its internal mutex protects only the sessions
// map — it never touches Session-internal state directly.
type SessionManager struct {
	mu       sync.Mutex
	sessions map[uuid.UUID]*Session
	logger   zerolog.Logger

	// snapshot dependencies — optional; set via InjectSnapshot before Start calls.
	snapshotCache  cache.Provider
	snapshotSender ClientSender
}

// NewSessionManager creates an idle SessionManager.
func NewSessionManager(logger zerolog.Logger) *SessionManager {
	return &SessionManager{
		sessions: make(map[uuid.UUID]*Session),
		logger:   logger.With().Str("component", "session.manager").Logger(),
	}
}

// Start creates a new Session for sessionID, launches its goroutine, and
// returns the Session. Returns an error if a session for sessionID is already active.
func (m *SessionManager) Start(
	ctx context.Context,
	sessionID uuid.UUID,
	themeID uuid.UUID,
	players []PlayerState,
) (*Session, error) {
	m.mu.Lock()
	if _, exists := m.sessions[sessionID]; exists {
		m.mu.Unlock()
		return nil, errSessionAlreadyActive
	}

	logger := &zerologAdapter{logger: m.logger}
	bus := engine.NewEventBus(logger)
	eng := engine.NewPhaseEngine(sessionID, nil, bus, nil, logger, nil)
	s := newSession(sessionID, eng, players, m.logger)

	// Wire the abort hook so panic_guard can remove the session from the map
	// when the 3-strike threshold is reached (HIGH finding #5).
	s.onAbort = m.removeSession

	// Wire snapshot dependencies if available.
	if m.snapshotCache != nil && m.snapshotSender != nil {
		s.injectSnapshot(m.snapshotCache, m.snapshotSender)
	}

	m.sessions[sessionID] = s
	m.mu.Unlock()

	go s.Run(ctx)

	m.logger.Info().
		Str("session_id", sessionID.String()).
		Str("theme_id", themeID.String()).
		Int("players", len(players)).
		Msg("session started")

	return s, nil
}

// Stop signals the session to shut down, removes it from the active map, and
// waits (up to stopTimeout) for the Run goroutine to exit.
// Returns errSessionNotFound if no session exists for sessionID.
func (m *SessionManager) Stop(sessionID uuid.UUID) error {
	m.mu.Lock()
	s, exists := m.sessions[sessionID]
	if !exists {
		m.mu.Unlock()
		return errSessionNotFound
	}
	delete(m.sessions, sessionID)
	m.mu.Unlock()

	s.stop()

	// Wait for the goroutine to finish so callers get a clean shutdown signal
	// and tests don't leak goroutines (MEDIUM finding #11).
	select {
	case <-s.Done():
	case <-time.After(stopTimeout):
		m.logger.Warn().
			Str("session_id", sessionID.String()).
			Dur("timeout", stopTimeout).
			Msg("timed out waiting for session goroutine to exit")
	}

	m.logger.Info().
		Str("session_id", sessionID.String()).
		Msg("session stopped")

	return nil
}

// Get returns the active Session for sessionID, or nil if it does not exist.
func (m *SessionManager) Get(sessionID uuid.UUID) *Session {
	m.mu.Lock()
	s := m.sessions[sessionID]
	m.mu.Unlock()
	return s
}

// Restore attempts to lazily restore a session from a Redis snapshot.
// Not implemented until PR-7.
func (m *SessionManager) Restore(_ context.Context, _ uuid.UUID) (*Session, error) {
	return nil, ErrNotImplemented
}

// removeSession is called by the session's onAbort hook when panic_guard
// reaches the abort threshold. It removes the session from the active map
// without waiting (the goroutine exits itself after calling onAbort).
func (m *SessionManager) removeSession(sessionID uuid.UUID) {
	m.mu.Lock()
	delete(m.sessions, sessionID)
	m.mu.Unlock()
}

// InjectSnapshot wires the cache provider and hub sender used for session
// snapshot persistence and reconnect push. Call once at startup before any
// sessions are created. Safe to call concurrently with no active sessions.
func (m *SessionManager) InjectSnapshot(c cache.Provider, sender ClientSender) {
	m.mu.Lock()
	m.snapshotCache = c
	m.snapshotSender = sender
	m.mu.Unlock()
}

// OnPlayerLeft implements ws.SessionLifecycleListener.
// Routes the disconnect event into the session actor so it can update
// per-player connection state.
func (m *SessionManager) OnPlayerLeft(sessionID, playerID uuid.UUID, _ bool) {
	s := m.Get(sessionID)
	if s == nil {
		return
	}
	_ = s.Send(SessionMessage{
		Kind:     KindLifecycleLeft,
		PlayerID: playerID,
		Ctx:      s.Ctx(),
	})
}

// OnPlayerRejoined implements ws.SessionLifecycleListener.
// Updates per-player connection state and pushes the current snapshot to the
// reconnecting player so their client can hydrate without waiting for the next
// game event.
func (m *SessionManager) OnPlayerRejoined(sessionID, playerID uuid.UUID) {
	s := m.Get(sessionID)
	if s == nil {
		return
	}
	_ = s.Send(SessionMessage{
		Kind:     KindLifecycleRejoined,
		PlayerID: playerID,
		Ctx:      s.Ctx(),
	})
	// SendSnapshot is safe to call from any goroutine — it reads Redis and
	// dispatches via the hub without touching session-internal state.
	go s.SendSnapshot(playerID)
}

// zerologAdapter bridges engine.Logger to zerolog.Logger.
type zerologAdapter struct {
	logger zerolog.Logger
}

func (z *zerologAdapter) Printf(format string, v ...any) {
	z.logger.Debug().Msgf(format, v...)
}
