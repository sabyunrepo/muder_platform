package engine

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

// GameProgressionEngine orchestrates the game lifecycle:
// strategy selection → module init → phase progression → cleanup.
//
// Thread-safety contract: GameProgressionEngine is NOT thread-safe.
// Callers MUST serialize all method calls. The session.Session actor is the
// ONLY authorized caller — it runs in a single goroutine and owns this engine
// exclusively. Do NOT call engine methods from any other goroutine.
type GameProgressionEngine struct {
	sessionID  uuid.UUID
	config     GameConfig
	strategy   ProgressionStrategy
	modules    map[string]Module
	dispatcher *ActionDispatcher
	eventBus   *EventBus
	logger     Logger
	started    bool
}

// NewEngine creates a GameProgressionEngine for one session.
func NewEngine(sessionID uuid.UUID, logger Logger) *GameProgressionEngine {
	return &GameProgressionEngine{
		sessionID: sessionID,
		eventBus:  NewEventBus(logger),
		logger:    logger,
	}
}

// Start initializes the engine: parses config, creates modules, selects strategy,
// initializes everything, and enters the first phase.
func (e *GameProgressionEngine) Start(ctx context.Context, configJSON json.RawMessage) error {
	if e.started {
		return fmt.Errorf("engine: already started")
	}

	// 1. Parse config
	var config GameConfig
	if err := json.Unmarshal(configJSON, &config); err != nil {
		return fmt.Errorf("engine: invalid config: %w", err)
	}
	e.config = config

	// 2. Validate modules ↔ phases
	if err := ValidateConfig(config); err != nil {
		return fmt.Errorf("engine: validation failed: %w", err)
	}

	// 3. Create module instances (Factory pattern)
	modules, err := CreateModules(config)
	if err != nil {
		return fmt.Errorf("engine: module creation failed: %w", err)
	}
	e.modules = modules

	// 4. Initialize modules
	deps := ModuleDeps{
		SessionID: e.sessionID,
		EventBus:  e.eventBus,
		Logger:    e.logger,
	}
	for name, mc := range configByName(config.Modules) {
		mod, ok := e.modules[name]
		if !ok {
			continue
		}
		if err := mod.Init(ctx, deps, mc.Settings); err != nil {
			return fmt.Errorf("engine: module %q init failed: %w", name, err)
		}
	}

	// 5. Create action dispatcher
	e.dispatcher = NewActionDispatcher(e.modules)

	// 6. Select and init strategy
	e.strategy, err = selectStrategy(config.Strategy)
	if err != nil {
		return err
	}
	if err := e.strategy.Init(ctx, config); err != nil {
		return fmt.Errorf("engine: strategy init failed: %w", err)
	}

	e.started = true

	// 7. Enter first phase
	return e.enterCurrentPhase(ctx)
}

// Advance moves to the next phase, executing onExit → advance → onEnter.
func (e *GameProgressionEngine) Advance(ctx context.Context) (bool, error) {
	if !e.started {
		return false, fmt.Errorf("engine: not started")
	}

	// onExit of current phase
	if err := e.exitCurrentPhase(ctx); err != nil {
		return false, err
	}

	// Advance strategy
	hasNext, err := e.strategy.Advance(ctx)
	if err != nil {
		return false, fmt.Errorf("engine: advance failed: %w", err)
	}
	if !hasNext {
		return false, nil
	}

	// onEnter of new phase
	if err := e.enterCurrentPhase(ctx); err != nil {
		return true, err
	}

	e.eventBus.Publish(Event{
		Type:    "phase:changed",
		Payload: e.strategy.CurrentPhase(),
	})

	return true, nil
}

// GMOverride jumps to a specific phase via the engine (onExit → SkipTo → onEnter).
func (e *GameProgressionEngine) GMOverride(ctx context.Context, phaseID string) error {
	if !e.started {
		return fmt.Errorf("engine: not started")
	}

	if err := e.exitCurrentPhase(ctx); err != nil {
		return err
	}

	if err := e.strategy.SkipTo(ctx, phaseID); err != nil {
		return fmt.Errorf("engine: gm override failed: %w", err)
	}

	if err := e.enterCurrentPhase(ctx); err != nil {
		return err
	}

	e.eventBus.Publish(Event{
		Type:    "gm:override",
		Payload: e.strategy.CurrentPhase(),
	})

	return nil
}

// HandleTrigger evaluates a trigger and transitions phases through the engine lifecycle.
func (e *GameProgressionEngine) HandleTrigger(ctx context.Context, triggerType string, condition json.RawMessage) error {
	if !e.started {
		return fmt.Errorf("engine: not started")
	}

	targetID, err := e.strategy.HandleTrigger(ctx, triggerType, condition)
	if err != nil {
		return fmt.Errorf("engine: trigger failed: %w", err)
	}
	if targetID == "" {
		return nil // no transition
	}

	// Transition through engine lifecycle: onExit → SkipTo → onEnter
	if err := e.exitCurrentPhase(ctx); err != nil {
		return err
	}
	if err := e.strategy.SkipTo(ctx, targetID); err != nil {
		return fmt.Errorf("engine: trigger transition failed: %w", err)
	}
	if err := e.enterCurrentPhase(ctx); err != nil {
		return err
	}

	e.eventBus.Publish(Event{
		Type:    "trigger:transition",
		Payload: e.strategy.CurrentPhase(),
	})

	return nil
}

// HandleMessage routes a player message to the appropriate module.
func (e *GameProgressionEngine) HandleMessage(ctx context.Context, playerID uuid.UUID, moduleName string, msgType string, payload json.RawMessage) error {
	if !e.started {
		return fmt.Errorf("engine: not started")
	}
	mod, ok := e.modules[moduleName]
	if !ok {
		return fmt.Errorf("engine: module %q not active", moduleName)
	}
	return mod.HandleMessage(ctx, playerID, msgType, payload)
}

// BuildState returns the full engine state for client synchronization.
func (e *GameProgressionEngine) BuildState() (json.RawMessage, error) {
	state := map[string]any{
		"sessionId": e.sessionID,
		"phase":     e.strategy.CurrentPhase(),
		"strategy":  e.strategy.BuildState(),
	}

	moduleStates := make(map[string]json.RawMessage, len(e.modules))
	for name, mod := range e.modules {
		ms, err := mod.BuildState()
		if err != nil {
			return nil, fmt.Errorf("engine: module %q state failed: %w", name, err)
		}
		moduleStates[name] = ms
	}
	state["modules"] = moduleStates

	return json.Marshal(state)
}

// Stop gracefully shuts down the engine: cleanup modules → strategy → eventbus.
func (e *GameProgressionEngine) Stop(ctx context.Context) error {
	if !e.started {
		return nil
	}
	e.started = false

	var firstErr error
	for name, mod := range e.modules {
		if err := mod.Cleanup(ctx); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("engine: module %q cleanup: %w", name, err)
		}
	}
	if err := e.strategy.Cleanup(ctx); err != nil && firstErr == nil {
		firstErr = fmt.Errorf("engine: strategy cleanup: %w", err)
	}
	e.eventBus.Close()
	return firstErr
}

// EventBus returns the session's event bus for external subscriptions.
func (e *GameProgressionEngine) EventBus() *EventBus {
	return e.eventBus
}

// CurrentPhase returns the active phase info.
func (e *GameProgressionEngine) CurrentPhase() *PhaseInfo {
	if e.strategy == nil {
		return nil
	}
	return e.strategy.CurrentPhase()
}

// --- internal helpers ---

func (e *GameProgressionEngine) enterCurrentPhase(ctx context.Context) error {
	phase := e.strategy.CurrentPhase()
	if phase == nil {
		return nil
	}
	for _, pc := range e.config.Phases {
		if pc.ID == phase.ID {
			// Auto-inject SET_BGM ahead of user-defined onEnter when the phase
			// declares a bgmId. onEnter actions can still override afterwards.
			if pc.BGMId != "" {
				bgmParams, _ := json.Marshal(map[string]any{
					"mediaId": pc.BGMId,
					"fadeMs":  1500,
				})
				bgmAction := PhaseActionPayload{
					Action: ActionSetBGM,
					Params: bgmParams,
				}
				if err := e.dispatcher.Dispatch(ctx, bgmAction); err != nil {
					// Best-effort: log and continue — BGM failure must not block phase entry.
					e.logger.Printf("engine: failed to dispatch auto SET_BGM for phase %s: %v", pc.ID, err)
				}
			}
			return e.dispatcher.DispatchBatch(ctx, pc.OnEnter)
		}
	}
	return nil
}

func (e *GameProgressionEngine) exitCurrentPhase(ctx context.Context) error {
	phase := e.strategy.CurrentPhase()
	if phase == nil {
		return nil
	}
	for _, pc := range e.config.Phases {
		if pc.ID == phase.ID {
			return e.dispatcher.DispatchBatch(ctx, pc.OnExit)
		}
	}
	return nil
}

func selectStrategy(name string) (ProgressionStrategy, error) {
	switch name {
	case "script":
		return NewScriptStrategy(), nil
	case "hybrid":
		return NewHybridStrategy(), nil
	case "event":
		return NewEventStrategy(), nil
	default:
		return nil, fmt.Errorf("engine: unknown strategy %q", name)
	}
}

func configByName(configs []ModuleConfig) map[string]ModuleConfig {
	m := make(map[string]ModuleConfig, len(configs))
	for _, c := range configs {
		m[c.Name] = c
	}
	return m
}
