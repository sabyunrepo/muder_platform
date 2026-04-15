package crime_scene

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/clue"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("combination", func() engine.Module { return NewCombinationModule() })
}

// CombinationDef describes a single evidence combination recipe.
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
			if err := m.graph.AddDependency(clue.Dependency{
				ClueID:        clue.ClueID(c.OutputClueID),
				Prerequisites: prereqs,
				Mode:          clue.ModeAND,
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

// checkNewCombos resolves available combinations for a player and publishes events.
// Must be called without m.mu held (acquires RLock internally).
func (m *CombinationModule) checkNewCombos(playerID uuid.UUID) {
	m.mu.RLock()
	discovered := m.collectedAsClueMap(playerID)
	m.mu.RUnlock()

	available := m.graph.Resolve(discovered)
	for _, c := range available {
		// Notify only newly-resolvable output clues (those that have prerequisites).
		if _, hasDep := m.graph.DependenciesOf(c.ID); hasDep {
			m.deps.EventBus.Publish(engine.Event{
				Type: "combination.available",
				Payload: map[string]any{
					"playerID": playerID,
					"clueID":   string(c.ID),
				},
			})
		}
	}
}

func (m *CombinationModule) collectedAsClueMap(playerID uuid.UUID) map[clue.ClueID]bool {
	result := make(map[clue.ClueID]bool, len(m.collected[playerID]))
	for id := range m.collected[playerID] {
		result[clue.ClueID(id)] = true
	}
	return result
}

// HandleMessage processes player actions routed to this module.
func (m *CombinationModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "combine":
		return m.handleCombine(ctx, playerID, payload)
	default:
		return fmt.Errorf("combination: unknown message type %q", msgType)
	}
}

type combinePayload struct {
	EvidenceIDs []string `json:"evidence_ids"`
}

func (m *CombinationModule) handleCombine(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p combinePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("combination: invalid combine payload: %w", err)
	}
	if len(p.EvidenceIDs) == 0 {
		return fmt.Errorf("combination: combine requires at least one evidence_id")
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Find a matching combination def.
	combo, err := m.findCombo(p.EvidenceIDs)
	if err != nil {
		return err
	}

	// Verify player has all input evidence.
	for _, inputID := range combo.InputIDs {
		if !m.collected[playerID][inputID] {
			return fmt.Errorf("combination: invalid combine: missing evidence %q", inputID)
		}
	}

	// Check not already completed.
	if m.hasCompleted(playerID, combo.ID) {
		return nil // idempotent
	}

	m.completed[playerID] = append(m.completed[playerID], combo.ID)
	m.derived[playerID] = append(m.derived[playerID], combo.OutputClueID)

	m.deps.EventBus.Publish(engine.Event{
		Type: "combination.completed",
		Payload: map[string]any{
			"playerID":      playerID,
			"combinationID": combo.ID,
		},
	})
	m.deps.EventBus.Publish(engine.Event{
		Type: "combination.clue_unlocked",
		Payload: map[string]any{
			"playerID":     playerID,
			"outputClueID": combo.OutputClueID,
		},
	})
	return nil
}

// findCombo finds a CombinationDef whose InputIDs exactly match the provided set.
func (m *CombinationModule) findCombo(evidenceIDs []string) (CombinationDef, error) {
	inputSet := make(map[string]bool, len(evidenceIDs))
	for _, id := range evidenceIDs {
		inputSet[id] = true
	}
	for _, c := range m.comboByID {
		if len(c.InputIDs) != len(evidenceIDs) {
			continue
		}
		match := true
		for _, id := range c.InputIDs {
			if !inputSet[id] {
				match = false
				break
			}
		}
		if match {
			return c, nil
		}
	}
	return CombinationDef{}, fmt.Errorf("combination: no combination matches the provided evidence")
}

func (m *CombinationModule) hasCompleted(playerID uuid.UUID, comboID string) bool {
	for _, id := range m.completed[playerID] {
		if id == comboID {
			return true
		}
	}
	return false
}

// combinationState is the serialisable snapshot.
type combinationState struct {
	Completed map[string][]string `json:"completed"`
	Derived   map[string][]string `json:"derived"`
	Collected map[string][]string `json:"collected"`
}

func (m *CombinationModule) snapshot() combinationState {
	completed := make(map[string][]string, len(m.completed))
	for pid, ids := range m.completed {
		cp := make([]string, len(ids))
		copy(cp, ids)
		completed[pid.String()] = cp
	}
	derived := make(map[string][]string, len(m.derived))
	for pid, ids := range m.derived {
		cp := make([]string, len(ids))
		copy(cp, ids)
		derived[pid.String()] = cp
	}
	collected := make(map[string][]string, len(m.collected))
	for pid, evMap := range m.collected {
		ids := make([]string, 0, len(evMap))
		for id := range evMap {
			ids = append(ids, id)
		}
		collected[pid.String()] = ids
	}
	return combinationState{Completed: completed, Derived: derived, Collected: collected}
}

// BuildState returns the module's current state for client sync.
func (m *CombinationModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	s := m.snapshot()
	m.mu.RUnlock()
	return json.Marshal(s)
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

// --- GameEventHandler ---

// Validate checks whether a combine event is legal.
func (m *CombinationModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	if event.Type != "combination.combine" {
		return nil
	}
	var p combinePayload
	if err := json.Unmarshal(event.Payload, &p); err != nil {
		return fmt.Errorf("combination: invalid payload: %w", err)
	}
	m.mu.RLock()
	_, err := m.findCombo(p.EvidenceIDs)
	m.mu.RUnlock()
	return err
}

// Apply records a completed combination in response to a validated event.
func (m *CombinationModule) Apply(_ context.Context, event engine.GameEvent, _ *engine.GameState) error {
	if event.Type != "combination.combine" {
		return nil
	}
	var p combinePayload
	if err := json.Unmarshal(event.Payload, &p); err != nil {
		return fmt.Errorf("combination: apply: %w", err)
	}
	m.mu.Lock()
	combo, err := m.findCombo(p.EvidenceIDs)
	if err != nil {
		m.mu.Unlock()
		return err
	}
	if !m.hasCompleted(event.SessionID, combo.ID) {
		m.completed[event.SessionID] = append(m.completed[event.SessionID], combo.ID)
		m.derived[event.SessionID] = append(m.derived[event.SessionID], combo.OutputClueID)
	}
	m.mu.Unlock()
	return nil
}

// --- WinChecker ---

// CheckWin returns Won=true when the player holds all evidence in WinCombo.
func (m *CombinationModule) CheckWin(_ context.Context, state engine.GameState) (engine.WinResult, error) {
	if len(m.config.WinCombo) == 0 {
		return engine.WinResult{}, nil
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	for playerID, evMap := range m.collected {
		won := true
		for _, need := range m.config.WinCombo {
			if !evMap[need] {
				won = false
				break
			}
		}
		if won {
			return engine.WinResult{
				Won:       true,
				WinnerIDs: []uuid.UUID{playerID},
				Reason:    "combination: player collected all required evidence",
			}, nil
		}
	}
	_ = state
	return engine.WinResult{}, nil
}

// --- RuleProvider ---

// GetRules returns the rules contributed by this module.
func (m *CombinationModule) GetRules() []engine.Rule {
	logic, _ := json.Marshal(map[string]any{
		"some": []any{
			map[string]any{"var": "player.combinations"},
			map[string]any{"==": []any{map[string]any{"var": ""}, map[string]any{"var": "combination.targetID"}}},
		},
	})
	return []engine.Rule{
		{
			ID:          "has_combination",
			Description: "Player has completed the target combination",
			Logic:       logic,
		},
	}
}

// --- SerializableModule ---

// SaveState serialises combination progress for persistence.
func (m *CombinationModule) SaveState(_ context.Context) (engine.GameState, error) {
	m.mu.RLock()
	s := m.snapshot()
	m.mu.RUnlock()

	data, err := json.Marshal(s)
	if err != nil {
		return engine.GameState{}, fmt.Errorf("combination: save state: %w", err)
	}
	return engine.GameState{
		Modules: map[string]json.RawMessage{m.Name(): data},
	}, nil
}

// RestoreState deserialises a previously persisted state.
func (m *CombinationModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	var s combinationState
	if err := json.Unmarshal(raw, &s); err != nil {
		return fmt.Errorf("combination: restore state: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.completed = make(map[uuid.UUID][]string, len(s.Completed))
	for pidStr, ids := range s.Completed {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			return fmt.Errorf("combination: restore state: invalid playerID %q: %w", pidStr, err)
		}
		cp := make([]string, len(ids))
		copy(cp, ids)
		m.completed[pid] = cp
	}
	m.derived = make(map[uuid.UUID][]string, len(s.Derived))
	for pidStr, ids := range s.Derived {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			return fmt.Errorf("combination: restore state: invalid playerID %q: %w", pidStr, err)
		}
		cp := make([]string, len(ids))
		copy(cp, ids)
		m.derived[pid] = cp
	}
	m.collected = make(map[uuid.UUID]map[string]bool, len(s.Collected))
	for pidStr, ids := range s.Collected {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			return fmt.Errorf("combination: restore state: invalid playerID %q: %w", pidStr, err)
		}
		evMap := make(map[string]bool, len(ids))
		for _, id := range ids {
			evMap[id] = true
		}
		m.collected[pid] = evMap
	}
	return nil
}

// Compile-time interface assertions.
var (
	_ engine.Module             = (*CombinationModule)(nil)
	_ engine.GameEventHandler   = (*CombinationModule)(nil)
	_ engine.WinChecker         = (*CombinationModule)(nil)
	_ engine.RuleProvider       = (*CombinationModule)(nil)
	_ engine.SerializableModule = (*CombinationModule)(nil)
)
