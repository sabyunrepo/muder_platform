package engine

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

// EventStrategy uses a directed graph for non-linear phase progression.
type EventStrategy struct {
	phases   map[string]PhaseConfig // phaseID → config
	order    []string               // original order for BuildState
	current  string                 // current phase ID
	started  bool
}

func NewEventStrategy() *EventStrategy {
	return &EventStrategy{}
}

func (e *EventStrategy) Init(_ context.Context, config GameConfig) error {
	if len(config.Phases) == 0 {
		return fmt.Errorf("engine/event: no phases configured")
	}
	e.phases = make(map[string]PhaseConfig, len(config.Phases))
	e.order = make([]string, 0, len(config.Phases))
	for _, p := range config.Phases {
		e.phases[p.ID] = p
		e.order = append(e.order, p.ID)
	}
	e.current = config.Phases[0].ID
	e.started = true
	return nil
}

func (e *EventStrategy) CurrentPhase() *PhaseInfo {
	if !e.started || e.current == "" {
		return nil
	}
	p, ok := e.phases[e.current]
	if !ok {
		return nil
	}
	idx := -1
	for i, id := range e.order {
		if id == e.current {
			idx = i
			break
		}
	}
	return &PhaseInfo{
		ID:       p.ID,
		Name:     p.Name,
		Type:     p.Type,
		Index:    idx,
		Duration: p.Duration,
	}
}

func (e *EventStrategy) Advance(_ context.Context) (bool, error) {
	if !e.started {
		return false, fmt.Errorf("engine/event: not initialized")
	}
	p, ok := e.phases[e.current]
	if !ok {
		return false, nil
	}
	if p.NextPhaseID == "" {
		// No explicit next phase — game ends.
		e.current = ""
		return false, nil
	}
	if _, exists := e.phases[p.NextPhaseID]; !exists {
		return false, fmt.Errorf("engine/event: next phase %q not found", p.NextPhaseID)
	}
	e.current = p.NextPhaseID
	return true, nil
}

func (e *EventStrategy) SkipTo(_ context.Context, phaseID string) error {
	if _, ok := e.phases[phaseID]; !ok {
		return fmt.Errorf("engine/event: phase %q not found", phaseID)
	}
	e.current = phaseID
	return nil
}

func (e *EventStrategy) HandleTrigger(_ context.Context, triggerType string, _ json.RawMessage) (string, error) {
	if !e.started || e.current == "" {
		return "", nil
	}
	p := e.phases[e.current]
	for _, trigger := range p.Triggers {
		if trigger.Type == triggerType && trigger.TargetID != "" {
			if _, exists := e.phases[trigger.TargetID]; exists {
				// Return target ID — the engine orchestrator handles exit/enter lifecycle.
				return trigger.TargetID, nil
			}
		}
	}
	return "", nil
}

func (e *EventStrategy) HandleConsensus(_ context.Context, _ uuid.UUID, _ string) error {
	// Event strategy doesn't use consensus directly.
	return nil
}

func (e *EventStrategy) BuildState() map[string]any {
	return map[string]any{
		"strategy":    "event",
		"currentId":   e.current,
		"totalPhases": len(e.phases),
		"phaseOrder":  e.order,
	}
}

func (e *EventStrategy) Cleanup(_ context.Context) error {
	e.phases = nil
	e.order = nil
	e.started = false
	return nil
}
