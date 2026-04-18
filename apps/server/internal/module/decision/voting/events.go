package voting

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// --- GameEventHandler ---

type voteEventPayload struct {
	PlayerID   string `json:"playerId"`
	TargetCode string `json:"targetCode"`
}

// Validate checks whether a vote event is legal against the current state.
func (m *VotingModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	if event.Type != "vote:cast" && event.Type != "vote:change" {
		return fmt.Errorf("voting: unsupported event type %q", event.Type)
	}

	var p voteEventPayload
	if err := json.Unmarshal(event.Payload, &p); err != nil {
		return fmt.Errorf("voting: invalid event payload: %w", err)
	}
	if p.PlayerID == "" {
		return fmt.Errorf("voting: playerId is required")
	}

	m.mu.RLock()
	isOpen := m.isOpen
	allowAbstain := m.config.AllowAbstain
	m.mu.RUnlock()

	if !isOpen {
		return fmt.Errorf("voting: voting is not open")
	}
	if p.TargetCode == "" && !allowAbstain {
		return fmt.Errorf("voting: abstain not allowed")
	}

	playerID, err := uuid.Parse(p.PlayerID)
	if err != nil {
		return fmt.Errorf("voting: invalid playerId: %w", err)
	}

	m.mu.RLock()
	_, alreadyVoted := m.votes[playerID]
	m.mu.RUnlock()

	if event.Type == "vote:cast" && alreadyVoted {
		return fmt.Errorf("voting: player already voted, use vote:change")
	}
	if event.Type == "vote:change" && !alreadyVoted {
		return fmt.Errorf("voting: no existing vote to change")
	}
	return nil
}

// Apply records the vote in response to a validated event.
func (m *VotingModule) Apply(_ context.Context, event engine.GameEvent, state *engine.GameState) error {
	var p voteEventPayload
	if err := json.Unmarshal(event.Payload, &p); err != nil {
		return fmt.Errorf("voting: apply: invalid payload: %w", err)
	}
	playerID, err := uuid.Parse(p.PlayerID)
	if err != nil {
		return fmt.Errorf("voting: apply: invalid playerId: %w", err)
	}

	m.mu.Lock()
	m.votes[playerID] = p.TargetCode
	m.mu.Unlock()

	data, err := m.BuildState()
	if err != nil {
		return fmt.Errorf("voting: apply: build state: %w", err)
	}
	if state.Modules == nil {
		state.Modules = make(map[string]json.RawMessage)
	}
	state.Modules[m.Name()] = data
	return nil
}

// --- WinChecker ---

// CheckWin reports that a voting win has fired when a closed round yields
// a clear winner.
func (m *VotingModule) CheckWin(_ context.Context, state engine.GameState) (engine.WinResult, error) {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return engine.WinResult{Won: false}, nil
	}

	var s votingState
	if err := json.Unmarshal(raw, &s); err != nil {
		return engine.WinResult{}, fmt.Errorf("voting: check win: %w", err)
	}

	// Win fires only when voting is closed and a clear winner exists.
	if s.IsOpen || s.Winner == "" {
		return engine.WinResult{Won: false}, nil
	}

	return engine.WinResult{
		Won:    true,
		Reason: fmt.Sprintf("voting: round %d produced winner %q", s.Round, s.Winner),
	}, nil
}

// --- RuleProvider ---

// GetRules exposes the JSON-logic rules this module contributes to the rule
// engine (plurality, majority, participation floor).
func (m *VotingModule) GetRules() []engine.Rule {
	return []engine.Rule{
		{
			ID:          "voting.plurality",
			Description: "Candidate with the most votes wins (plurality)",
			Logic:       json.RawMessage(`{"reduce":[{"var":"votes"},{"if":[{">=":[{"var":"accumulator.count"},{"var":"current.count"}]},{"var":"accumulator"},{"var":"current"}]},{"candidate":"","count":0}]}`),
		},
		{
			ID:          "voting.majority",
			Description: "Candidate wins only if they receive strictly more than 50% of votes",
			Logic:       json.RawMessage(`{">":[{"var":"winner.pct"},50]}`),
		},
		{
			ID:          "voting.min_participation",
			Description: "Voting result is valid only if participation meets the minimum threshold",
			Logic:       json.RawMessage(`{">=":[{"var":"participation_pct"},{"var":"config.minParticipation"}]}`),
		},
	}
}
