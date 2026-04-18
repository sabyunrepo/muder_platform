package accusation

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

type accusePayload struct {
	TargetCode string    `json:"targetCode"`
	TargetID   uuid.UUID `json:"targetId"`
}

type accusationVotePayload struct {
	Guilty bool `json:"guilty"`
}

// HandleMessage dispatches accusation-related WS messages.
func (m *AccusationModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "accusation:accuse":
		return m.handleAccuse(playerID, payload)
	case "accusation:vote":
		return m.handleAccusationVote(playerID, payload)
	case "accusation:reset":
		return m.handleReset()
	default:
		return fmt.Errorf("accusation: unknown message type %q", msgType)
	}
}

func (m *AccusationModule) handleAccuse(playerID uuid.UUID, payload json.RawMessage) error {
	var p accusePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("accusation: invalid accusation:accuse payload: %w", err)
	}
	if p.TargetCode == "" {
		return fmt.Errorf("accusation: targetCode is required")
	}

	m.mu.Lock()
	if m.activeAccusation != nil {
		m.mu.Unlock()
		return fmt.Errorf("accusation: an accusation is already active")
	}
	if m.accusationCount >= m.config.MaxPerRound {
		m.mu.Unlock()
		return fmt.Errorf("accusation: max accusations per round (%d) reached", m.config.MaxPerRound)
	}

	deadline := m.timeNow().Add(time.Duration(m.config.DefenseTime) * time.Second)
	m.activeAccusation = &Accusation{
		AccuserID:       playerID,
		AccusedID:       p.TargetID,
		AccusedCode:     p.TargetCode,
		DefenseDeadline: deadline,
		Votes:           make(map[uuid.UUID]bool),
	}
	m.accusationCount++
	m.isActive = true
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "accusation.started",
		Payload: map[string]any{
			"accuserId":       playerID.String(),
			"accusedCode":     p.TargetCode,
			"defenseDeadline": deadline.Unix(),
		},
	})
	return nil
}

// handleAccusationVote records a vote against the active accusation and
// resolves the outcome (expel / acquit / wait-for-quorum) using the pure
// tallyVotes / shouldResolve helpers in tally.go. Keeps the caller's write
// lock discipline — the module's mutex is held for the duration of the
// vote read/write, and tally helpers are called without the lock once
// vote counts have been copied out.
func (m *AccusationModule) handleAccusationVote(playerID uuid.UUID, payload json.RawMessage) error {
	var p accusationVotePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("accusation: invalid accusation:vote payload: %w", err)
	}

	m.mu.Lock()
	if m.activeAccusation == nil {
		m.mu.Unlock()
		return fmt.Errorf("accusation: no active accusation")
	}
	// Cannot vote on your own accusation (as accuser).
	if playerID == m.activeAccusation.AccuserID {
		m.mu.Unlock()
		return fmt.Errorf("accusation: accuser cannot vote")
	}
	// Accused cannot vote on their own accusation.
	if playerID == m.activeAccusation.AccusedID {
		m.mu.Unlock()
		return fmt.Errorf("accusation: accused cannot vote on own accusation")
	}

	m.activeAccusation.Votes[playerID] = p.Guilty

	totalVotes := len(m.activeAccusation.Votes)
	guiltyCount := 0
	for _, guilty := range m.activeAccusation.Votes {
		if guilty {
			guiltyCount++
		}
	}
	eligibleVoters := m.activeAccusation.EligibleVoters
	threshold := m.config.VoteThreshold

	if !shouldResolve(guiltyCount, totalVotes, eligibleVoters, threshold) {
		m.mu.Unlock()
		return nil
	}

	outcome := tallyVotes(guiltyCount, totalVotes, eligibleVoters, threshold)
	accusedCode := m.activeAccusation.AccusedCode
	m.activeAccusation = nil
	m.isActive = false
	if outcome.Expelled {
		m.expelledCode = accusedCode
		// expelledIsCulprit is determined externally (e.g. via engine cross-check).
		// For now, flag it false; CheckWin reads it from state when set externally.
		m.expelledIsCulprit = false
	}
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "accusation.resolved",
		Payload: map[string]any{
			"accusedCode": accusedCode,
			"expelled":    outcome.Expelled,
			"guiltyVotes": guiltyCount,
			"totalVotes":  totalVotes,
		},
	})
	return nil
}

// handleReset resets the accusation count for a new round.
func (m *AccusationModule) handleReset() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.accusationCount = 0
	m.activeAccusation = nil
	m.isActive = false
	m.expelledCode = ""
	m.expelledIsCulprit = false
	return nil
}
