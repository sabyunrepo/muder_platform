package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime/debug"
	"strings"
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
		if err := e.safeCallPhaseHook(ctx, mod, hook, phase, true); err != nil {
			return err
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
		if err := e.safeCallPhaseHook(ctx, mod, hook, phase, false); err != nil {
			return err
		}
	}
	return nil
}

func (e *PhaseEngine) safeCallPhaseHook(ctx context.Context, mod Module, hook PhaseHookModule, phase Phase, enter bool) (err error) {
	hookName := "phase exit"
	if enter {
		hookName = "phase enter"
	}
	defer func() {
		if r := recover(); r != nil {
			stack := debug.Stack()
			e.logger.Printf("engine: module %q panicked in %s hook: %v\n%s", mod.Name(), hookName, r, stack)
			e.auditEvent(ctx, "module.panic", map[string]any{
				"module": mod.Name(),
				"hook":   hookName,
				"phase":  phase,
				"panic":  fmt.Sprintf("%v", r),
			})
			err = fmt.Errorf("engine: module %q panicked in %s hook: %v", mod.Name(), hookName, r)
		}
	}()
	if enter {
		if err := hook.OnPhaseEnter(ctx, phase); err != nil {
			return fmt.Errorf("engine: module %q phase enter hook failed: %w", mod.Name(), err)
		}
		return nil
	}
	if err := hook.OnPhaseExit(ctx, phase); err != nil {
		return fmt.Errorf("engine: module %q phase exit hook failed: %w", mod.Name(), err)
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

var legacyPhaseActionAliases = map[string]PhaseAction{
	"deliver_information": ActionDeliverInformation,
	"enable_voting":       ActionOpenVoting,
	"disable_voting":      ActionCloseVoting,
	"enable_chat":         ActionUnmuteChat,
	"disable_chat":        ActionMuteChat,
	"play_bgm":            ActionSetBGM,
	"set_bgm":             ActionSetBGM,
	"play_sound":          ActionPlaySound,
	"play_media":          ActionPlayMedia,
	"stop_bgm":            ActionStopAudio,
	"stop_audio":          ActionStopAudio,
	"broadcast":           ActionBroadcastMessage,
}

// NormalizePhaseActionType maps editor/legacy action names to the backend
// PhaseAction contract used by runtime reactors.
func NormalizePhaseActionType(actionType string) PhaseAction {
	normalized := strings.ToLower(strings.TrimSpace(actionType))
	if action, ok := legacyPhaseActionAliases[normalized]; ok {
		return action
	}
	return PhaseAction(strings.ToUpper(normalized))
}

// ParsePhaseActionConfig parses the editor's phase-action array/wrapper shape
// into backend dispatch payloads. Runtime trigger modules reuse this so button
// and password triggers share the same result contract as phase enter/exit.
func ParsePhaseActionConfig(raw json.RawMessage) ([]PhaseActionPayload, error) {
	return parseConfiguredPhaseActions(raw)
}

func normalizeConfiguredPhaseAction(actionType string) PhaseAction {
	return NormalizePhaseActionType(actionType)
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
			Action: normalizeConfiguredPhaseAction(actionType),
			Target: action.Target,
			Params: action.Params,
		})
	}
	return out, nil
}
