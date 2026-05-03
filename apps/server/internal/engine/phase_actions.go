package engine

import (
	"context"
	"encoding/json"
	"fmt"
)

func (e *PhaseEngine) enterCurrentPhase(ctx context.Context) error {
	phase := e.phases[e.current]
	if err := e.callPhaseEnterHooks(ctx, phase.ID); err != nil {
		return err
	}
	if err := e.dispatchConfiguredActions(ctx, phase.OnEnter); err != nil {
		return err
	}
	e.eventBus.Publish(Event{
		Type:    "phase:entered",
		Payload: e.CurrentPhase(),
	})
	return nil
}

func (e *PhaseEngine) exitCurrentPhase(ctx context.Context) error {
	phase := e.phases[e.current]
	if err := e.dispatchConfiguredActions(ctx, phase.OnExit); err != nil {
		return err
	}
	if err := e.callPhaseExitHooks(ctx, phase.ID); err != nil {
		return err
	}
	e.eventBus.Publish(Event{
		Type:    "phase:exiting",
		Payload: e.phaseInfo(e.current),
	})
	return nil
}

func (e *PhaseEngine) callPhaseEnterHooks(ctx context.Context, phase Phase) error {
	for _, mod := range e.modules {
		hook, ok := mod.(PhaseHookModule)
		if !ok {
			continue
		}
		if err := hook.OnPhaseEnter(ctx, phase); err != nil {
			return fmt.Errorf("engine: module %q phase enter hook failed: %w", mod.Name(), err)
		}
	}
	return nil
}

func (e *PhaseEngine) callPhaseExitHooks(ctx context.Context, phase Phase) error {
	for _, mod := range e.modules {
		hook, ok := mod.(PhaseHookModule)
		if !ok {
			continue
		}
		if err := hook.OnPhaseExit(ctx, phase); err != nil {
			return fmt.Errorf("engine: module %q phase exit hook failed: %w", mod.Name(), err)
		}
	}
	return nil
}

func (e *PhaseEngine) dispatchConfiguredActions(ctx context.Context, raw json.RawMessage) error {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	actions, err := parseConfiguredPhaseActions(raw)
	if err != nil {
		return err
	}
	for _, action := range actions {
		if action.Action == "" {
			continue
		}
		if err := e.DispatchAction(ctx, action); err != nil {
			return err
		}
	}
	return nil
}

type configuredPhaseAction struct {
	ID     string          `json:"id,omitempty"`
	Type   string          `json:"type,omitempty"`
	Action string          `json:"action,omitempty"`
	Target string          `json:"target,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
}

func parseConfiguredPhaseActions(raw json.RawMessage) ([]PhaseActionPayload, error) {
	var wrapped struct {
		Actions []configuredPhaseAction `json:"actions"`
	}
	var configured []configuredPhaseAction
	if err := json.Unmarshal(raw, &configured); err != nil {
		if errObj := json.Unmarshal(raw, &wrapped); errObj != nil {
			return nil, fmt.Errorf("engine: invalid phase action config: %w", err)
		}
		// Legacy PhaseDefinition comments allowed JSONLogic-ish objects in onEnter/onExit.
		// Those were previously ignored by the engine, so preserve that behavior unless
		// an explicit {"actions": [...]} wrapper is present.
		if len(wrapped.Actions) == 0 {
			return nil, nil
		}
		configured = wrapped.Actions
	}
	out := make([]PhaseActionPayload, 0, len(configured))
	for _, action := range configured {
		actionType := action.Action
		if actionType == "" {
			actionType = action.Type
		}
		out = append(out, PhaseActionPayload{
			Action: PhaseAction(actionType),
			Target: action.Target,
			Params: action.Params,
		})
	}
	return out, nil
}
