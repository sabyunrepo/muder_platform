package hidden_mission

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestHiddenMissionModule_AutoVerify_VoteCast_TargetCharacterID(t *testing.T) {
	pid := uuid.New()
	deps := newTestDeps()
	var completed []MissionAuditEvent
	deps.EventBus.Subscribe("mission.completed", func(event engine.Event) {
		if payload, ok := event.Payload.(MissionAuditEvent); ok {
			completed = append(completed, payload)
		}
	})
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "vote_target", "description": "Vote for char_A", "points": 5, "verification": "auto", "targetCharacterId": "char_A"},
			},
		},
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("Marshal cfg: %v", err)
	}

	m := NewHiddenMissionModule()
	if err := m.Init(context.Background(), deps, data); err != nil {
		t.Fatalf("Init: %v", err)
	}

	deps.EventBus.Publish(engine.Event{
		Type: "vote.cast",
		Payload: map[string]any{
			"playerId":   pid.String(),
			"targetCode": "char_A",
		},
	})

	if len(completed) != 1 {
		t.Fatalf("expected 1 audit event, got %d", len(completed))
	}
	if completed[0].MissionID != "m1" || completed[0].Reason != "vote.cast" {
		t.Fatalf("unexpected audit event: %#v", completed[0])
	}
}

func TestHiddenMissionModule_BuildResultBreakdown(t *testing.T) {
	pid := uuid.New()
	deps := newTestDeps()
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "hold_clue", "description": "Hold clue_1", "points": 10, "verification": "auto", "targetClueId": "clue_1"},
				{"id": "m2", "type": "custom", "description": "Tell secret", "points": 0, "verification": "self_report"},
			},
		},
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("Marshal cfg: %v", err)
	}

	m := NewHiddenMissionModule()
	if err := m.Init(context.Background(), deps, data); err != nil {
		t.Fatalf("Init: %v", err)
	}
	deps.EventBus.Publish(engine.Event{
		Type: "clue.acquired",
		Payload: map[string]any{
			"playerId": pid.String(),
			"clueId":   "clue_1",
		},
	})

	if _, err := m.BuildResultBreakdown(MissionResultAccess{}); !errors.Is(err, ErrMissionResultNotVisible) {
		t.Fatalf("expected ErrMissionResultNotVisible, got %v", err)
	}

	breakdowns, err := m.BuildResultBreakdown(MissionResultAccess{ResultVisible: true, CanViewAll: true})
	if err != nil {
		t.Fatalf("BuildResultBreakdown: %v", err)
	}
	if len(breakdowns) != 1 {
		t.Fatalf("expected 1 breakdown, got %d", len(breakdowns))
	}
	if breakdowns[0].PlayerID != pid || breakdowns[0].TotalScore != 10 {
		t.Fatalf("unexpected breakdown summary: %#v", breakdowns[0])
	}
	if len(breakdowns[0].Missions) != 2 || !breakdowns[0].Missions[0].Completed {
		t.Fatalf("unexpected mission items: %#v", breakdowns[0].Missions)
	}
}
