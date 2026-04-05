package progression

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// HybridProgressionModule combines consensus-based and event-driven phase advancement.
type HybridProgressionModule struct {
	mu   sync.RWMutex
	deps engine.ModuleDeps

	// config
	consensusThreshold      int
	defaultAdvanceCondition string

	// state
	consensusVotes map[uuid.UUID]bool
}

type hybridProgressionConfig struct {
	ConsensusThreshold      int    `json:"ConsensusThreshold"`
	DefaultAdvanceCondition string `json:"DefaultAdvanceCondition"`
}

// NewHybridProgressionModule creates a new HybridProgressionModule instance.
func NewHybridProgressionModule() *HybridProgressionModule {
	return &HybridProgressionModule{}
}

func (m *HybridProgressionModule) Name() string { return "hybrid_progression" }

func (m *HybridProgressionModule) Init(ctx context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps

	var cfg hybridProgressionConfig
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("hybrid_progression: invalid config: %w", err)
		}
	}

	// Apply defaults
	if cfg.ConsensusThreshold <= 0 {
		cfg.ConsensusThreshold = 70
	}

	m.consensusThreshold = cfg.ConsensusThreshold
	m.defaultAdvanceCondition = cfg.DefaultAdvanceCondition
	m.consensusVotes = make(map[uuid.UUID]bool)

	return nil
}

func (m *HybridProgressionModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	m.mu.Lock()

	switch msgType {
	case "hybrid:consensus_vote":
		var p struct {
			Vote bool `json:"Vote"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("hybrid_progression: invalid payload: %w", err)
		}
		m.consensusVotes[playerID] = p.Vote

		// Check threshold
		consensusReached := m.checkConsensus()
		threshold := m.consensusThreshold
		m.mu.Unlock()

		if consensusReached {
			m.deps.EventBus.Publish(engine.Event{
				Type:    "hybrid.consensus_reached",
				Payload: map[string]any{"threshold": threshold},
			})
		}
		return nil

	case "hybrid:trigger_event":
		var p struct {
			EventID string `json:"EventID"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("hybrid_progression: invalid payload: %w", err)
		}
		m.mu.Unlock()

		m.deps.EventBus.Publish(engine.Event{
			Type:    "hybrid.trigger_fired",
			Payload: map[string]any{"eventID": p.EventID},
		})
		return nil

	default:
		m.mu.Unlock()
		return fmt.Errorf("hybrid_progression: unknown message type %q", msgType)
	}
}

// checkConsensus returns true if the approval ratio meets the threshold.
// Must be called with m.mu held.
func (m *HybridProgressionModule) checkConsensus() bool {
	total := len(m.consensusVotes)
	if total == 0 {
		return false
	}
	approvals := 0
	for _, v := range m.consensusVotes {
		if v {
			approvals++
		}
	}
	ratio := (approvals * 100) / total
	return ratio >= m.consensusThreshold
}

func (m *HybridProgressionModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	votes := make(map[string]bool, len(m.consensusVotes))
	for id, v := range m.consensusVotes {
		votes[id.String()] = v
	}

	state := map[string]any{
		"consensusThreshold": m.consensusThreshold,
		"votes":              votes,
		"conditionMet":       m.checkConsensus(),
	}
	return json.Marshal(state)
}

func (m *HybridProgressionModule) Cleanup(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.consensusVotes = nil
	return nil
}

// Schema returns the JSON Schema for HybridProgressionModule settings.
func (m *HybridProgressionModule) Schema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"ConsensusThreshold": {"type": "integer", "default": 70, "minimum": 1, "maximum": 100},
			"DefaultAdvanceCondition": {"type": "string"}
		}
	}`)
}

func init() {
	engine.Register("hybrid_progression", func() engine.Module { return NewHybridProgressionModule() })
}
