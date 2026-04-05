package engine

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

// HybridStrategy combines timer + trigger + consensus for phase advancement.
type HybridStrategy struct {
	phases  []PhaseConfig
	current int
	started bool

	// consensus tracks per-phase player agreement.
	consensus map[uuid.UUID]bool
}

func NewHybridStrategy() *HybridStrategy {
	return &HybridStrategy{}
}

func (h *HybridStrategy) Init(_ context.Context, config GameConfig) error {
	if len(config.Phases) == 0 {
		return fmt.Errorf("engine/hybrid: no phases configured")
	}
	h.phases = config.Phases
	h.current = 0
	h.started = true
	h.consensus = make(map[uuid.UUID]bool)
	return nil
}

func (h *HybridStrategy) CurrentPhase() *PhaseInfo {
	if !h.started || h.current >= len(h.phases) {
		return nil
	}
	p := h.phases[h.current]
	return &PhaseInfo{
		ID:       p.ID,
		Name:     p.Name,
		Type:     p.Type,
		Index:    h.current,
		Duration: p.Duration,
	}
}

func (h *HybridStrategy) Advance(_ context.Context) (bool, error) {
	if !h.started {
		return false, fmt.Errorf("engine/hybrid: not initialized")
	}
	h.current++
	h.consensus = make(map[uuid.UUID]bool) // reset for new phase
	return h.current < len(h.phases), nil
}

func (h *HybridStrategy) SkipTo(_ context.Context, phaseID string) error {
	for i, p := range h.phases {
		if p.ID == phaseID {
			h.current = i
			h.consensus = make(map[uuid.UUID]bool)
			return nil
		}
	}
	return fmt.Errorf("engine/hybrid: phase %q not found", phaseID)
}

func (h *HybridStrategy) HandleTrigger(_ context.Context, triggerType string, _ json.RawMessage) (string, error) {
	if !h.started || h.current >= len(h.phases) {
		return "", nil
	}

	phase := h.phases[h.current]
	for _, trigger := range phase.Triggers {
		if trigger.Type == triggerType && trigger.TargetID != "" {
			return trigger.TargetID, nil
		}
	}
	return "", nil
}

func (h *HybridStrategy) HandleConsensus(_ context.Context, playerID uuid.UUID, action string) error {
	switch action {
	case "agree":
		h.consensus[playerID] = true
	case "disagree":
		delete(h.consensus, playerID)
	default:
		return fmt.Errorf("engine/hybrid: unknown consensus action %q", action)
	}
	return nil
}

// ConsensusCount returns how many players have agreed.
func (h *HybridStrategy) ConsensusCount() int {
	return len(h.consensus)
}

func (h *HybridStrategy) BuildState() map[string]any {
	return map[string]any{
		"strategy":       "hybrid",
		"current":        h.current,
		"totalPhases":    len(h.phases),
		"consensusCount": len(h.consensus),
	}
}

func (h *HybridStrategy) Cleanup(_ context.Context) error {
	h.phases = nil
	h.consensus = nil
	h.started = false
	return nil
}
