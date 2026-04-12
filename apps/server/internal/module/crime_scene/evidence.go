package crime_scene

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("evidence", func() engine.Module { return NewEvidenceModule() })
}

// EvidenceDef describes a single piece of evidence in the crime scene.
type EvidenceDef struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	LocationID string `json:"locationId"`
	Phase      string `json:"availableAtPhase"`
	Hidden     bool   `json:"hidden"`
}

// EvidenceConfig defines settings for the evidence module.
type EvidenceConfig struct {
	Evidence     []EvidenceDef `json:"evidence"`
	AutoDiscover bool          `json:"autoDiscover"`
}

// EvidenceModule tracks discovered and collected evidence per player.
type EvidenceModule struct {
	mu           sync.RWMutex
	deps         engine.ModuleDeps
	config       EvidenceConfig
	evidenceSet  map[string]EvidenceDef // id → def
	unlockedByID map[string]bool        // evidenceID → unlocked by current phase
	discovered   map[uuid.UUID][]string // playerID → discovered evidenceIDs
	collected    map[uuid.UUID][]string // playerID → collected evidenceIDs
}

// NewEvidenceModule creates a new EvidenceModule instance.
func NewEvidenceModule() *EvidenceModule {
	return &EvidenceModule{}
}

// Name returns the module identifier.
func (m *EvidenceModule) Name() string { return "evidence" }

// Init initialises the module with session context and configuration.
func (m *EvidenceModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.evidenceSet = make(map[string]EvidenceDef)
	m.unlockedByID = make(map[string]bool)
	m.discovered = make(map[uuid.UUID][]string)
	m.collected = make(map[uuid.UUID][]string)

	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("evidence: invalid config: %w", err)
		}
	}

	for _, ev := range m.config.Evidence {
		if ev.ID == "" {
			return fmt.Errorf("evidence: evidence missing id")
		}
		m.evidenceSet[ev.ID] = ev
		// Evidence with no phase gate is unlocked from the start.
		if ev.Phase == "" {
			m.unlockedByID[ev.ID] = true
		}
	}

	// Subscribe to location.examined for auto-discover.
	if m.config.AutoDiscover {
		deps.EventBus.Subscribe("location.examined", func(e engine.Event) {
			payload, ok := e.Payload.(map[string]any)
			if !ok {
				return
			}
			playerID, ok := payload["playerID"].(uuid.UUID)
			if !ok {
				return
			}
			locationID, ok := payload["locationID"].(string)
			if !ok {
				return
			}
			m.autoDiscover(playerID, locationID)
		})
	}

	return nil
}

// autoDiscover finds all non-hidden, unlocked evidence at a location and marks it discovered.
func (m *EvidenceModule) autoDiscover(playerID uuid.UUID, locationID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, ev := range m.evidenceSet {
		if ev.LocationID != locationID || ev.Hidden || !m.unlockedByID[id] {
			continue
		}
		if !m.hasDiscovered(playerID, id) {
			m.discovered[playerID] = append(m.discovered[playerID], id)
			m.deps.EventBus.Publish(engine.Event{
				Type: "evidence.discovered",
				Payload: map[string]any{
					"playerID":   playerID,
					"evidenceID": id,
				},
			})
		}
	}
}

func (m *EvidenceModule) hasDiscovered(playerID uuid.UUID, evID string) bool {
	for _, id := range m.discovered[playerID] {
		if id == evID {
			return true
		}
	}
	return false
}

func (m *EvidenceModule) hasCollected(playerID uuid.UUID, evID string) bool {
	for _, id := range m.collected[playerID] {
		if id == evID {
			return true
		}
	}
	return false
}

// HandleMessage processes player actions routed to this module.
func (m *EvidenceModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "discover":
		return m.handleDiscover(ctx, playerID, payload)
	case "collect":
		return m.handleCollect(ctx, playerID, payload)
	default:
		return fmt.Errorf("evidence: unknown message type %q", msgType)
	}
}

type evidencePayload struct {
	EvidenceID string `json:"evidence_id"`
	LocationID string `json:"location_id"`
}

func (m *EvidenceModule) handleDiscover(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p evidencePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("evidence: invalid discover payload: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	ev, ok := m.evidenceSet[p.EvidenceID]
	if !ok {
		return fmt.Errorf("evidence: invalid discover: evidence %q not found", p.EvidenceID)
	}
	if !m.unlockedByID[p.EvidenceID] {
		return fmt.Errorf("evidence: invalid discover: evidence %q not yet unlocked", p.EvidenceID)
	}
	if p.LocationID != "" && ev.LocationID != p.LocationID {
		return fmt.Errorf("evidence: invalid discover: wrong location for evidence %q", p.EvidenceID)
	}
	if m.hasDiscovered(playerID, p.EvidenceID) {
		return nil // idempotent
	}

	m.discovered[playerID] = append(m.discovered[playerID], p.EvidenceID)
	m.deps.EventBus.Publish(engine.Event{
		Type: "evidence.discovered",
		Payload: map[string]any{
			"playerID":   playerID,
			"evidenceID": p.EvidenceID,
		},
	})
	return nil
}

func (m *EvidenceModule) handleCollect(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p evidencePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("evidence: invalid collect payload: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.evidenceSet[p.EvidenceID]; !ok {
		return fmt.Errorf("evidence: invalid collect: evidence %q not found", p.EvidenceID)
	}
	if !m.hasDiscovered(playerID, p.EvidenceID) {
		return fmt.Errorf("evidence: invalid collect: evidence %q not yet discovered", p.EvidenceID)
	}
	if m.hasCollected(playerID, p.EvidenceID) {
		return nil // idempotent
	}

	m.collected[playerID] = append(m.collected[playerID], p.EvidenceID)
	m.deps.EventBus.Publish(engine.Event{
		Type: "evidence.collected",
		Payload: map[string]any{
			"playerID":   playerID,
			"evidenceID": p.EvidenceID,
		},
	})
	return nil
}

// evidenceState is the serialisable snapshot.
type evidenceState struct {
	Discovered map[string][]string `json:"discovered"`
	Collected  map[string][]string `json:"collected"`
}

func (m *EvidenceModule) snapshot() evidenceState {
	disc := make(map[string][]string, len(m.discovered))
	for pid, ids := range m.discovered {
		cp := make([]string, len(ids))
		copy(cp, ids)
		disc[pid.String()] = cp
	}
	coll := make(map[string][]string, len(m.collected))
	for pid, ids := range m.collected {
		cp := make([]string, len(ids))
		copy(cp, ids)
		coll[pid.String()] = cp
	}
	return evidenceState{Discovered: disc, Collected: coll}
}

// BuildState returns the module's current state for client sync.
func (m *EvidenceModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	s := m.snapshot()
	m.mu.RUnlock()
	return json.Marshal(s)
}

// Cleanup releases resources when the session ends.
func (m *EvidenceModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.evidenceSet = nil
	m.discovered = nil
	m.collected = nil
	m.unlockedByID = nil
	return nil
}

// --- GameEventHandler ---

// Validate checks whether an evidence discover/collect event is legal.
func (m *EvidenceModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "evidence.discover", "evidence.collect":
	default:
		return nil
	}
	var p evidencePayload
	if err := json.Unmarshal(event.Payload, &p); err != nil {
		return fmt.Errorf("evidence: invalid payload: %w", err)
	}
	m.mu.RLock()
	_, ok := m.evidenceSet[p.EvidenceID]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("evidence: evidence %q not found", p.EvidenceID)
	}
	return nil
}

// Apply adds evidence to player inventory in response to a validated event.
func (m *EvidenceModule) Apply(_ context.Context, event engine.GameEvent, _ *engine.GameState) error {
	var p evidencePayload
	switch event.Type {
	case "evidence.discover":
		if err := json.Unmarshal(event.Payload, &p); err != nil {
			return fmt.Errorf("evidence: apply discover: %w", err)
		}
		m.mu.Lock()
		if !m.hasDiscovered(event.SessionID, p.EvidenceID) {
			m.discovered[event.SessionID] = append(m.discovered[event.SessionID], p.EvidenceID)
		}
		m.mu.Unlock()
	case "evidence.collect":
		if err := json.Unmarshal(event.Payload, &p); err != nil {
			return fmt.Errorf("evidence: apply collect: %w", err)
		}
		m.mu.Lock()
		if !m.hasCollected(event.SessionID, p.EvidenceID) {
			m.collected[event.SessionID] = append(m.collected[event.SessionID], p.EvidenceID)
		}
		m.mu.Unlock()
	}
	return nil
}

// --- PhaseHookModule ---

// OnPhaseEnter unlocks phase-gated evidence when the session enters the matching phase.
func (m *EvidenceModule) OnPhaseEnter(_ context.Context, phase engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, ev := range m.evidenceSet {
		if ev.Phase == string(phase) && !m.unlockedByID[id] {
			m.unlockedByID[id] = true
			m.deps.EventBus.Publish(engine.Event{
				Type: "evidence.unlocked",
				Payload: map[string]any{
					"evidenceID": id,
					"phase":      phase,
				},
			})
		}
	}
	return nil
}

// OnPhaseExit is a no-op for the evidence module.
func (m *EvidenceModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	return nil
}

// --- SerializableModule ---

// SaveState serialises discovered and collected evidence for persistence.
func (m *EvidenceModule) SaveState(_ context.Context) (engine.GameState, error) {
	m.mu.RLock()
	s := m.snapshot()
	m.mu.RUnlock()

	data, err := json.Marshal(s)
	if err != nil {
		return engine.GameState{}, fmt.Errorf("evidence: save state: %w", err)
	}
	return engine.GameState{
		Modules: map[string]json.RawMessage{m.Name(): data},
	}, nil
}

// RestoreState deserialises a previously persisted state.
func (m *EvidenceModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	var s evidenceState
	if err := json.Unmarshal(raw, &s); err != nil {
		return fmt.Errorf("evidence: restore state: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.discovered = make(map[uuid.UUID][]string, len(s.Discovered))
	for pidStr, ids := range s.Discovered {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			return fmt.Errorf("evidence: restore state: invalid playerID %q: %w", pidStr, err)
		}
		cp := make([]string, len(ids))
		copy(cp, ids)
		m.discovered[pid] = cp
	}
	m.collected = make(map[uuid.UUID][]string, len(s.Collected))
	for pidStr, ids := range s.Collected {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			return fmt.Errorf("evidence: restore state: invalid playerID %q: %w", pidStr, err)
		}
		cp := make([]string, len(ids))
		copy(cp, ids)
		m.collected[pid] = cp
	}
	return nil
}

// Compile-time interface assertions.
var (
	_ engine.Module             = (*EvidenceModule)(nil)
	_ engine.GameEventHandler   = (*EvidenceModule)(nil)
	_ engine.PhaseHookModule    = (*EvidenceModule)(nil)
	_ engine.SerializableModule = (*EvidenceModule)(nil)
)
