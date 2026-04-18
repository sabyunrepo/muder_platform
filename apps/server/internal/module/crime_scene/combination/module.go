// Package combination implements the evidence-combination module — takes a
// set of collected evidence IDs and, if they match a configured recipe,
// unlocks a derived "crafted" clue. Dependencies between clues are tracked
// via a clue.Graph so reveal rules respect CRAFT triggers.
package combination

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/clue"
	"github.com/mmp-platform/server/internal/engine"
)

// CombinationDef describes a single evidence combination recipe.
//
// Phase 20 PR-5: ID doubles as the `clue_edge_groups.id` identifier when the
// editor sources a CRAFT-trigger group. Clients MAY pass GroupID in a
// `combine` payload to match directly — otherwise findCombo falls back to
// matching the InputIDs set for backward compatibility.
type CombinationDef struct {
	ID           string   `json:"id"`
	InputIDs     []string `json:"inputIds"`
	OutputClueID string   `json:"outputClueId"`
	Description  string   `json:"description"`
}

// CombinationConfig defines settings for the combination module.
type CombinationConfig struct {
	Combinations []CombinationDef `json:"combinations"`
	WinCombo     []string         `json:"winCombination"` // evidence IDs needed to win
}

// CombinationModule tracks completed combinations and derived clues per player.
type CombinationModule struct {
	mu        sync.RWMutex
	deps      engine.ModuleDeps
	config    CombinationConfig
	comboByID map[string]CombinationDef // id → def
	graph     *clue.Graph
	completed map[uuid.UUID][]string        // playerID → completed combination IDs
	derived   map[uuid.UUID][]string        // playerID → derived clue IDs
	collected map[uuid.UUID]map[string]bool // playerID → collected evidenceIDs (mirrored from evidence events)
}

// NewCombinationModule creates a new CombinationModule instance.
func NewCombinationModule() *CombinationModule {
	return &CombinationModule{}
}

// Name returns the module identifier.
func (m *CombinationModule) Name() string { return "combination" }

// Init initialises the module with session context and configuration.
func (m *CombinationModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.comboByID = make(map[string]CombinationDef)
	m.completed = make(map[uuid.UUID][]string)
	m.derived = make(map[uuid.UUID][]string)
	m.collected = make(map[uuid.UUID]map[string]bool)
	m.graph = clue.NewGraph()

	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("combination: invalid config: %w", err)
		}
	}

	// Build clue graph: each combination maps inputIDs → outputClueID.
	// We register output clues as nodes and inputs as prerequisites.
	for _, c := range m.config.Combinations {
		if c.ID == "" {
			return fmt.Errorf("combination: combination missing id")
		}
		if c.OutputClueID == "" {
			return fmt.Errorf("combination: combination %q missing outputClueId", c.ID)
		}
		m.comboByID[c.ID] = c

		// Add output clue node if not already present.
		if _, exists := m.graph.Get(clue.ClueID(c.OutputClueID)); !exists {
			if err := m.graph.Add(clue.Clue{ID: clue.ClueID(c.OutputClueID), Name: c.Description}); err != nil {
				return fmt.Errorf("combination: graph add %q: %w", c.OutputClueID, err)
			}
		}
		// Add input nodes if not already present.
		prereqs := make([]clue.ClueID, 0, len(c.InputIDs))
		for _, inputID := range c.InputIDs {
			if _, exists := m.graph.Get(clue.ClueID(inputID)); !exists {
				if err := m.graph.Add(clue.Clue{ID: clue.ClueID(inputID), Name: inputID}); err != nil {
					return fmt.Errorf("combination: graph add input %q: %w", inputID, err)
				}
			}
			prereqs = append(prereqs, clue.ClueID(inputID))
		}
		if len(prereqs) > 0 {
			// Phase 20 PR-5: mark dependency as CRAFT so graph.Resolve does
			// NOT auto-unlock the output when prereqs are present. The output
			// is promoted to the `crafted` set only by a valid combine event.
			if err := m.graph.AddDependency(clue.Dependency{
				ClueID:        clue.ClueID(c.OutputClueID),
				Prerequisites: prereqs,
				Mode:          clue.ModeAND,
				Trigger:       clue.TriggerCRAFT,
			}); err != nil {
				return fmt.Errorf("combination: graph dep %q: %w", c.OutputClueID, err)
			}
		}
	}

	if m.graph.HasCycle() {
		return fmt.Errorf("combination: combination graph contains a cycle")
	}

	// Mirror evidence.collected events to track what each player has.
	deps.EventBus.Subscribe("evidence.collected", func(e engine.Event) {
		payload, ok := e.Payload.(map[string]any)
		if !ok {
			return
		}
		playerID, ok := payload["playerID"].(uuid.UUID)
		if !ok {
			return
		}
		evID, ok := payload["evidenceID"].(string)
		if !ok {
			return
		}
		m.mu.Lock()
		if m.collected[playerID] == nil {
			m.collected[playerID] = make(map[string]bool)
		}
		m.collected[playerID][evID] = true
		m.mu.Unlock()

		// Check if new combos become available.
		m.checkNewCombos(playerID)
	})

	return nil
}

// Cleanup releases resources when the session ends.
func (m *CombinationModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.comboByID = nil
	m.completed = nil
	m.derived = nil
	m.collected = nil
	m.graph = nil
	return nil
}

// Compile-time interface assertions.
var (
	_ engine.Module             = (*CombinationModule)(nil)
	_ engine.GameEventHandler   = (*CombinationModule)(nil)
	_ engine.WinChecker         = (*CombinationModule)(nil)
	_ engine.RuleProvider       = (*CombinationModule)(nil)
	_ engine.SerializableModule = (*CombinationModule)(nil)
	_ engine.PlayerAwareModule  = (*CombinationModule)(nil)
)

func init() {
	engine.Register("combination", func() engine.Module { return NewCombinationModule() })
}
