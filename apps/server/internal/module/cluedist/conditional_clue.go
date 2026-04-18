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
	engine.Register("conditional_clue", func() engine.Module { return NewConditionalClueModule() })
}

// ConditionalClueConfig defines settings for the conditional clue module.
type ConditionalClueConfig struct {
	AnnounceToAll    bool             `json:"announceToAll"`
	AnnounceToFinder bool             `json:"announceToFinder"`
	Dependencies     []ClueDependency `json:"dependencies"`
}

// ClueDependency defines a clue that unlocks when prerequisites are met.
type ClueDependency struct {
	ClueID              string   `json:"clueId"`
	PrerequisiteClueIDs []string `json:"prerequisiteClueIds"`
	Mode                string   `json:"mode"` // "ALL" or "ANY"
}

// ConditionalClueModule manages clues that unlock based on prerequisite conditions.
type ConditionalClueModule struct {
	mu            sync.RWMutex
	deps          engine.ModuleDeps
	config        ConditionalClueConfig
	dependencies  []ClueDependency
	unlockedClues map[string]bool
	acquiredClues map[string]bool
}

// NewConditionalClueModule creates a new ConditionalClueModule instance.
func NewConditionalClueModule() *ConditionalClueModule {
	return &ConditionalClueModule{}
}

func (m *ConditionalClueModule) Name() string { return "conditional_clue" }

func (m *ConditionalClueModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.unlockedClues = make(map[string]bool)
	m.acquiredClues = make(map[string]bool)

	// Apply defaults.
	m.config = ConditionalClueConfig{
		AnnounceToAll:    false,
		AnnounceToFinder: true,
	}

	// Unmarshal directly into m.config — only provided JSON fields overwrite defaults.
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("conditional_clue: invalid config: %w", err)
		}
	}

	m.dependencies = m.config.Dependencies
	if m.dependencies == nil {
		m.dependencies = []ClueDependency{}
	}

	// Validate dependency modes.
	for i, dep := range m.dependencies {
		if dep.Mode == "" {
			m.dependencies[i].Mode = "ALL"
		}
		if dep.Mode != "ALL" && dep.Mode != "ANY" {
			return fmt.Errorf("conditional_clue: invalid mode %q for dependency %q (must be ALL or ANY)", dep.Mode, dep.ClueID)
		}
	}

	// Subscribe to clue.acquired events.
	deps.EventBus.Subscribe("clue.acquired", func(e engine.Event) {
		payload, ok := e.Payload.(map[string]any)
		if !ok {
			return
		}
		clueID, _ := payload["clueId"].(string)
		if clueID == "" {
			return
		}
		m.onClueAcquired(clueID)
	})

	return nil
}

// onClueAcquired processes a newly acquired clue and checks dependency chains.
func (m *ConditionalClueModule) onClueAcquired(clueID string) {
	m.mu.Lock()
	m.acquiredClues[clueID] = true
	m.mu.Unlock()

	m.checkDependencies()
}

// checkDependencies evaluates all dependencies and unlocks eligible clues.
// Supports chain reactions: unlocking one clue may satisfy another dependency.
func (m *ConditionalClueModule) checkDependencies() {
	for {
		var newlyUnlocked []string

		m.mu.Lock()
		for _, dep := range m.dependencies {
			if m.unlockedClues[dep.ClueID] {
				continue
			}
			if m.isDependencySatisfied(dep) {
				m.unlockedClues[dep.ClueID] = true
				m.acquiredClues[dep.ClueID] = true
				newlyUnlocked = append(newlyUnlocked, dep.ClueID)
			}
		}
		m.mu.Unlock()

		// Publish outside lock to avoid deadlocks.
		for _, clueID := range newlyUnlocked {
			m.publishUnlocked(clueID)
		}

		// If nothing was unlocked this pass, the chain is complete.
		if len(newlyUnlocked) == 0 {
			break
		}
	}
}

func (m *ConditionalClueModule) isDependencySatisfied(dep ClueDependency) bool {
	if len(dep.PrerequisiteClueIDs) == 0 {
		return true
	}
	switch dep.Mode {
	case "ANY":
		for _, prereq := range dep.PrerequisiteClueIDs {
			if m.acquiredClues[prereq] {
				return true
			}
		}
		return false
	default: // "ALL"
		for _, prereq := range dep.PrerequisiteClueIDs {
			if !m.acquiredClues[prereq] {
				return false
			}
		}
		return true
	}
}

func (m *ConditionalClueModule) publishUnlocked(clueID string) {
	m.deps.EventBus.Publish(engine.Event{
		Type: "clue.conditional_unlocked",
		Payload: map[string]any{
			"clueId":         clueID,
			"announceAll":    m.config.AnnounceToAll,
			"announceFinder": m.config.AnnounceToFinder,
		},
	})
}

func (m *ConditionalClueModule) HandleMessage(_ context.Context, _ uuid.UUID, msgType string, _ json.RawMessage) error {
	switch msgType {
	case "conditional:status":
		return nil // Status is returned via BuildState
	default:
		return fmt.Errorf("conditional_clue: unknown message type %q", msgType)
	}
}

type conditionalClueState struct {
	UnlockedClues map[string]bool  `json:"unlockedClues"`
	Dependencies  []ClueDependency `json:"dependencies"`
}

func (m *ConditionalClueModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Filter dependencies: only show those that are unlocked or have all prereqs visible.
	visibleDeps := make([]ClueDependency, 0, len(m.dependencies))
	for _, dep := range m.dependencies {
		if m.unlockedClues[dep.ClueID] || m.isDependencySatisfied(dep) {
			visibleDeps = append(visibleDeps, dep)
		}
	}

	return json.Marshal(conditionalClueState{
		UnlockedClues: m.unlockedClues,
		Dependencies:  visibleDeps,
	})
}

// BuildStateFor implements engine.PlayerAwareModule. Conditional-clue unlocks
// are broadcast via `clue.conditional_unlocked` events and the visible
// dependency list is already filtered to satisfied prerequisites, so the
// aggregate view carries no role-private data.
func (m *ConditionalClueModule) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	return m.BuildState()
}

func (m *ConditionalClueModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.unlockedClues = nil
	m.acquiredClues = nil
	m.dependencies = nil
	return nil
}

// --- ConfigSchema ---

func (m *ConditionalClueModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"announceToAll":    map[string]any{"type": "boolean", "default": false, "description": "Announce unlocked clues to all players"},
			"announceToFinder": map[string]any{"type": "boolean", "default": true, "description": "Announce unlocked clues to the finder"},
			"dependencies": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"clueId":              map[string]any{"type": "string"},
						"prerequisiteClueIds": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
						"mode":                map[string]any{"type": "string", "enum": []string{"ALL", "ANY"}, "default": "ALL"},
					},
					"required": []string{"clueId", "prerequisiteClueIds"},
				},
			},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

// --- GameEventHandler ---

func (m *ConditionalClueModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "clue.acquired", "conditional:status":
		return nil
	default:
		return fmt.Errorf("conditional_clue: unsupported event type %q", event.Type)
	}
}

func (m *ConditionalClueModule) Apply(_ context.Context, event engine.GameEvent, _ *engine.GameState) error {
	switch event.Type {
	case "clue.acquired":
		var payload struct {
			ClueID string `json:"clueId"`
		}
		if event.Payload != nil {
			if err := json.Unmarshal(event.Payload, &payload); err != nil {
				return fmt.Errorf("conditional_clue: invalid clue.acquired payload: %w", err)
			}
		}
		if payload.ClueID != "" {
			m.onClueAcquired(payload.ClueID)
		}
		return nil
	case "conditional:status":
		return nil
	default:
		return fmt.Errorf("conditional_clue: unsupported event type %q", event.Type)
	}
}

// --- RuleProvider ---

func (m *ConditionalClueModule) GetRules() []engine.Rule {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rules := make([]engine.Rule, 0, len(m.dependencies))
	for _, dep := range m.dependencies {
		var logic json.RawMessage
		if dep.Mode == "ANY" {
			// Any prerequisite unlocks the clue.
			orClauses := make([]any, 0, len(dep.PrerequisiteClueIDs))
			for _, prereq := range dep.PrerequisiteClueIDs {
				orClauses = append(orClauses, map[string]any{
					"var": "clues." + prereq,
				})
			}
			logic, _ = json.Marshal(map[string]any{"or": orClauses})
		} else {
			// All prerequisites required.
			andClauses := make([]any, 0, len(dep.PrerequisiteClueIDs))
			for _, prereq := range dep.PrerequisiteClueIDs {
				andClauses = append(andClauses, map[string]any{
					"var": "clues." + prereq,
				})
			}
			logic, _ = json.Marshal(map[string]any{"and": andClauses})
		}
		rules = append(rules, engine.Rule{
			ID:          fmt.Sprintf("conditional_unlock_%s", dep.ClueID),
			Description: fmt.Sprintf("Unlock %s when prerequisites met (%s)", dep.ClueID, dep.Mode),
			Logic:       logic,
		})
	}
	return rules
}

// Compile-time interface assertions.
var (
	_ engine.Module            = (*ConditionalClueModule)(nil)
	_ engine.ConfigSchema      = (*ConditionalClueModule)(nil)
	_ engine.GameEventHandler  = (*ConditionalClueModule)(nil)
	_ engine.RuleProvider      = (*ConditionalClueModule)(nil)
	_ engine.PlayerAwareModule = (*ConditionalClueModule)(nil)
)
