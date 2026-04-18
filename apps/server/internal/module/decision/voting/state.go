package voting

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

type votingState struct {
	IsOpen       bool              `json:"isOpen"`
	CurrentRound int               `json:"currentRound"`
	Config       VotingConfig      `json:"config"`
	Votes        map[string]string `json:"votes,omitempty"`      // only in open mode
	VotedCount   int               `json:"votedCount,omitempty"` // only in secret mode
	Winner       string            `json:"winner,omitempty"`
	Round        int               `json:"round,omitempty"`
}

// BuildState returns the public module state for client sync.
func (m *VotingModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := votingState{
		IsOpen:       m.isOpen,
		CurrentRound: m.currentRound,
		Config:       m.config,
	}

	if m.config.Mode == "open" {
		votes := make(map[string]string, len(m.votes))
		for pid, target := range m.votes {
			votes[pid.String()] = target
		}
		state.Votes = votes
	} else {
		state.VotedCount = len(m.votes)
	}

	if m.lastResult != nil {
		state.Winner = m.lastResult.Winner
		state.Round = m.lastResult.Round
	}

	return json.Marshal(state)
}

// BuildStateFor implements engine.PlayerAwareModule — in secret mode only the
// caller's own vote is exposed (plus the aggregate voted count). Open mode is
// public by design so behaviour mirrors BuildState().
func (m *VotingModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := votingState{
		IsOpen:       m.isOpen,
		CurrentRound: m.currentRound,
		Config:       m.config,
	}

	if m.config.Mode == "open" {
		votes := make(map[string]string, len(m.votes))
		for pid, target := range m.votes {
			votes[pid.String()] = target
		}
		state.Votes = votes
	} else {
		state.VotedCount = len(m.votes)
		if own, ok := m.votes[playerID]; ok {
			state.Votes = map[string]string{playerID.String(): own}
		}
	}

	if m.lastResult != nil {
		state.Winner = m.lastResult.Winner
		state.Round = m.lastResult.Round
	}

	return json.Marshal(state)
}

// --- SerializableModule ---

type votingSavedState struct {
	IsOpen       bool              `json:"isOpen"`
	CurrentRound int               `json:"currentRound"`
	Config       VotingConfig      `json:"config"`
	Votes        map[string]string `json:"votes"`
	TotalPlayers int               `json:"totalPlayers"`
	AlivePlayers int               `json:"alivePlayers"`
}

// SaveState snapshots the module's persistable state for restart-safe storage.
func (m *VotingModule) SaveState(_ context.Context) (engine.GameState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	votes := make(map[string]string, len(m.votes))
	for pid, target := range m.votes {
		votes[pid.String()] = target
	}

	data, err := json.Marshal(votingSavedState{
		IsOpen:       m.isOpen,
		CurrentRound: m.currentRound,
		Config:       m.config,
		Votes:        votes,
		TotalPlayers: m.totalPlayers,
		AlivePlayers: m.alivePlayers,
	})
	if err != nil {
		return engine.GameState{}, fmt.Errorf("voting: save state: %w", err)
	}
	return engine.GameState{Modules: map[string]json.RawMessage{m.Name(): data}}, nil
}

// RestoreState deserialises a previously persisted state.
func (m *VotingModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	var s votingSavedState
	if err := json.Unmarshal(raw, &s); err != nil {
		return fmt.Errorf("voting: restore state: %w", err)
	}

	votes := make(map[uuid.UUID]string, len(s.Votes))
	for pidStr, target := range s.Votes {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			continue
		}
		votes[pid] = target
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	m.isOpen = s.IsOpen
	m.currentRound = s.CurrentRound
	m.config = s.Config
	m.votes = votes
	m.totalPlayers = s.TotalPlayers
	m.alivePlayers = s.AlivePlayers
	return nil
}
