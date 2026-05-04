package voting

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"sort"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// VoteOutcome explains how a voting round finished for result screens.
type VoteOutcome string

const (
	VoteOutcomeWinner                    VoteOutcome = "winner"
	VoteOutcomeTie                       VoteOutcome = "tie"
	VoteOutcomeNoResult                  VoteOutcome = "no_result"
	VoteOutcomeInsufficientParticipation VoteOutcome = "insufficient_participation"
)

// VoteResult holds the outcome of a voting round.
type VoteResult struct {
	Results          map[string]int `json:"results"`
	Winner           string         `json:"winner"`
	IsTie            bool           `json:"isTie"`
	Round            int            `json:"round"`
	Outcome          VoteOutcome    `json:"outcome"`
	TotalVotes       int            `json:"totalVotes"`
	AbstainCount     int            `json:"abstainCount"`
	EligibleVoters   int            `json:"eligibleVoters"`
	ParticipationPct int            `json:"participationPct"`
	TieCandidates    []string       `json:"tieCandidates,omitempty"`
}

// --- PhaseReactor ---

// ReactTo handles engine-driven lifecycle actions (open / close voting).
func (m *VotingModule) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	switch action.Action {
	case engine.ActionOpenVoting:
		return m.openVoting(action.Params)
	case engine.ActionCloseVoting:
		return m.closeVoting()
	default:
		return fmt.Errorf("voting: unsupported action %q", action.Action)
	}
}

// SupportedActions reports which phase actions this module reacts to.
func (m *VotingModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{
		engine.ActionOpenVoting,
		engine.ActionCloseVoting,
	}
}

type openVotingParams struct {
	TotalPlayers int `json:"totalPlayers"`
	AlivePlayers int `json:"alivePlayers"`
}

func (m *VotingModule) openVoting(params json.RawMessage) error {
	m.mu.Lock()

	if params != nil && len(params) > 0 {
		var p openVotingParams
		if err := json.Unmarshal(params, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("voting: invalid OPEN_VOTING params: %w", err)
		}
		m.totalPlayers = p.TotalPlayers
		m.alivePlayers = p.AlivePlayers
	}

	m.isOpen = true
	m.votes = make(map[uuid.UUID]string)
	m.currentRound++

	round := m.currentRound
	maxRounds := m.config.MaxRounds
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "vote.opened",
		Payload: map[string]any{
			"round":    round,
			"maxRound": maxRounds,
		},
	})
	return nil
}

func (m *VotingModule) closeVoting() error {
	m.mu.Lock()

	if !m.isOpen {
		m.mu.Unlock()
		return fmt.Errorf("voting: voting is not open")
	}
	m.isOpen = false

	result := m.tallyResults()
	m.lastResult = &result
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type:    "vote.result",
		Payload: result,
	})
	return nil
}

// tallyResults counts votes, checks participation, and handles ties.
// Must be called under write lock.
func (m *VotingModule) tallyResults() VoteResult {
	counts := make(map[string]int)
	abstainCount := 0
	for _, target := range m.votes {
		if target == "" {
			abstainCount++
			continue
		}
		counts[target]++
	}

	eligible := m.alivePlayers
	if m.config.DeadCanVote {
		eligible = m.totalPlayers
	}
	participationPct := 0
	if eligible > 0 {
		participationPct = (len(m.votes) * 100) / eligible
	}

	result := VoteResult{
		Results:          counts,
		Round:            m.currentRound,
		Outcome:          VoteOutcomeNoResult,
		TotalVotes:       len(m.votes),
		AbstainCount:     abstainCount,
		EligibleVoters:   eligible,
		ParticipationPct: participationPct,
	}

	// Check minimum participation.
	if eligible > 0 && participationPct < m.config.MinParticipation {
		result.IsTie = false
		result.Winner = ""
		result.Outcome = VoteOutcomeInsufficientParticipation
		return result
	}

	// Find the winner(s).
	maxVotes := 0
	var winners []string
	for target, count := range counts {
		if count > maxVotes {
			maxVotes = count
			winners = []string{target}
		} else if count == maxVotes {
			winners = append(winners, target)
		}
	}

	if len(winners) == 0 {
		result.IsTie = false
		result.Winner = ""
		result.Outcome = VoteOutcomeNoResult
		return result
	}
	sort.Strings(winners)

	if len(winners) == 1 {
		result.Winner = winners[0]
		result.IsTie = false
		result.Outcome = VoteOutcomeWinner
		return result
	}

	// Tie handling.
	result.IsTie = true
	result.Outcome = VoteOutcomeTie
	result.TieCandidates = append([]string(nil), winners...)
	switch m.config.TieBreaker {
	case "random":
		result.Winner = winners[rand.IntN(len(winners))]
		result.IsTie = false
		result.Outcome = VoteOutcomeWinner
	case "no_result":
		result.Winner = ""
		result.IsTie = false
		result.Outcome = VoteOutcomeNoResult
	case "revote":
		// Remains a tie; the engine should call OPEN_VOTING again if under maxRounds.
		result.Winner = ""
	}
	return result
}
