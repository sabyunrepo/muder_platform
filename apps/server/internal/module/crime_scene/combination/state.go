package combination

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

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

// BuildStateFor returns the same state as BuildState for now.
// PR-2a (F-sec-2 gate): satisfies engine.PlayerAwareModule interface.
// PR-2b will restrict completed/derived/collected entries to the requesting
// player's own progress, since revealing other players' combinations leaks
// strategic information.
func (m *CombinationModule) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	return m.BuildState()
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
