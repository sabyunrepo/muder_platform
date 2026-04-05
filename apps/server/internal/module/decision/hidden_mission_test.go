package decision

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func initHiddenMissionModule(t *testing.T, configJSON string) *HiddenMissionModule {
	t.Helper()
	m := NewHiddenMissionModule()
	var cfg json.RawMessage
	if configJSON != "" {
		cfg = json.RawMessage(configJSON)
	}
	if err := m.Init(context.Background(), newTestDeps(), cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	return m
}

func TestHiddenMissionModule_Name(t *testing.T) {
	m := NewHiddenMissionModule()
	if got := m.Name(); got != "hidden_mission" {
		t.Errorf("Name() = %q, want %q", got, "hidden_mission")
	}
}

func TestHiddenMissionModule_InitDefaults(t *testing.T) {
	m := initHiddenMissionModule(t, "")
	if m.config.VerificationMode != "auto" {
		t.Errorf("default VerificationMode = %q, want %q", m.config.VerificationMode, "auto")
	}
	if m.config.ShowResultAt != "ending" {
		t.Errorf("default ShowResultAt = %q, want %q", m.config.ShowResultAt, "ending")
	}
	if m.config.ScoreWinnerTitle != "MVP" {
		t.Errorf("default ScoreWinnerTitle = %q, want %q", m.config.ScoreWinnerTitle, "MVP")
	}
	if !m.config.AffectsScore {
		t.Error("default AffectsScore should be true")
	}
}

func TestHiddenMissionModule_InitCustomConfig(t *testing.T) {
	m := initHiddenMissionModule(t, `{"verificationMode":"gm_verify","showResultAt":"phase_end","scoreWinnerTitle":"Star Player"}`)
	if m.config.VerificationMode != "gm_verify" {
		t.Errorf("VerificationMode = %q, want %q", m.config.VerificationMode, "gm_verify")
	}
	if m.config.ShowResultAt != "phase_end" {
		t.Errorf("ShowResultAt = %q, want %q", m.config.ShowResultAt, "phase_end")
	}
	if m.config.ScoreWinnerTitle != "Star Player" {
		t.Errorf("ScoreWinnerTitle = %q, want %q", m.config.ScoreWinnerTitle, "Star Player")
	}
}

func TestHiddenMissionModule_InitWithPlayerMissions(t *testing.T) {
	pid := uuid.New()
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "hold_clue", "description": "Hold clue X", "points": 10, "verification": "auto", "targetClueId": "clue_1"},
			},
		},
	}
	data, _ := json.Marshal(cfg)
	m := initHiddenMissionModule(t, string(data))

	m.mu.RLock()
	missions := m.playerMissions[pid]
	m.mu.RUnlock()

	if len(missions) != 1 {
		t.Fatalf("expected 1 mission, got %d", len(missions))
	}
	if missions[0].ID != "m1" {
		t.Errorf("mission ID = %q, want %q", missions[0].ID, "m1")
	}
}

func TestHiddenMissionModule_Report(t *testing.T) {
	pid := uuid.New()
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "custom", "description": "Do something", "points": 5, "verification": "self_report"},
				{"id": "m2", "type": "hold_clue", "description": "Hold clue", "points": 10, "verification": "auto", "targetClueId": "clue_1"},
			},
		},
	}
	data, _ := json.Marshal(cfg)
	m := initHiddenMissionModule(t, string(data))

	tests := []struct {
		name      string
		playerID  uuid.UUID
		missionID string
		wantErr   bool
	}{
		{
			name:      "report self_report mission",
			playerID:  pid,
			missionID: "m1",
			wantErr:   false,
		},
		{
			name:      "report auto mission fails",
			playerID:  pid,
			missionID: "m2",
			wantErr:   true,
		},
		{
			name:      "report nonexistent mission",
			playerID:  pid,
			missionID: "m99",
			wantErr:   true,
		},
		{
			name:      "player with no missions",
			playerID:  uuid.New(),
			missionID: "m1",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, _ := json.Marshal(missionReportPayload{MissionID: tt.missionID})
			err := m.HandleMessage(context.Background(), tt.playerID, "mission:report", payload)
			if (err != nil) != tt.wantErr {
				t.Errorf("error = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}

func TestHiddenMissionModule_Verify(t *testing.T) {
	pid := uuid.New()
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "custom", "description": "Do something", "points": 15, "verification": "gm_verify"},
			},
		},
	}
	data, _ := json.Marshal(cfg)
	m := initHiddenMissionModule(t, string(data))

	// GM verifies the mission as completed.
	payload, _ := json.Marshal(missionVerifyPayload{
		PlayerID:  pid,
		MissionID: "m1",
		Completed: true,
	})
	err := m.HandleMessage(context.Background(), uuid.New(), "mission:verify", payload)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.completedMissions[pid]) != 1 {
		t.Fatalf("expected 1 completed mission, got %d", len(m.completedMissions[pid]))
	}
	if m.completedMissions[pid][0] != "m1" {
		t.Errorf("completed mission = %q, want %q", m.completedMissions[pid][0], "m1")
	}
	if m.scores[pid] != 15 {
		t.Errorf("score = %d, want 15", m.scores[pid])
	}
	if !m.playerMissions[pid][0].Completed {
		t.Error("mission should be marked completed")
	}
}

func TestHiddenMissionModule_VerifyNotCompleted(t *testing.T) {
	pid := uuid.New()
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "custom", "description": "Do something", "points": 15, "verification": "gm_verify"},
			},
		},
	}
	data, _ := json.Marshal(cfg)
	m := initHiddenMissionModule(t, string(data))

	// GM verifies as not completed.
	payload, _ := json.Marshal(missionVerifyPayload{
		PlayerID:  pid,
		MissionID: "m1",
		Completed: false,
	})
	err := m.HandleMessage(context.Background(), uuid.New(), "mission:verify", payload)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.completedMissions[pid]) != 0 {
		t.Error("mission should not be completed when verified as false")
	}
	if m.scores[pid] != 0 {
		t.Errorf("score = %d, want 0", m.scores[pid])
	}
}

func TestHiddenMissionModule_Check(t *testing.T) {
	pid := uuid.New()
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "custom", "description": "Do something", "points": 5, "verification": "self_report"},
			},
		},
	}
	data, _ := json.Marshal(cfg)
	m := initHiddenMissionModule(t, string(data))

	err := m.HandleMessage(context.Background(), pid, "mission:check", nil)
	if err != nil {
		t.Fatalf("check: %v", err)
	}
}

func TestHiddenMissionModule_AutoVerify_ClueAcquired(t *testing.T) {
	pid := uuid.New()
	deps := newTestDeps()
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "hold_clue", "description": "Hold clue_1", "points": 10, "verification": "auto", "targetClueId": "clue_1"},
			},
		},
	}
	data, _ := json.Marshal(cfg)

	m := NewHiddenMissionModule()
	if err := m.Init(context.Background(), deps, data); err != nil {
		t.Fatalf("Init: %v", err)
	}

	// Simulate clue acquired event.
	deps.EventBus.Publish(engine.Event{
		Type: "clue.acquired",
		Payload: map[string]any{
			"playerId": pid.String(),
			"clueId":   "clue_1",
		},
	})

	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.completedMissions[pid]) != 1 {
		t.Fatalf("expected 1 completed mission, got %d", len(m.completedMissions[pid]))
	}
	if m.scores[pid] != 10 {
		t.Errorf("score = %d, want 10", m.scores[pid])
	}
}

func TestHiddenMissionModule_AutoVerify_VoteCast(t *testing.T) {
	pid := uuid.New()
	deps := newTestDeps()
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "vote_target", "description": "Vote for char_A", "points": 5, "verification": "auto", "targetClueId": "char_A"},
			},
		},
	}
	data, _ := json.Marshal(cfg)

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

	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.completedMissions[pid]) != 1 {
		t.Fatalf("expected 1 completed, got %d", len(m.completedMissions[pid]))
	}
}

func TestHiddenMissionModule_AutoVerify_ClueTransferred(t *testing.T) {
	pid := uuid.New()
	deps := newTestDeps()
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "transfer_clue", "description": "Transfer a clue", "points": 8, "verification": "auto"},
			},
		},
	}
	data, _ := json.Marshal(cfg)

	m := NewHiddenMissionModule()
	if err := m.Init(context.Background(), deps, data); err != nil {
		t.Fatalf("Init: %v", err)
	}

	deps.EventBus.Publish(engine.Event{
		Type: "clue.transferred",
		Payload: map[string]any{
			"fromPlayerId": pid.String(),
			"targetCode":   "char_B",
			"clueId":       "clue_1",
		},
	})

	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.completedMissions[pid]) != 1 {
		t.Fatalf("expected 1 completed, got %d", len(m.completedMissions[pid]))
	}
	if m.scores[pid] != 8 {
		t.Errorf("score = %d, want 8", m.scores[pid])
	}
}

func TestHiddenMissionModule_AutoVerify_DuplicateCompletion(t *testing.T) {
	pid := uuid.New()
	deps := newTestDeps()
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "hold_clue", "description": "Hold clue_1", "points": 10, "verification": "auto", "targetClueId": "clue_1"},
			},
		},
	}
	data, _ := json.Marshal(cfg)

	m := NewHiddenMissionModule()
	if err := m.Init(context.Background(), deps, data); err != nil {
		t.Fatalf("Init: %v", err)
	}

	// Trigger twice.
	for i := 0; i < 2; i++ {
		deps.EventBus.Publish(engine.Event{
			Type: "clue.acquired",
			Payload: map[string]any{
				"playerId": pid.String(),
				"clueId":   "clue_1",
			},
		})
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.completedMissions[pid]) != 1 {
		t.Errorf("expected 1 completed (no dupe), got %d", len(m.completedMissions[pid]))
	}
	if m.scores[pid] != 10 {
		t.Errorf("score = %d, want 10 (no double award)", m.scores[pid])
	}
}

func TestHiddenMissionModule_AffectsScoreFalse(t *testing.T) {
	pid := uuid.New()
	deps := newTestDeps()
	cfg := map[string]any{
		"affectsScore": false,
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "hold_clue", "description": "Hold clue_1", "points": 10, "verification": "auto", "targetClueId": "clue_1"},
			},
		},
	}
	data, _ := json.Marshal(cfg)

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

	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.scores[pid] != 0 {
		t.Errorf("score = %d, want 0 (affectsScore=false)", m.scores[pid])
	}
	if !m.playerMissions[pid][0].Completed {
		t.Error("mission should still be marked completed")
	}
}

func TestHiddenMissionModule_BuildState(t *testing.T) {
	m := initHiddenMissionModule(t, "")

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}

	var state hiddenMissionState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if state.Config.VerificationMode != "auto" {
		t.Errorf("config.VerificationMode = %q, want %q", state.Config.VerificationMode, "auto")
	}
}

func TestHiddenMissionModule_Schema(t *testing.T) {
	m := NewHiddenMissionModule()
	schema := m.Schema()
	if len(schema) == 0 {
		t.Error("Schema() returned empty")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("Schema() not valid JSON: %v", err)
	}
}

func TestHiddenMissionModule_Cleanup(t *testing.T) {
	pid := uuid.New()
	deps := newTestDeps()
	cfg := map[string]any{
		"playerMissions": map[string]any{
			pid.String(): []map[string]any{
				{"id": "m1", "type": "hold_clue", "description": "Hold", "points": 10, "verification": "auto", "targetClueId": "c1"},
			},
		},
	}
	data, _ := json.Marshal(cfg)

	m := NewHiddenMissionModule()
	if err := m.Init(context.Background(), deps, data); err != nil {
		t.Fatalf("Init: %v", err)
	}

	if err := m.Cleanup(context.Background()); err != nil {
		t.Fatalf("Cleanup: %v", err)
	}

	if m.playerMissions != nil {
		t.Error("playerMissions should be nil after cleanup")
	}
	if m.completedMissions != nil {
		t.Error("completedMissions should be nil after cleanup")
	}
	if m.scores != nil {
		t.Error("scores should be nil after cleanup")
	}
}

func TestHiddenMissionModule_UnknownMessageType(t *testing.T) {
	m := initHiddenMissionModule(t, "")
	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Error("expected error for unknown message type")
	}
}
