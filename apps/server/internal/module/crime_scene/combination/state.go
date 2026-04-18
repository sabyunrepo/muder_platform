package combination

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

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
		sort.Strings(ids) // deterministic JSON for snapshot diffing
		collected[pid.String()] = ids
	}
	return combinationState{Completed: completed, Derived: derived, Collected: collected}
}

// snapshotFor returns a combinationState disclosing only the calling player's
// completed combinations, derived ("crafted") clues, and collected evidence.
// Other players' entries are elided to uphold the D-MO-1 redaction boundary:
// revealing that peer X has already crafted a clue leaks strategic intel.
//
// When playerID is uuid.Nil the function returns an empty (non-nil) shape.
// uuid.Nil is an ambiguous identity that could accidentally alias a stray
// map entry if a peer module ever publishes evidence.collected with a
// zero-value playerID — returning empty here closes that vector at the
// redaction layer, independently of upstream input validation.
func (m *CombinationModule) snapshotFor(playerID uuid.UUID) combinationState {
	s := combinationState{
		Completed: map[string][]string{},
		Derived:   map[string][]string{},
		Collected: map[string][]string{},
	}
	if playerID == uuid.Nil {
		return s
	}
	key := playerID.String()
	if ids := m.completed[playerID]; len(ids) > 0 {
		cp := make([]string, len(ids))
		copy(cp, ids)
		s.Completed[key] = cp
	}
	if ids := m.derived[playerID]; len(ids) > 0 {
		cp := make([]string, len(ids))
		copy(cp, ids)
		s.Derived[key] = cp
	}
	if evMap := m.collected[playerID]; len(evMap) > 0 {
		ids := make([]string, 0, len(evMap))
		for id := range evMap {
			ids = append(ids, id)
		}
		sort.Strings(ids) // deterministic JSON regardless of map iteration
		s.Collected[key] = ids
	}
	return s
}

// BuildState returns the combination module state combining every player's
// progress. Reserved for persistence (SaveState) and admin/test fixtures —
// the runtime broadcast path goes through BuildStateFor via the PR-2a engine
// gate, so this payload never reaches clients.
func (m *CombinationModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	s := m.snapshot()
	m.mu.RUnlock()
	return json.Marshal(s)
}

// BuildStateFor implements engine.PlayerAwareModule with per-player redaction
// (D-MO-1): only the caller's completed, derived, and collected sets are
// disclosed. Solves Phase 18.1 B-2 where the combination snapshot leaked
// every player's crafted clue map to every client.
func (m *CombinationModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	s := m.snapshotFor(playerID)
	m.mu.RUnlock()
	return json.Marshal(s)
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
