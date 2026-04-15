package session

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/rs/zerolog"
)

// cleanupOnStartFail releases engine resources allocated during startModularGame
// when any failure path is taken before the session is fully operational.
// Stops all modules via engine.Stop and closes the event bus (M-a fix).
// Errors are logged but not returned — cleanup is best-effort.
func cleanupOnStartFail(ctx context.Context, eng *engine.PhaseEngine, logger zerolog.Logger) {
	if err := eng.Stop(ctx); err != nil {
		logger.Warn().Err(err).Msg("startModularGame: cleanup engine stop error")
	}
}

// errGameRuntimeDisabled is returned when startModularGame is called but the
// feature flag is off. Callers should fall back to the legacy game path.
var errGameRuntimeDisabled = apperror.New(
	apperror.ErrBadRequest,
	http.StatusBadRequest,
	"game_runtime_v2 feature flag is disabled",
)

// errInvalidConfig is returned when the configJson cannot be parsed.
var errInvalidConfig = apperror.New(
	apperror.ErrBadRequest,
	http.StatusBadRequest,
	"invalid game configJson",
)

// StartConfig carries everything startModularGame needs.
type StartConfig struct {
	SessionID   uuid.UUID
	ThemeID     uuid.UUID
	Players     []PlayerState
	ConfigJSON  json.RawMessage
	FeatureFlag bool // game_runtime_v2 flag — off by default
	Broadcaster Broadcaster
}

// startModularGame creates a Session, initialises the PhaseEngine with
// modules from configJson, wires EventMapping subscriptions, and launches
// the actor goroutine.
//
// Returns errGameRuntimeDisabled when cfg.FeatureFlag is false so the caller
// can transparently fall back to the legacy path.
func startModularGame(
	ctx context.Context,
	m *SessionManager,
	cfg StartConfig,
	logger zerolog.Logger,
) (*Session, error) {
	if !cfg.FeatureFlag {
		return nil, errGameRuntimeDisabled
	}

	gameCfg, err := engine.ParseGameConfig(cfg.ConfigJSON)
	if err != nil {
		logger.Error().Err(err).
			Str("session_id", cfg.SessionID.String()).
			Msg("startModularGame: failed to parse configJson")
		return nil, errInvalidConfig
	}

	adapter := &zerologAdapter{logger: logger}
	bus := engine.NewEventBus(adapter)

	deps := engine.ModuleDeps{
		SessionID: cfg.SessionID,
		EventBus:  bus,
		Logger:    adapter,
	}

	modules, moduleConfigs, err := engine.BuildModules(ctx, gameCfg, deps)
	if err != nil {
		logger.Error().Err(err).
			Str("session_id", cfg.SessionID.String()).
			Msg("startModularGame: failed to build modules")
		// L-7: expose only a generic message to the host; details are in server logs.
		return nil, apperror.New(
			apperror.ErrBadRequest,
			http.StatusBadRequest,
			"failed to initialise game modules",
		)
	}

	eng := engine.NewPhaseEngine(
		cfg.SessionID,
		modules,
		bus,
		nil, // audit logger — no-op until PR-A3
		adapter,
		gameCfg.Phases,
	)

	s := newSession(cfg.SessionID, eng, cfg.Players, logger)
	s.onAbort = m.removeSession

	// Wire snapshot dependencies so reconnecting players receive the current
	// session state. Mirrors SessionManager.Start (H-2 fix).
	if m.snapshotCache != nil && m.snapshotSender != nil {
		s.injectSnapshot(m.snapshotCache, m.snapshotSender)
	}

	// Register EventMapping subscriptions before starting the engine so no
	// events are missed during the first phase:entered publish inside Start().
	if cfg.Broadcaster != nil {
		registerEventMapping(cfg.SessionID, bus, cfg.Broadcaster, logger)
	}

	// Pre-queue KindEngineStart into the inbox BEFORE inserting into the
	// session map so external callers that look up the session via
	// manager.Get cannot send KindEngineCommand ahead of KindEngineStart
	// (M-2 TOCTOU fix). The buffered inbox accepts this send synchronously.
	startReply := make(chan error, 1)
	if err := s.Send(SessionMessage{
		Kind:    KindEngineStart,
		Ctx:     ctx,
		Reply:   startReply,
		Payload: EngineStartPayload{ModuleConfigs: moduleConfigs},
	}); err != nil {
		// M-a: clean up engine resources before returning.
		cleanupOnStartFail(ctx, eng, logger)
		s.stop()
		return nil, err
	}

	m.mu.Lock()
	if _, exists := m.sessions[cfg.SessionID]; exists {
		m.mu.Unlock()
		// M-a: clean up engine resources before returning.
		cleanupOnStartFail(ctx, eng, logger)
		s.stop()
		return nil, errSessionAlreadyActive
	}
	m.sessions[cfg.SessionID] = s
	m.mu.Unlock()

	go s.Run(ctx)

	// Wait for the actor to finish processing KindEngineStart. Any client
	// messages that arrive after the map insert are guaranteed to be
	// behind KindEngineStart in the inbox.
	select {
	case err := <-startReply:
		if err != nil {
			m.mu.Lock()
			delete(m.sessions, cfg.SessionID)
			m.mu.Unlock()
			// M-a: clean up engine resources before returning.
			cleanupOnStartFail(ctx, eng, logger)
			s.stop()
			return nil, err
		}
	case <-ctx.Done():
		m.mu.Lock()
		delete(m.sessions, cfg.SessionID)
		m.mu.Unlock()
		// M-a: clean up engine resources before returning.
		cleanupOnStartFail(ctx, eng, logger)
		s.stop()
		return nil, ctx.Err()
	}

	logger.Info().
		Str("session_id", cfg.SessionID.String()).
		Str("theme_id", cfg.ThemeID.String()).
		Int("modules", len(modules)).
		Int("phases", len(gameCfg.Phases)).
		Int("players", len(cfg.Players)).
		Msg("startModularGame: session started")

	return s, nil
}
