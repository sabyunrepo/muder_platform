package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"sort"
)

// SetSceneTransitions installs graph-based story movement rules for the
// session. The engine copies and validates the edges so runtime phase mutation
// never depends on frontend-only state.
func (e *PhaseEngine) SetSceneTransitions(transitions []SceneTransition) error {
	for _, transition := range transitions {
		if transition.From == "" {
			return fmt.Errorf("engine: scene transition from phase is required")
		}
		if transition.To == "" {
			return fmt.Errorf("engine: scene transition target phase is required")
		}
		if e.phaseIndex(transition.From) < 0 {
			return fmt.Errorf("engine: scene transition source phase %q not found", transition.From)
		}
		if e.phaseIndex(transition.To) < 0 {
			return fmt.Errorf("engine: scene transition target phase %q not found", transition.To)
		}
	}
	e.sceneTransitions = append([]SceneTransition(nil), transitions...)
	return nil
}

// AdvanceScene evaluates configured scene transitions from the current phase
// and moves to the first matching target. If no scene graph is installed, it
// preserves the legacy linear AdvancePhase behavior.
func (e *PhaseEngine) AdvanceScene(ctx context.Context, conditionContext json.RawMessage) (bool, error) {
	if !e.started || e.stopped {
		return false, fmt.Errorf("engine: not running")
	}
	if len(e.sceneTransitions) == 0 {
		return e.AdvancePhase(ctx)
	}

	oldIndex := e.current
	oldRound := e.currentRound
	oldPhase := e.phases[oldIndex]
	candidates := e.sceneTransitionsFrom(oldPhase.ID)
	if len(candidates) == 0 {
		return e.completeFromCurrentPhase(ctx, oldPhase, oldRound)
	}

	transition, matched, err := e.matchSceneTransition(candidates, conditionContext)
	if err != nil {
		return false, err
	}
	if !matched {
		return false, fmt.Errorf("engine: no matching scene transition from phase %q", oldPhase.ID)
	}

	targetIndex := e.phaseIndex(transition.To)
	if targetIndex < 0 {
		return false, fmt.Errorf("engine: scene transition target phase %q not found", transition.To)
	}
	if err := e.exitCurrentPhase(ctx); err != nil {
		return false, err
	}
	e.current = targetIndex
	e.currentRound = oldRound + 1
	if err := e.enterCurrentPhase(ctx); err != nil {
		e.current = oldIndex
		e.currentRound = oldRound
		e.auditEvent(ctx, "phase.enter_failed", map[string]any{
			"from":  oldPhase.ID,
			"to":    transition.To,
			"error": err.Error(),
		})
		return false, err
	}

	newPhase := e.phases[e.current]
	e.auditEvent(ctx, "phase.scene_transitioned", map[string]any{
		"from":         oldPhase.ID,
		"to":           newPhase.ID,
		"round":        e.currentRound,
		"transitionId": transition.ID,
		"label":        transition.Label,
	})
	return true, nil
}

func (e *PhaseEngine) completeFromCurrentPhase(ctx context.Context, phase PhaseDefinition, oldRound int32) (bool, error) {
	if err := e.exitCurrentPhase(ctx); err != nil {
		return false, err
	}
	e.current = len(e.phases)
	e.currentRound = oldRound
	e.auditEvent(ctx, "engine.completed", map[string]any{
		"sessionId": e.sessionID.String(),
		"lastPhase": phase.ID,
	})
	return false, nil
}

func (e *PhaseEngine) sceneTransitionsFrom(phase Phase) []SceneTransition {
	candidates := make([]SceneTransition, 0)
	for _, transition := range e.sceneTransitions {
		if transition.From == phase {
			candidates = append(candidates, transition)
		}
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		return candidates[i].SortOrder < candidates[j].SortOrder
	})
	return candidates
}

func (e *PhaseEngine) matchSceneTransition(transitions []SceneTransition, conditionContext json.RawMessage) (SceneTransition, bool, error) {
	for _, transition := range transitions {
		match, err := e.sceneTransitionMatches(transition, conditionContext)
		if err != nil {
			return SceneTransition{}, false, err
		}
		if match {
			return transition, true, nil
		}
	}
	return SceneTransition{}, false, nil
}

func (e *PhaseEngine) sceneTransitionMatches(transition SceneTransition, conditionContext json.RawMessage) (bool, error) {
	condition := bytes.TrimSpace(transition.Condition)
	if len(condition) == 0 || bytes.Equal(condition, []byte("null")) {
		return true, nil
	}
	result, err := EvaluateConditionGroup(condition, conditionContext)
	if err != nil {
		return false, fmt.Errorf("engine: scene transition %q condition failed: %w", transition.ID, err)
	}
	return result.Bool, nil
}

func (e *PhaseEngine) phaseIndex(phase Phase) int {
	for idx, definition := range e.phases {
		if definition.ID == phase {
			return idx
		}
	}
	return -1
}
