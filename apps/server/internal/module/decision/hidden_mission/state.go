package hidden_mission

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

type hiddenMissionState struct {
	Scores         map[uuid.UUID]int       `json:"scores,omitempty"`
	PlayerMissions map[uuid.UUID][]Mission `json:"playerMissions,omitempty"`
	Config         HiddenMissionConfig     `json:"config"`
}

// BuildState returns the public module state for client sync.
func (m *HiddenMissionModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := hiddenMissionState{
		Config: m.config,
	}

	// Scores are only visible at ending.
	if m.config.ShowResultAt == "ending" {
		state.Scores = m.scores
	}

	// Player missions are always included (filtered per-player by upstream).
	state.PlayerMissions = m.playerMissions

	return json.Marshal(state)
}

// BuildStateFor implements engine.PlayerAwareModule — redacts other players'
// missions (only the caller's own missions are ever disclosed). Scores remain
// hidden until ShowResultAt == "ending", mirroring BuildState().
func (m *HiddenMissionModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := hiddenMissionState{
		Config: m.config,
	}

	if m.config.ShowResultAt == "ending" {
		state.Scores = m.scores
	}

	if own, ok := m.playerMissions[playerID]; ok && len(own) > 0 {
		state.PlayerMissions = map[uuid.UUID][]Mission{playerID: own}
	}

	return json.Marshal(state)
}

// --- SerializableModule ---

type hiddenMissionSavedState struct {
	Config            HiddenMissionConfig  `json:"config"`
	PlayerMissions    map[string][]Mission `json:"playerMissions"`
	CompletedMissions map[string][]string  `json:"completedMissions"`
	Scores            map[string]int       `json:"scores"`
}

// SaveState snapshots the module's persistable state.
func (m *HiddenMissionModule) SaveState(_ context.Context) (engine.GameState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	pm := make(map[string][]Mission, len(m.playerMissions))
	for pid, missions := range m.playerMissions {
		pm[pid.String()] = missions
	}
	cm := make(map[string][]string, len(m.completedMissions))
	for pid, ids := range m.completedMissions {
		cm[pid.String()] = ids
	}
	sc := make(map[string]int, len(m.scores))
	for pid, score := range m.scores {
		sc[pid.String()] = score
	}

	data, err := json.Marshal(hiddenMissionSavedState{
		Config:            m.config,
		PlayerMissions:    pm,
		CompletedMissions: cm,
		Scores:            sc,
	})
	if err != nil {
		return engine.GameState{}, fmt.Errorf("hidden_mission: save state: %w", err)
	}
	return engine.GameState{Modules: map[string]json.RawMessage{m.Name(): data}}, nil
}

// RestoreState deserialises a previously persisted state.
func (m *HiddenMissionModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	var s hiddenMissionSavedState
	if err := json.Unmarshal(raw, &s); err != nil {
		return fmt.Errorf("hidden_mission: restore state: %w", err)
	}

	pm := make(map[uuid.UUID][]Mission, len(s.PlayerMissions))
	for pidStr, missions := range s.PlayerMissions {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			continue
		}
		pm[pid] = missions
	}
	cm := make(map[uuid.UUID][]string, len(s.CompletedMissions))
	for pidStr, ids := range s.CompletedMissions {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			continue
		}
		cm[pid] = ids
	}
	sc := make(map[uuid.UUID]int, len(s.Scores))
	for pidStr, score := range s.Scores {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			continue
		}
		sc[pid] = score
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	m.config = s.Config
	m.playerMissions = pm
	m.completedMissions = cm
	m.scores = sc
	return nil
}
