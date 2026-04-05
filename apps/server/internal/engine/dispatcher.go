package engine

import (
	"context"
	"fmt"
	"sort"
)

// ActionRequiresModule maps PhaseActions to the module that must be enabled.
// Actions not in this map are module-independent (e.g. BROADCAST_MESSAGE).
var ActionRequiresModule = map[PhaseAction]string{
	ActionResetDrawCount:      "clue_interaction",
	ActionResetFloorSelection: "floor_exploration",
	ActionSetClueLevel:        "clue_interaction",
	ActionOpenVoting:          "voting",
	ActionCloseVoting:         "voting",
	ActionAllowExchange:       "trade_clue",
	ActionMuteChat:            "text_chat",
	ActionUnmuteChat:          "text_chat",
	ActionOpenGroupChat:       "group_chat",
	ActionCloseGroupChat:      "group_chat",
}

// ActionDispatcher routes PhaseActions to the appropriate PhaseReactor modules.
type ActionDispatcher struct {
	reactors map[string]PhaseReactor // module name → reactor
}

// NewActionDispatcher creates a dispatcher from the session's active modules.
// Only modules implementing PhaseReactor are registered.
func NewActionDispatcher(modules map[string]Module) *ActionDispatcher {
	reactors := make(map[string]PhaseReactor)
	for name, mod := range modules {
		if reactor, ok := mod.(PhaseReactor); ok {
			reactors[name] = reactor
		}
	}
	return &ActionDispatcher{reactors: reactors}
}

// Dispatch executes a PhaseAction by routing to the correct PhaseReactor(s).
// Returns an error if a required module is missing or the reactor fails.
func (d *ActionDispatcher) Dispatch(ctx context.Context, action PhaseActionPayload) error {
	// LOCK_MODULE / UNLOCK_MODULE target a specific module by name.
	if action.Action == ActionLockModule || action.Action == ActionUnlockModule {
		return d.dispatchToTarget(ctx, action)
	}

	// Check if the action requires a specific module.
	if requiredModule, ok := ActionRequiresModule[action.Action]; ok {
		reactor, exists := d.reactors[requiredModule]
		if !exists {
			return fmt.Errorf("engine/dispatcher: action %s requires module %q which is not active",
				action.Action, requiredModule)
		}
		return reactor.ReactTo(ctx, action)
	}

	// Module-independent actions: broadcast to all reactors that support it.
	return d.broadcastAction(ctx, action)
}

// DispatchBatch executes multiple actions in order (e.g. onEnter/onExit lists).
func (d *ActionDispatcher) DispatchBatch(ctx context.Context, actions []PhaseActionPayload) error {
	for _, action := range actions {
		if err := d.Dispatch(ctx, action); err != nil {
			return fmt.Errorf("engine/dispatcher: batch failed at %s: %w", action.Action, err)
		}
	}
	return nil
}

// dispatchToTarget routes an action to a specific module named in action.Target.
func (d *ActionDispatcher) dispatchToTarget(ctx context.Context, action PhaseActionPayload) error {
	if action.Target == "" {
		return fmt.Errorf("engine/dispatcher: %s requires a target module", action.Action)
	}
	reactor, ok := d.reactors[action.Target]
	if !ok {
		return fmt.Errorf("engine/dispatcher: target module %q not found or not a reactor", action.Target)
	}
	return reactor.ReactTo(ctx, action)
}

// broadcastAction sends an action to all reactors that declare support for it.
// Reactors are dispatched in sorted name order for deterministic behavior.
func (d *ActionDispatcher) broadcastAction(ctx context.Context, action PhaseActionPayload) error {
	names := make([]string, 0, len(d.reactors))
	for name := range d.reactors {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		reactor := d.reactors[name]
		for _, supported := range reactor.SupportedActions() {
			if supported == action.Action {
				if err := reactor.ReactTo(ctx, action); err != nil {
					return err
				}
				break
			}
		}
	}
	return nil
}
