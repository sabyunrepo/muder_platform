package hidden_mission

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// --- WinChecker ---

// CheckWin reports that a hidden-mission win has fired when at least one
// player holds a strictly positive score.
func (m *HiddenMissionModule) CheckWin(_ context.Context, state engine.GameState) (engine.WinResult, error) {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return engine.WinResult{Won: false}, nil
	}

	var s hiddenMissionState
	if err := json.Unmarshal(raw, &s); err != nil {
		return engine.WinResult{}, fmt.Errorf("hidden_mission: check win: %w", err)
	}

	// Find the player with the highest score (MVP).
	if len(s.Scores) == 0 {
		return engine.WinResult{Won: false}, nil
	}

	var mvpID uuid.UUID
	maxScore := 0
	for pid, score := range s.Scores {
		if score > maxScore {
			maxScore = score
			mvpID = pid
		}
	}

	if maxScore == 0 {
		return engine.WinResult{Won: false}, nil
	}

	m.mu.RLock()
	title := m.config.ScoreWinnerTitle
	m.mu.RUnlock()

	return engine.WinResult{
		Won:       true,
		WinnerIDs: []uuid.UUID{mvpID},
		Reason:    fmt.Sprintf("hidden_mission: %s awarded with %d points", title, maxScore),
	}, nil
}

// --- RuleProvider ---

// GetRules exposes the JSON-logic rules this module contributes.
func (m *HiddenMissionModule) GetRules() []engine.Rule {
	return []engine.Rule{
		{
			ID:          "mission.hold_clue",
			Description: "Player holds a specific clue to complete mission",
			Logic:       json.RawMessage(`{"in":[{"var":"targetClueId"},{"var":"player.clueIds"}]}`),
		},
		{
			ID:          "mission.vote_target",
			Description: "Player votes for a specific target to complete mission",
			Logic:       json.RawMessage(`{"==":[{"var":"player.lastVote"},{"var":"targetCode"}]}`),
		},
		{
			ID:          "mission.transfer_clue",
			Description: "Player transfers any clue to complete mission",
			Logic:       json.RawMessage(`{">":[{"var":"player.transferCount"},0]}`),
		},
	}
}
