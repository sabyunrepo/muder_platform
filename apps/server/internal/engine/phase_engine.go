package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime/debug"

	"github.com/google/uuid"
)

// AuditLogger writes structured audit events for observability.
// Implemented by the auditlog package (PR-A3); a no-op stub is used in tests.
type AuditLogger interface {
	Log(ctx context.Context, sessionID uuid.UUID, eventType string, payload json.RawMessage)
}

// noopAuditLogger is used when no audit logger is provided.
type noopAuditLogger struct{}

func (noopAuditLogger) Log(context.Context, uuid.UUID, string, json.RawMessage) {}

// PhaseEngine is the v3 game orchestrator. It replaces GameProgressionEngine
// with a simpler, linear phase model driven by PhaseDefinition.
//
// Thread-safety contract: PhaseEngine is NOT thread-safe.
// The session actor is the ONLY authorised caller.
type PhaseEngine struct {
	sessionID uuid.UUID
	modules   []Module          // ordered module list
	moduleMap map[string]Module // name → module for lookups
	eventBus  *EventBus
	audit     AuditLogger
	logger    Logger
	phases    []PhaseDefinition
	current   int // index into phases, -1 = not started
	started   bool
	stopped   bool
}

// NewPhaseEngine constructs a PhaseEngine for one session.
func NewPhaseEngine(
	sessionID uuid.UUID,
	modules []Module,
	bus *EventBus,
	audit AuditLogger,
	logger Logger,
	phases []PhaseDefinition,
) *PhaseEngine {
	if audit == nil {
		audit = noopAuditLogger{}
	}

	moduleMap := make(map[string]Module, len(modules))
	for _, m := range modules {
		moduleMap[m.Name()] = m
	}

	return &PhaseEngine{
		sessionID: sessionID,
		modules:   modules,
		moduleMap: moduleMap,
		eventBus:  bus,
		audit:     audit,
		logger:    logger,
		phases:    phases,
		current:   0,
		started:   false,
	}
}

// Start initialises all modules and enters the first phase.
func (e *PhaseEngine) Start(ctx context.Context, moduleConfigs map[string]json.RawMessage) error {
	if e.started {
		return fmt.Errorf("engine: already started")
	}
	if len(e.phases) == 0 {
		return fmt.Errorf("engine: no phases defined")
	}

	deps := ModuleDeps{
		SessionID: e.sessionID,
		EventBus:  e.eventBus,
		Logger:    e.logger,
	}

	for _, mod := range e.modules {
		cfg := moduleConfigs[mod.Name()]
		if err := mod.Init(ctx, deps, cfg); err != nil {
			return fmt.Errorf("engine: module %q init failed: %w", mod.Name(), err)
		}
	}

	e.started = true
	e.current = 0

	e.auditEvent(ctx, "engine.started", map[string]any{
		"sessionId":  e.sessionID.String(),
		"modules":    e.moduleNames(),
		"phaseCount": len(e.phases),
	})

	e.eventBus.Publish(Event{
		Type:    "phase:entered",
		Payload: e.CurrentPhase(),
	})

	return nil
}

// Step dispatches a GameEvent to all modules that implement GameEventHandler.
// Each module call is panic-isolated: a panicking module is logged and skipped.
func (e *PhaseEngine) Step(ctx context.Context, event Event) error {
	if !e.started || e.stopped {
		return fmt.Errorf("engine: not running")
	}

	for _, mod := range e.modules {
		handler, ok := mod.(PhaseReactor)
		if !ok {
			continue
		}

		// Check if this reactor supports the action before dispatching.
		supported := false
		action := PhaseActionPayload{Action: PhaseAction(event.Type)}
		for _, sa := range handler.SupportedActions() {
			if sa == action.Action {
				supported = true
				break
			}
		}
		if !supported {
			continue
		}

		if err := e.safeCallReactor(ctx, mod.Name(), handler, action); err != nil {
			e.logger.Printf("engine: module %q step error: %v", mod.Name(), err)
		}
	}

	return nil
}

// AdvancePhase moves to the next phase in the linear sequence.
// Returns false if there are no more phases (game complete).
func (e *PhaseEngine) AdvancePhase(ctx context.Context) (bool, error) {
	if !e.started || e.stopped {
		return false, fmt.Errorf("engine: not running")
	}

	oldPhase := e.phases[e.current]

	e.eventBus.Publish(Event{
		Type:    "phase:exiting",
		Payload: e.phaseInfo(e.current),
	})

	e.current++
	if e.current >= len(e.phases) {
		e.auditEvent(ctx, "engine.completed", map[string]any{
			"sessionId": e.sessionID.String(),
			"lastPhase": oldPhase.ID,
		})
		return false, nil
	}

	newPhase := e.phases[e.current]
	e.auditEvent(ctx, "phase.advanced", map[string]any{
		"from": oldPhase.ID,
		"to":   newPhase.ID,
	})

	e.eventBus.Publish(Event{
		Type:    "phase:entered",
		Payload: e.CurrentPhase(),
	})

	return true, nil
}

// SkipToPhase jumps to a specific phase by ID (GM override).
func (e *PhaseEngine) SkipToPhase(ctx context.Context, phaseID string) error {
	if !e.started || e.stopped {
		return fmt.Errorf("engine: not running")
	}

	for i, p := range e.phases {
		if string(p.ID) == phaseID {
			oldID := e.phases[e.current].ID
			e.current = i

			e.auditEvent(ctx, "phase.skipped", map[string]any{
				"from": oldID,
				"to":   phaseID,
			})

			e.eventBus.Publish(Event{
				Type:    "phase:entered",
				Payload: e.CurrentPhase(),
			})
			return nil
		}
	}
	return fmt.Errorf("engine: phase %q not found", phaseID)
}

// HandleMessage routes a player message to the named module.
func (e *PhaseEngine) HandleMessage(ctx context.Context, playerID uuid.UUID, moduleName string, msgType string, payload json.RawMessage) error {
	if !e.started || e.stopped {
		return fmt.Errorf("engine: not running")
	}
	mod, ok := e.moduleMap[moduleName]
	if !ok {
		return fmt.Errorf("engine: module %q not active", moduleName)
	}
	return mod.HandleMessage(ctx, playerID, msgType, payload)
}

// DispatchAction routes a PhaseActionPayload to the appropriate PhaseReactor modules.
func (e *PhaseEngine) DispatchAction(ctx context.Context, action PhaseActionPayload) error {
	if !e.started || e.stopped {
		return fmt.Errorf("engine: not running")
	}

	// If targeting a specific module:
	if action.Target != "" {
		mod, ok := e.moduleMap[action.Target]
		if !ok {
			return fmt.Errorf("engine: target module %q not found", action.Target)
		}
		reactor, ok := mod.(PhaseReactor)
		if !ok {
			return fmt.Errorf("engine: target module %q is not a reactor", action.Target)
		}
		return e.safeCallReactor(ctx, mod.Name(), reactor, action)
	}

	// Check if action requires a specific module.
	if requiredModule, ok := ActionRequiresModule[action.Action]; ok {
		mod, exists := e.moduleMap[requiredModule]
		if !exists {
			return fmt.Errorf("engine: action %s requires module %q which is not active",
				action.Action, requiredModule)
		}
		reactor, ok := mod.(PhaseReactor)
		if !ok {
			return fmt.Errorf("engine: module %q does not implement PhaseReactor", requiredModule)
		}
		return reactor.ReactTo(ctx, action)
	}

	// Broadcast to all supporting reactors.
	for _, mod := range e.modules {
		reactor, ok := mod.(PhaseReactor)
		if !ok {
			continue
		}
		for _, sa := range reactor.SupportedActions() {
			if sa == action.Action {
				if err := e.safeCallReactor(ctx, mod.Name(), reactor, action); err != nil {
					return err
				}
				break
			}
		}
	}
	return nil
}

// BuildState returns the full engine state for client synchronization.
func (e *PhaseEngine) BuildState() (json.RawMessage, error) {
	state := map[string]any{
		"sessionId": e.sessionID,
		"phase":     e.CurrentPhase(),
	}

	moduleStates := make(map[string]json.RawMessage, len(e.modules))
	for _, mod := range e.modules {
		ms, err := mod.BuildState()
		if err != nil {
			return nil, fmt.Errorf("engine: module %q state failed: %w", mod.Name(), err)
		}
		moduleStates[mod.Name()] = ms
	}
	state["modules"] = moduleStates

	return json.Marshal(state)
}

// BuildStateFor returns the engine state with player-aware module redaction
// applied. Envelope structure is identical to BuildState — only the per-module
// state maps differ based on the caller's identity. Used on reconnect so that
// role-private data never reaches the wrong client. (Phase 18.1 B-2)
func (e *PhaseEngine) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	state := map[string]any{
		"sessionId": e.sessionID,
		"phase":     e.CurrentPhase(),
	}

	moduleStates := make(map[string]json.RawMessage, len(e.modules))
	for _, mod := range e.modules {
		ms, err := BuildModuleStateFor(mod, playerID)
		if err != nil {
			return nil, fmt.Errorf("engine: module %q state_for failed: %w", mod.Name(), err)
		}
		moduleStates[mod.Name()] = ms
	}
	state["modules"] = moduleStates

	return json.Marshal(state)
}

// Stop gracefully shuts down the engine and all modules.
func (e *PhaseEngine) Stop(ctx context.Context) error {
	if !e.started || e.stopped {
		return nil
	}
	e.stopped = true

	var firstErr error
	for _, mod := range e.modules {
		if err := mod.Cleanup(ctx); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("engine: module %q cleanup: %w", mod.Name(), err)
		}
	}

	e.auditEvent(ctx, "engine.stopped", map[string]any{
		"sessionId": e.sessionID.String(),
	})

	e.eventBus.Close()
	return firstErr
}

// EventBus returns the session's event bus for external subscriptions.
func (e *PhaseEngine) EventBus() *EventBus {
	return e.eventBus
}

// CurrentPhase returns the active phase info, or nil if not started.
func (e *PhaseEngine) CurrentPhase() *PhaseInfo {
	if !e.started || e.current < 0 || e.current >= len(e.phases) {
		return nil
	}
	return e.phaseInfo(e.current)
}

// --- internal helpers ---

func (e *PhaseEngine) phaseInfo(idx int) *PhaseInfo {
	p := e.phases[idx]
	return &PhaseInfo{
		ID:    string(p.ID),
		Name:  p.Name,
		Index: idx,
	}
}

func (e *PhaseEngine) moduleNames() []string {
	names := make([]string, len(e.modules))
	for i, m := range e.modules {
		names[i] = m.Name()
	}
	return names
}

// safeCallReactor invokes a PhaseReactor with panic isolation.
// On panic: logs the error, publishes a module.panic audit event, and continues.
func (e *PhaseEngine) safeCallReactor(ctx context.Context, name string, reactor PhaseReactor, action PhaseActionPayload) (err error) {
	defer func() {
		if r := recover(); r != nil {
			stack := debug.Stack()
			e.logger.Printf("engine: module %q panicked: %v\n%s", name, r, stack)
			e.auditEvent(ctx, "module.panic", map[string]any{
				"module": name,
				"action": string(action.Action),
				"panic":  fmt.Sprintf("%v", r),
			})
			err = fmt.Errorf("engine: module %q panicked: %v", name, r)
		}
	}()
	return reactor.ReactTo(ctx, action)
}

func (e *PhaseEngine) auditEvent(ctx context.Context, eventType string, payload map[string]any) {
	data, _ := json.Marshal(payload)
	e.audit.Log(ctx, e.sessionID, eventType, data)
}
