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
	engine.Register("starting_clue", func() engine.Module { return NewStartingClueModule() })
}

// StartingClueConfig defines settings for the starting clue module.
type StartingClueConfig struct {
	DistributeAt  string              `json:"distributeAt"`
	NotifyPlayer  bool                `json:"notifyPlayer"`
	StartingClues map[string][]string `json:"startingClues"` // characterCode → clueIDs
}

// StartingClueModule distributes initial clues to characters at a configured trigger point.
type StartingClueModule struct {
	mu            sync.RWMutex
	deps          engine.ModuleDeps
	config        StartingClueConfig
	distributions map[string][]string // characterCode → clueIDs
	distributed   bool
}

// NewStartingClueModule creates a new StartingClueModule instance.
func NewStartingClueModule() *StartingClueModule {
	return &StartingClueModule{}
}

func (m *StartingClueModule) Name() string { return "starting_clue" }

func (m *StartingClueModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.distributed = false

	// Apply defaults.
	m.config = StartingClueConfig{
		DistributeAt: "game_start",
		NotifyPlayer: true,
	}

	// Unmarshal directly into m.config — only provided JSON fields overwrite defaults.
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("starting_clue: invalid config: %w", err)
		}
	}

	// Validate distributeAt.
	switch m.config.DistributeAt {
	case "game_start", "first_phase", "after_reading":
		// valid
	default:
		return fmt.Errorf("starting_clue: invalid distributeAt %q", m.config.DistributeAt)
	}

	m.distributions = m.config.StartingClues
	if m.distributions == nil {
		m.distributions = make(map[string][]string)
	}

	// Map distributeAt to the appropriate EventBus event.
	triggerEvent := m.mapTriggerEvent()
	deps.EventBus.Subscribe(triggerEvent, func(_ engine.Event) {
		m.distribute()
	})

	return nil
}

// mapTriggerEvent returns the EventBus event type for the configured trigger.
func (m *StartingClueModule) mapTriggerEvent() string {
	switch m.config.DistributeAt {
	case "first_phase":
		return "phase.changed"
	case "after_reading":
		return "reading.completed"
	default: // "game_start"
		return "game.started"
	}
}

// distribute sends starting clues to each character.
func (m *StartingClueModule) distribute() {
	m.mu.Lock()
	if m.distributed {
		m.mu.Unlock()
		return
	}
	m.distributed = true
	dists := make(map[string][]string, len(m.distributions))
	for k, v := range m.distributions {
		dists[k] = v
	}
	m.mu.Unlock()

	for charCode, clueIDs := range dists {
		m.deps.EventBus.Publish(engine.Event{
			Type: "clue.starting_distributed",
			Payload: map[string]any{
				"characterCode": charCode,
				"clueIds":       clueIDs,
				"notify":        m.config.NotifyPlayer,
			},
		})
	}
}

func (m *StartingClueModule) HandleMessage(_ context.Context, _ uuid.UUID, msgType string, _ json.RawMessage) error {
	switch msgType {
	case "starting:status":
		return nil // Status is returned via BuildState
	default:
		return fmt.Errorf("starting_clue: unknown message type %q", msgType)
	}
}

type startingClueState struct {
	Distributed        bool                `json:"distributed"`
	DistributionConfig map[string][]string `json:"distributionConfig"`
}

func (m *StartingClueModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(startingClueState{
		Distributed:        m.distributed,
		DistributionConfig: m.distributions,
	})
}

func (m *StartingClueModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.distributions = nil
	return nil
}

// --- ConfigSchema ---

func (m *StartingClueModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"distributeAt": map[string]any{
				"type":    "string",
				"enum":    []string{"game_start", "first_phase", "after_reading"},
				"default": "game_start",
				"description": "When to distribute starting clues",
			},
			"notifyPlayer": map[string]any{"type": "boolean", "default": true, "description": "Notify player when starting clues are distributed"},
			"startingClues": map[string]any{
				"type": "object",
				"additionalProperties": map[string]any{
					"type":  "array",
					"items": map[string]any{"type": "string"},
				},
				"description": "Map of characterCode to array of clue IDs",
			},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

// --- PhaseHookModule ---

func (m *StartingClueModule) OnPhaseEnter(_ context.Context, phase engine.Phase) error {
	// Distribute on phase entry based on distributeAt config.
	// The once-only guard in distribute() prevents double execution
	// when EventBus subscription also fires.
	switch m.config.DistributeAt {
	case "game_start", "first_phase":
		m.distribute()
	case "after_reading":
		// "after_reading" is not a phase name but a game event;
		// handled by EventBus subscription in Init().
	}
	return nil
}

func (m *StartingClueModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	return nil
}

// --- SerializableModule ---

func (m *StartingClueModule) SaveState(_ context.Context) (engine.GameState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	data, err := json.Marshal(startingClueState{
		Distributed:        m.distributed,
		DistributionConfig: m.distributions,
	})
	if err != nil {
		return engine.GameState{}, fmt.Errorf("starting_clue: save state: %w", err)
	}
	return engine.GameState{
		Modules: map[string]json.RawMessage{
			m.Name(): data,
		},
	}, nil
}

func (m *StartingClueModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	var s startingClueState
	if err := json.Unmarshal(raw, &s); err != nil {
		return fmt.Errorf("starting_clue: restore state: %w", err)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.distributed = s.Distributed
	m.distributions = s.DistributionConfig
	if m.distributions == nil {
		m.distributions = make(map[string][]string)
	}
	return nil
}

// Compile-time interface assertions.
var (
	_ engine.Module             = (*StartingClueModule)(nil)
	_ engine.ConfigSchema       = (*StartingClueModule)(nil)
	_ engine.PhaseHookModule    = (*StartingClueModule)(nil)
	_ engine.SerializableModule = (*StartingClueModule)(nil)
)
