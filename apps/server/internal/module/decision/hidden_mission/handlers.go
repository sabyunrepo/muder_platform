package hidden_mission

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

type missionReportPayload struct {
	MissionID string `json:"missionId"`
}

type missionVerifyPayload struct {
	PlayerID  uuid.UUID `json:"playerId"`
	MissionID string    `json:"missionId"`
	Completed bool      `json:"completed"`
}

// HandleMessage dispatches mission-related WS messages.
func (m *HiddenMissionModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "mission:report":
		return m.handleReport(playerID, payload)
	case "mission:verify":
		return m.handleVerify(payload)
	case "mission:check":
		return m.handleCheck(playerID)
	default:
		return fmt.Errorf("hidden_mission: unknown message type %q", msgType)
	}
}

func (m *HiddenMissionModule) handleReport(playerID uuid.UUID, payload json.RawMessage) error {
	var p missionReportPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("hidden_mission: invalid mission:report payload: %w", err)
	}

	m.mu.RLock()
	missions, ok := m.playerMissions[playerID]
	if !ok {
		m.mu.RUnlock()
		return fmt.Errorf("hidden_mission: player has no missions")
	}
	// Deep copy to avoid shared slice iteration outside lock.
	missionsCopy := make([]Mission, len(missions))
	copy(missionsCopy, missions)
	m.mu.RUnlock()

	found := false
	for _, mission := range missionsCopy {
		if mission.ID == p.MissionID {
			found = true
			if mission.Verification != "self_report" && mission.Verification != "gm_verify" {
				return fmt.Errorf("hidden_mission: mission %q does not support manual reporting", p.MissionID)
			}
			break
		}
	}
	if !found {
		return fmt.Errorf("hidden_mission: mission %q not found", p.MissionID)
	}

	m.deps.EventBus.Publish(engine.Event{
		Type: "mission.reported",
		Payload: map[string]any{
			"playerId":  playerID.String(),
			"missionId": p.MissionID,
		},
	})
	return nil
}

func (m *HiddenMissionModule) handleVerify(payload json.RawMessage) error {
	var p missionVerifyPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("hidden_mission: invalid mission:verify payload: %w", err)
	}

	if p.Completed {
		m.completeMission(p.PlayerID, p.MissionID, "gm.verify")
	}

	m.deps.EventBus.Publish(engine.Event{
		Type: "mission.verified",
		Payload: map[string]any{
			"playerId":  p.PlayerID.String(),
			"missionId": p.MissionID,
			"completed": p.Completed,
		},
	})
	return nil
}

func (m *HiddenMissionModule) handleCheck(playerID uuid.UUID) error {
	m.mu.RLock()
	orig := m.playerMissions[playerID]
	missionsCopy := make([]Mission, len(orig))
	copy(missionsCopy, orig)
	m.mu.RUnlock()

	// Publish player's own mission status (response sent via event).
	m.deps.EventBus.Publish(engine.Event{
		Type: "mission.status",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"missions": missionsCopy,
		},
	})
	return nil
}

// completeMission marks a mission complete and updates the score.
func (m *HiddenMissionModule) completeMission(playerID uuid.UUID, missionID string, reason string) {
	var audit *MissionAuditEvent

	m.mu.Lock()
	// Check if already completed.
	for _, mid := range m.completedMissions[playerID] {
		if mid == missionID {
			m.mu.Unlock()
			return
		}
	}

	missions := m.playerMissions[playerID]
	for i, mission := range missions {
		if mission.ID == missionID && !mission.Completed {
			m.playerMissions[playerID][i].Completed = true
			m.completedMissions[playerID] = append(m.completedMissions[playerID], missionID)
			if m.config.AffectsScore {
				m.scores[playerID] += mission.Points
			}
			audit = &MissionAuditEvent{
				PlayerID:  playerID,
				MissionID: missionID,
				Completed: true,
				Points:    mission.Points,
				Reason:    reason,
			}
			break
		}
	}
	m.mu.Unlock()

	if audit != nil && m.deps.EventBus != nil {
		m.deps.EventBus.Publish(engine.Event{
			Type:    "mission.completed",
			Payload: *audit,
		})
	}
}
