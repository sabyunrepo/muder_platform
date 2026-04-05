package engine

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

// ScriptStrategy executes phases[] sequentially by index.
type ScriptStrategy struct {
	phases  []PhaseConfig
	current int
	started bool
}

func NewScriptStrategy() *ScriptStrategy {
	return &ScriptStrategy{}
}

func (s *ScriptStrategy) Init(_ context.Context, config GameConfig) error {
	if len(config.Phases) == 0 {
		return fmt.Errorf("engine/script: no phases configured")
	}
	s.phases = config.Phases
	s.current = 0
	s.started = true
	return nil
}

func (s *ScriptStrategy) CurrentPhase() *PhaseInfo {
	if !s.started || s.current >= len(s.phases) {
		return nil
	}
	p := s.phases[s.current]
	return &PhaseInfo{
		ID:       p.ID,
		Name:     p.Name,
		Type:     p.Type,
		Index:    s.current,
		Duration: p.Duration,
	}
}

func (s *ScriptStrategy) Advance(_ context.Context) (bool, error) {
	if !s.started {
		return false, fmt.Errorf("engine/script: not initialized")
	}
	s.current++
	return s.current < len(s.phases), nil
}

func (s *ScriptStrategy) SkipTo(_ context.Context, phaseID string) error {
	for i, p := range s.phases {
		if p.ID == phaseID {
			s.current = i
			return nil
		}
	}
	return fmt.Errorf("engine/script: phase %q not found", phaseID)
}

func (s *ScriptStrategy) HandleTrigger(_ context.Context, _ string, _ json.RawMessage) (string, error) {
	// Script strategy doesn't use triggers.
	return "", nil
}

func (s *ScriptStrategy) HandleConsensus(_ context.Context, _ uuid.UUID, _ string) error {
	// Handled by SkipConsensus module, not the strategy itself.
	return nil
}

func (s *ScriptStrategy) BuildState() map[string]any {
	return map[string]any{
		"strategy":   "script",
		"current":    s.current,
		"totalPhases": len(s.phases),
	}
}

func (s *ScriptStrategy) Cleanup(_ context.Context) error {
	s.phases = nil
	s.started = false
	return nil
}
