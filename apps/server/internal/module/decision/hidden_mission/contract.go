package hidden_mission

import (
	"errors"
	"sort"

	"github.com/google/uuid"
)

// ErrMissionResultNotVisible is returned when a caller asks for unredacted
// mission results before the ending/result boundary or without host/system
// authorization.
var ErrMissionResultNotVisible = errors.New("hidden_mission: result breakdown is not visible")

// MissionResultAccess is the explicit guard for result-screen mission data.
// ResultVisible should be true only after the configured result boundary, and
// CanViewAll should be true only for host/system result aggregation paths.
type MissionResultAccess struct {
	ResultVisible bool
	CanViewAll    bool
}

// MissionResultItem is the ending/result-screen contract for one mission.
// It intentionally contains creator-facing text and scoring outcome only; raw
// rule internals stay inside the engine.
type MissionResultItem struct {
	MissionID   string `json:"missionId"`
	Description string `json:"description"`
	Completed   bool   `json:"completed"`
	Points      int    `json:"points"`
}

// MissionResultBreakdown is consumed by ending/vote result screens when they
// need per-player mission scoring without exposing other hidden state earlier.
type MissionResultBreakdown struct {
	PlayerID   uuid.UUID           `json:"playerId"`
	TotalScore int                 `json:"totalScore"`
	Missions   []MissionResultItem `json:"missions"`
}

// MissionAuditEvent is the module-level audit contract emitted when runtime
// verification changes a mission outcome.
type MissionAuditEvent struct {
	PlayerID  uuid.UUID `json:"playerId"`
	MissionID string    `json:"missionId"`
	Completed bool      `json:"completed"`
	Points    int       `json:"points"`
	Reason    string    `json:"reason"`
}

// BuildResultBreakdown returns result-screen safe mission outcomes. It is not
// used for in-game player sync; BuildStateFor remains the player-aware path.
func (m *HiddenMissionModule) BuildResultBreakdown(access MissionResultAccess) ([]MissionResultBreakdown, error) {
	if !access.ResultVisible || !access.CanViewAll {
		return nil, ErrMissionResultNotVisible
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	breakdowns := make([]MissionResultBreakdown, 0, len(m.playerMissions))
	for playerID, missions := range m.playerMissions {
		items := make([]MissionResultItem, 0, len(missions))
		for _, mission := range missions {
			items = append(items, MissionResultItem{
				MissionID:   mission.ID,
				Description: mission.Description,
				Completed:   mission.Completed,
				Points:      mission.Points,
			})
		}
		breakdowns = append(breakdowns, MissionResultBreakdown{
			PlayerID:   playerID,
			TotalScore: m.scores[playerID],
			Missions:   items,
		})
	}
	sort.Slice(breakdowns, func(i, j int) bool {
		return breakdowns[i].PlayerID.String() < breakdowns[j].PlayerID.String()
	})
	return breakdowns, nil
}
