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
		return nil, apperror.New(
			apperror.ErrBadRequest,
			http.StatusBadRequest,
			"failed to build game modules: "+err.Error(),
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

	m.mu.Lock()
	if _, exists := m.sessions[cfg.SessionID]; exists {
		m.mu.Unlock()
		return nil, errSessionAlreadyActive
	}
	m.sessions[cfg.SessionID] = s
	m.mu.Unlock()

	go s.Run(ctx)

	// Start the engine inside the actor to keep the concurrency contract.
	// We send a synthetic KindEngineStart message that triggers Start().
	if err := engineStart(ctx, s, eng, moduleConfigs, logger); err != nil {
		m.mu.Lock()
		delete(m.sessions, cfg.SessionID)
		m.mu.Unlock()
		s.stop()
		return nil, err
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

// engineStart calls PhaseEngine.Start synchronously by sending a dedicated
// inbox message and waiting for the reply. This keeps Start() inside the
// actor goroutine while still blocking the caller until the engine is ready.
func engineStart(
	ctx context.Context,
	s *Session,
	eng *engine.PhaseEngine,
	moduleConfigs map[string]json.RawMessage,
	logger zerolog.Logger,
) error {
	reply := make(chan error, 1)
	msg := SessionMessage{
		Kind:    KindEngineStart,
		Ctx:     ctx,
		Reply:   reply,
		Payload: EngineStartPayload{ModuleConfigs: moduleConfigs},
	}
	if err := s.Send(msg); err != nil {
		return err
	}
	select {
	case err := <-reply:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}
