package cluedist

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("round_clue", func() engine.Module { return NewRoundClueModule() })
}

// RoundClueConfig defines settings for the round clue module.
type RoundClueConfig struct {
	DistributeMode string              `json:"distributeMode"`
	AnnouncePublic bool                `json:"announcePublic"`
	Distributions  []RoundDistribution `json:"distributions"`
}

// RoundDistribution defines a clue to distribute at a specific round.
type RoundDistribution struct {
	Round      int    `json:"round"`
	ClueID     string `json:"clueId"`
	TargetCode string `json:"targetCode"`
	Mode       string `json:"mode"` // overrides global DistributeMode if set
}

// RoundClueModule distributes clues at specific round transitions.
type RoundClueModule struct {
	mu                sync.RWMutex
	deps              engine.ModuleDeps
	config            RoundClueConfig
	distributions     []RoundDistribution
	distributedRounds map[int]bool
	currentRound      int
}

// NewRoundClueModule creates a new RoundClueModule instance.
func NewRoundClueModule() *RoundClueModule {
	return &RoundClueModule{}
}

func (m *RoundClueModule) Name() string { return "round_clue" }

func (m *RoundClueModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.distributedRounds = make(map[int]bool)
	m.currentRound = 0

	// Apply defaults.
	m.config = RoundClueConfig{
		DistributeMode: "specific",
		AnnouncePublic: true,
	}

	// Unmarshal directly into m.config — only provided JSON fields overwrite defaults.
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("round_clue: invalid config: %w", err)
		}
	}

	// Validate distribute mode.
	switch m.config.DistributeMode {
	case "specific", "random", "all":
		// valid
	default:
		return fmt.Errorf("round_clue: invalid distributeMode %q", m.config.DistributeMode)
	}

	m.distributions = m.config.Distributions
	if m.distributions == nil {
		m.distributions = []RoundDistribution{}
	}

	// Subscribe to phase changes to detect round transitions.
	deps.EventBus.Subscribe("phase.changed", func(e engine.Event) {
		payload, ok := e.Payload.(map[string]any)
		if !ok {
			return
		}
		// Extract round number from phase change payload.
		roundNum, ok := payload["round"]
		if !ok {
			return
		}
		var round int
		switch v := roundNum.(type) {
		case float64:
			round = int(v)
		case int:
			round = v
		default:
			return
		}
		m.onRoundChanged(round)
	})

	return nil
}

// onRoundChanged processes a round change and distributes applicable clues.
func (m *RoundClueModule) onRoundChanged(round int) {
	m.mu.Lock()
	m.currentRound = round
	if m.distributedRounds[round] {
		m.mu.Unlock()
		return
	}
	m.distributedRounds[round] = true

	// Collect distributions for this round.
	var toDistribute []RoundDistribution
	for _, dist := range m.distributions {
		if dist.Round == round {
			toDistribute = append(toDistribute, dist)
		}
	}
	mode := m.config.DistributeMode
	announcePublic := m.config.AnnouncePublic
	m.mu.Unlock()

	for _, dist := range toDistribute {
		effectiveMode := mode
		if dist.Mode != "" {
			effectiveMode = dist.Mode
		}

		m.deps.EventBus.Publish(engine.Event{
			Type: "clue.round_distributed",
			Payload: map[string]any{
				"round":          round,
				"clueId":         dist.ClueID,
				"targetCode":     dist.TargetCode,
				"mode":           effectiveMode,
				"announcePublic": announcePublic,
			},
		})
	}
}

func (m *RoundClueModule) HandleMessage(_ context.Context, _ uuid.UUID, msgType string, _ json.RawMessage) error {
	switch msgType {
	case "round_clue:status":
		return nil // Status is returned via BuildState
	default:
		return fmt.Errorf("round_clue: unknown message type %q", msgType)
	}
}

type roundClueState struct {
	CurrentRound      int          `json:"currentRound"`
	DistributedRounds map[int]bool `json:"distributedRounds"`
}

func (m *RoundClueModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(roundClueState{
		CurrentRound:      m.currentRound,
		DistributedRounds: m.distributedRounds,
	})
}

// BuildStateFor implements engine.PlayerAwareModule. Round-clue state tracks
// only which rounds have already triggered their distribution — distribution
// itself is broadcast via `clue.round_distributed` events, so this aggregate
// view carries no role-private data and is safe to share with every player.
func (m *RoundClueModule) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	return m.BuildState()
}

func (m *RoundClueModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.distributions = nil
	m.distributedRounds = nil
	return nil
}

// --- ConfigSchema ---

func (m *RoundClueModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"distributeMode": map[string]any{
				"type":        "string",
				"enum":        []string{"specific", "random", "all"},
				"default":     "specific",
				"description": "How clues are distributed each round",
			},
			"announcePublic": map[string]any{"type": "boolean", "default": true, "description": "Announce round clue distribution publicly"},
			"distributions": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"round":      map[string]any{"type": "integer", "minimum": 1},
						"clueId":     map[string]any{"type": "string"},
						"targetCode": map[string]any{"type": "string"},
						"mode":       map[string]any{"type": "string", "enum": []string{"specific", "random", "all"}},
					},
					"required": []string{"round", "clueId"},
				},
			},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

// --- PhaseHookModule ---

func (m *RoundClueModule) OnPhaseEnter(_ context.Context, phase engine.Phase) error {
	// Phase names may encode round info (e.g. "round_1", "discussion_2").
	// EventBus subscription in Init() remains the primary trigger since
	// phase.changed payload carries the round number explicitly.
	return nil
}

func (m *RoundClueModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	return nil
}

// --- GameEventHandler ---

func (m *RoundClueModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	if event.Type != "round_clue:status" {
		return fmt.Errorf("round_clue: unsupported event type %q", event.Type)
	}
	return nil
}

func (m *RoundClueModule) Apply(_ context.Context, event engine.GameEvent, _ *engine.GameState) error {
	if event.Type != "round_clue:status" {
		return fmt.Errorf("round_clue: unsupported event type %q", event.Type)
	}
	// Status queries are read-only; state is returned via BuildState.
	return nil
}

// --- SerializableModule ---

func (m *RoundClueModule) SaveState(_ context.Context) (engine.GameState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	data, err := json.Marshal(roundClueState{
		CurrentRound:      m.currentRound,
		DistributedRounds: m.distributedRounds,
	})
	if err != nil {
		return engine.GameState{}, fmt.Errorf("round_clue: save state: %w", err)
	}
	return engine.GameState{
		Modules: map[string]json.RawMessage{
			m.Name(): data,
		},
	}, nil
}

func (m *RoundClueModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	var s roundClueState
	if err := json.Unmarshal(raw, &s); err != nil {
		return fmt.Errorf("round_clue: restore state: %w", err)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.currentRound = s.CurrentRound
	m.distributedRounds = s.DistributedRounds
	if m.distributedRounds == nil {
		m.distributedRounds = make(map[int]bool)
	}
	return nil
}

// --- RuleProvider ---

func (m *RoundClueModule) GetRules() []engine.Rule {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rules := make([]engine.Rule, 0, len(m.distributions))
	for _, dist := range m.distributions {
		logic, _ := json.Marshal(map[string]any{
			"==": []any{map[string]any{"var": "round"}, dist.Round},
		})
		rules = append(rules, engine.Rule{
			ID:          fmt.Sprintf("round_clue_r%d_%s", dist.Round, dist.ClueID),
			Description: fmt.Sprintf("Distribute clue %s at round %d", dist.ClueID, dist.Round),
			Logic:       logic,
		})
	}
	return rules
}

// Compile-time interface assertions.
var (
	_ engine.Module             = (*RoundClueModule)(nil)
	_ engine.ConfigSchema       = (*RoundClueModule)(nil)
	_ engine.PhaseHookModule    = (*RoundClueModule)(nil)
	_ engine.GameEventHandler   = (*RoundClueModule)(nil)
	_ engine.SerializableModule = (*RoundClueModule)(nil)
	_ engine.RuleProvider       = (*RoundClueModule)(nil)
)
