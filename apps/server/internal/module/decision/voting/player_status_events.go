package voting

import (
	"context"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

type playerStatusChangedPayload struct {
	PlayerID string
	IsAlive  bool
}

func (m *VotingModule) onPlayerStatusChanged(event engine.Event) {
	payload, ok := parsePlayerStatusChangedPayload(event.Payload)
	if !ok {
		return
	}
	playerID, err := uuid.Parse(payload.PlayerID)
	if err != nil {
		return
	}

	ctx := context.Background()
	m.mu.Lock()
	if !m.isOpen {
		m.mu.Unlock()
		return
	}

	removedVotes := m.reconcilePlayerStatusLocked(ctx, playerID, payload.IsAlive)
	votedCount := len(m.votes)
	alivePlayers := m.alivePlayers
	totalPlayers := m.totalPlayers
	mode := m.config.Mode
	showRealtime := m.config.ShowRealtime
	var votes map[string]string
	if mode == "open" && showRealtime {
		votes = m.openModeVotesSnapshotLocked()
	}
	m.mu.Unlock()

	if m.deps.EventBus == nil {
		return
	}
	eventPayload := map[string]any{
		"playerId":     playerID.String(),
		"isAlive":      payload.IsAlive,
		"removedVotes": removedVotes,
		"votedCount":   votedCount,
		"alivePlayers": alivePlayers,
		"totalPlayers": totalPlayers,
	}
	if votes != nil {
		eventPayload["votes"] = votes
	}
	m.deps.EventBus.Publish(engine.Event{
		Type:    "vote.reconciled",
		Payload: eventPayload,
	})
}

func parsePlayerStatusChangedPayload(payload any) (playerStatusChangedPayload, bool) {
	raw, ok := payload.(map[string]any)
	if !ok {
		return playerStatusChangedPayload{}, false
	}
	playerID, _ := raw["playerId"].(string)
	isAlive, ok := raw["isAlive"].(bool)
	if playerID == "" || !ok {
		return playerStatusChangedPayload{}, false
	}
	return playerStatusChangedPayload{PlayerID: playerID, IsAlive: isAlive}, true
}

// reconcilePlayerStatusLocked keeps an already-open voting round consistent
// with the live session roster. The caller must hold m.mu.
func (m *VotingModule) reconcilePlayerStatusLocked(ctx context.Context, playerID uuid.UUID, isAlive bool) int {
	removed := 0
	if !isAlive && !m.config.DeadCanVote {
		if _, ok := m.votes[playerID]; ok {
			delete(m.votes, playerID)
			removed++
		}
	}

	if !isAlive && !m.config.CandidatePolicy.IncludeDeadPlayers {
		targetCode := playerID.String()
		if m.deps.PlayerInfoProvider != nil {
			if info, ok := m.deps.PlayerInfoProvider.PlayerRuntimeInfo(ctx, playerID); ok {
				targetCode = canonicalTargetCode(info)
			}
		}
		for voterID, voteTarget := range m.votes {
			if voteTarget == targetCode {
				delete(m.votes, voterID)
				removed++
			}
		}
	}

	m.refreshAlivePlayersLocked(ctx, isAlive)
	return removed
}

func (m *VotingModule) refreshAlivePlayersLocked(ctx context.Context, fallbackIsAlive bool) {
	if rosterProvider, ok := m.deps.PlayerInfoProvider.(engine.PlayerRuntimeRosterProvider); ok {
		roster := rosterProvider.PlayerRuntimeRoster(ctx)
		m.totalPlayers = len(roster)
		alive := 0
		for _, player := range roster {
			if player.IsAlive {
				alive++
			}
		}
		m.alivePlayers = alive
		return
	}

	if fallbackIsAlive {
		if m.alivePlayers < m.totalPlayers {
			m.alivePlayers++
		}
		return
	}
	if m.alivePlayers > 0 {
		m.alivePlayers--
	}
}

func (m *VotingModule) openModeVotesSnapshotLocked() map[string]string {
	votes := make(map[string]string, len(m.votes))
	for playerID, targetCode := range m.votes {
		votes[playerID.String()] = targetCode
	}
	return votes
}
