package voting

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

type voteCastPayload struct {
	TargetCode string `json:"targetCode"`
}

// HandleMessage dispatches vote-related WS messages to the corresponding
// handler. Unknown types return a structured error to the caller.
func (m *VotingModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "vote:cast":
		return m.handleVoteCast(playerID, payload)
	case "vote:change":
		return m.handleVoteChange(playerID, payload)
	default:
		return fmt.Errorf("voting: unknown message type %q", msgType)
	}
}

func (m *VotingModule) handleVoteCast(playerID uuid.UUID, payload json.RawMessage) error {
	var p voteCastPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("voting: invalid vote:cast payload: %w", err)
	}

	m.mu.Lock()
	if p.TargetCode == "" && !m.config.AllowAbstain {
		m.mu.Unlock()
		return fmt.Errorf("voting: abstain not allowed")
	}
	if !m.isOpen {
		m.mu.Unlock()
		return fmt.Errorf("voting: voting is not open")
	}
	if _, already := m.votes[playerID]; already {
		m.mu.Unlock()
		return fmt.Errorf("voting: player already voted, use vote:change")
	}
	m.votes[playerID] = p.TargetCode
	votedCount := len(m.votes)
	mode := m.config.Mode
	showRealtime := m.config.ShowRealtime
	m.mu.Unlock()

	eventPayload := map[string]any{
		"playerId":   playerID.String(),
		"votedCount": votedCount,
	}
	if mode == "open" && showRealtime {
		eventPayload["targetCode"] = p.TargetCode
	}
	m.deps.EventBus.Publish(engine.Event{
		Type:    "vote.cast",
		Payload: eventPayload,
	})
	return nil
}

func (m *VotingModule) handleVoteChange(playerID uuid.UUID, payload json.RawMessage) error {
	var p voteCastPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("voting: invalid vote:change payload: %w", err)
	}

	m.mu.Lock()
	if p.TargetCode == "" && !m.config.AllowAbstain {
		m.mu.Unlock()
		return fmt.Errorf("voting: abstain not allowed")
	}
	if !m.isOpen {
		m.mu.Unlock()
		return fmt.Errorf("voting: voting is not open")
	}
	if _, exists := m.votes[playerID]; !exists {
		m.mu.Unlock()
		return fmt.Errorf("voting: no existing vote to change")
	}
	m.votes[playerID] = p.TargetCode
	votedCount := len(m.votes)
	mode := m.config.Mode
	showRealtime := m.config.ShowRealtime
	m.mu.Unlock()

	eventPayload := map[string]any{
		"playerId":   playerID.String(),
		"votedCount": votedCount,
	}
	if mode == "open" && showRealtime {
		eventPayload["targetCode"] = p.TargetCode
	}
	m.deps.EventBus.Publish(engine.Event{
		Type:    "vote.changed",
		Payload: eventPayload,
	})
	return nil
}
