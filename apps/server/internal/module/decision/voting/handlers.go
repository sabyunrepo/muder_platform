package voting

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/engine"
)

const playerRoleDetective = "detective"

type voteCastPayload struct {
	TargetCode string `json:"targetCode"`
}

// HandleMessage dispatches vote-related WS messages to the corresponding
// handler. Unknown types return a structured error to the caller.
func (m *VotingModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "vote:cast":
		return m.handleVoteCast(ctx, playerID, payload)
	case "vote:change":
		return m.handleVoteChange(ctx, playerID, payload)
	default:
		return fmt.Errorf("voting: unknown message type %q", msgType)
	}
}

func (m *VotingModule) handleVoteCast(ctx context.Context, playerID uuid.UUID, payload json.RawMessage) error {
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
	targetCode, err := m.validateCandidatePolicyLocked(ctx, playerID, p.TargetCode)
	if err != nil {
		m.mu.Unlock()
		return err
	}
	m.votes[playerID] = targetCode
	votedCount := len(m.votes)
	mode := m.config.Mode
	showRealtime := m.config.ShowRealtime
	m.mu.Unlock()

	eventPayload := map[string]any{
		"playerId":   playerID.String(),
		"votedCount": votedCount,
	}
	if mode == "open" && showRealtime {
		eventPayload["targetCode"] = targetCode
	}
	m.deps.EventBus.Publish(engine.Event{
		Type:    "vote.cast",
		Payload: eventPayload,
	})
	return nil
}

func (m *VotingModule) handleVoteChange(ctx context.Context, playerID uuid.UUID, payload json.RawMessage) error {
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
	targetCode, err := m.validateCandidatePolicyLocked(ctx, playerID, p.TargetCode)
	if err != nil {
		m.mu.Unlock()
		return err
	}
	m.votes[playerID] = targetCode
	votedCount := len(m.votes)
	mode := m.config.Mode
	showRealtime := m.config.ShowRealtime
	m.mu.Unlock()

	eventPayload := map[string]any{
		"playerId":   playerID.String(),
		"votedCount": votedCount,
	}
	if mode == "open" && showRealtime {
		eventPayload["targetCode"] = targetCode
	}
	m.deps.EventBus.Publish(engine.Event{
		Type:    "vote.changed",
		Payload: eventPayload,
	})
	return nil
}

// validateCandidatePolicyLocked enforces server-side voting target policy while
// the caller holds m.mu. Legacy sessions without PlayerInfoProvider keep
// accepting character-code votes. Once the session exposes a provider, target
// codes must resolve to a known player and are normalized to that player's
// canonical TargetCode so tallying cannot split one candidate across aliases.
func (m *VotingModule) validateCandidatePolicyLocked(
	ctx context.Context,
	playerID uuid.UUID,
	targetCode string,
) (string, error) {
	if targetCode == "" {
		return "", nil
	}
	policy := m.config.CandidatePolicy
	if m.deps.PlayerInfoProvider == nil {
		if !policy.IncludeSelf && targetCode == playerID.String() {
			return "", votingCandidatePolicyError("self voting is not allowed")
		}
		return targetCode, nil
	}
	targetID, ok := m.deps.PlayerInfoProvider.ResolvePlayerID(ctx, targetCode)
	if !ok {
		return "", votingCandidatePolicyError("unknown voting candidate")
	}
	if !policy.IncludeSelf && targetID == playerID {
		return "", votingCandidatePolicyError("self voting is not allowed")
	}
	target, ok := m.deps.PlayerInfoProvider.PlayerRuntimeInfo(ctx, targetID)
	if !ok {
		return "", votingCandidatePolicyError("unknown voting candidate")
	}
	if !policy.IncludeDeadPlayers && !target.IsAlive {
		return "", votingCandidatePolicyError("dead players are not valid voting candidates")
	}
	if !policy.IncludeDetective && target.Role == playerRoleDetective {
		return "", votingCandidatePolicyError("detective players are not valid voting candidates")
	}
	return canonicalTargetCode(target), nil
}

func canonicalTargetCode(target engine.PlayerRuntimeInfo) string {
	if target.TargetCode != "" {
		return target.TargetCode
	}
	return target.PlayerID.String()
}

func votingCandidatePolicyError(detail string) *apperror.AppError {
	return apperror.New(apperror.ErrForbidden, http.StatusForbidden, "voting: "+detail)
}
