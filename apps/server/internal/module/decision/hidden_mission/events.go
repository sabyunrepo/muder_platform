package hidden_mission

import (
	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// --- EventBus handlers for auto-verification ---

func (m *HiddenMissionModule) onClueAcquired(event engine.Event) {
	payload, ok := event.Payload.(map[string]any)
	if !ok {
		return
	}
	pidStr, _ := payload["playerId"].(string)
	clueID, _ := payload["clueId"].(string)
	pid, err := uuid.Parse(pidStr)
	if err != nil {
		return
	}

	m.mu.RLock()
	orig := m.playerMissions[pid]
	missionsCopy := make([]Mission, len(orig))
	copy(missionsCopy, orig)
	m.mu.RUnlock()

	for _, mission := range missionsCopy {
		if mission.Type == "hold_clue" && mission.TargetClueID == clueID && !mission.Completed {
			m.completeMission(pid, mission.ID)
		}
	}
}

func (m *HiddenMissionModule) onVoteCast(event engine.Event) {
	payload, ok := event.Payload.(map[string]any)
	if !ok {
		return
	}
	pidStr, _ := payload["playerId"].(string)
	targetCode, _ := payload["targetCode"].(string)
	pid, err := uuid.Parse(pidStr)
	if err != nil {
		return
	}

	m.mu.RLock()
	orig := m.playerMissions[pid]
	missionsCopy := make([]Mission, len(orig))
	copy(missionsCopy, orig)
	m.mu.RUnlock()

	for _, mission := range missionsCopy {
		if mission.Type == "vote_target" && mission.TargetClueID == targetCode && !mission.Completed {
			m.completeMission(pid, mission.ID)
		}
	}
}

func (m *HiddenMissionModule) onClueTransferred(event engine.Event) {
	payload, ok := event.Payload.(map[string]any)
	if !ok {
		return
	}
	pidStr, _ := payload["fromPlayerId"].(string)
	pid, err := uuid.Parse(pidStr)
	if err != nil {
		return
	}

	m.mu.RLock()
	orig := m.playerMissions[pid]
	missionsCopy := make([]Mission, len(orig))
	copy(missionsCopy, orig)
	m.mu.RUnlock()

	for _, mission := range missionsCopy {
		if mission.Type == "transfer_clue" && !mission.Completed {
			m.completeMission(pid, mission.ID)
		}
	}
}
