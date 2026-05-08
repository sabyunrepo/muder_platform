package hidden_mission

import (
	"strings"

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
		if mission.Type == "hold_clue" &&
			mission.Verification == "auto" &&
			clueID != "" &&
			mission.TargetClueID != "" &&
			mission.TargetClueID == clueID &&
			!mission.Completed {
			m.completeMission(pid, mission.ID, "clue.acquired")
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
		targetID := mission.TargetCharacterID
		if targetID == "" {
			targetID = mission.TargetClueID
		}
		if mission.Type == "vote_target" &&
			mission.Verification == "auto" &&
			targetID != "" &&
			targetCode != "" &&
			targetID == targetCode &&
			!mission.Completed {
			m.completeMission(pid, mission.ID, "vote.cast")
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
		if mission.Type == "transfer_clue" && mission.Verification == "auto" && !mission.Completed {
			m.completeMission(pid, mission.ID, "clue.transferred")
		}
	}
}

func (m *HiddenMissionModule) onPhaseEntered(event engine.Event) {
	info, ok := event.Payload.(*engine.PhaseInfo)
	if !ok || info == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	m.gameStarted = true
	m.currentRound = info.Round
	if m.currentRound == 0 {
		m.currentRound = int32(info.Index + 1)
	}
	m.currentNodeID = info.ID
	if m.visitedNodes == nil {
		m.visitedNodes = make(map[string]bool)
	}
	if info.ID != "" {
		m.visitedNodes[info.ID] = true
	}
	if isIntroPhaseInfo(info) {
		m.introStarted = true
	} else if m.introStarted {
		m.introFinished = true
	}
}

func isIntroPhaseInfo(info *engine.PhaseInfo) bool {
	id := strings.ToLower(info.ID)
	name := strings.ToLower(info.Name)
	return strings.Contains(id, "intro") ||
		strings.Contains(id, "introduction") ||
		strings.Contains(name, "intro") ||
		strings.Contains(name, "introduction") ||
		strings.Contains(name, "자기소개")
}
