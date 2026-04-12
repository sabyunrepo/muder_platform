package decision

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func initAccusationModule(t *testing.T, configJSON string) *AccusationModule {
	t.Helper()
	m := NewAccusationModule()
	var cfg json.RawMessage
	if configJSON != "" {
		cfg = json.RawMessage(configJSON)
	}
	if err := m.Init(context.Background(), newTestDeps(), cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	return m
}

func TestAccusationModule_Name(t *testing.T) {
	m := NewAccusationModule()
	if got := m.Name(); got != "accusation" {
		t.Errorf("Name() = %q, want %q", got, "accusation")
	}
}

func TestAccusationModule_InitDefaults(t *testing.T) {
	m := initAccusationModule(t, "")
	if m.config.MaxPerRound != 1 {
		t.Errorf("default MaxPerRound = %d, want 1", m.config.MaxPerRound)
	}
	if m.config.DefenseTime != 60 {
		t.Errorf("default DefenseTime = %d, want 60", m.config.DefenseTime)
	}
	if m.config.VoteThreshold != 50 {
		t.Errorf("default VoteThreshold = %d, want 50", m.config.VoteThreshold)
	}
	if m.config.AllowSelfAccuse {
		t.Error("default AllowSelfAccuse should be false")
	}
	if m.config.DeadCanAccuse {
		t.Error("default DeadCanAccuse should be false")
	}
}

func TestAccusationModule_InitCustomConfig(t *testing.T) {
	m := initAccusationModule(t, `{"maxPerRound":3,"defenseTime":120,"voteThreshold":66}`)
	if m.config.MaxPerRound != 3 {
		t.Errorf("MaxPerRound = %d, want 3", m.config.MaxPerRound)
	}
	if m.config.DefenseTime != 120 {
		t.Errorf("DefenseTime = %d, want 120", m.config.DefenseTime)
	}
	if m.config.VoteThreshold != 66 {
		t.Errorf("VoteThreshold = %d, want 66", m.config.VoteThreshold)
	}
}

func TestAccusationModule_Accuse(t *testing.T) {
	tests := []struct {
		name    string
		config  string
		setup   func(m *AccusationModule)
		payload string
		wantErr bool
	}{
		{
			name:    "successful accusation",
			config:  "",
			setup:   func(m *AccusationModule) {},
			payload: `{"targetCode":"char_B"}`,
			wantErr: false,
		},
		{
			name:    "empty target code",
			config:  "",
			setup:   func(m *AccusationModule) {},
			payload: `{"targetCode":""}`,
			wantErr: true,
		},
		{
			name:   "accusation already active",
			config: "",
			setup: func(m *AccusationModule) {
				m.mu.Lock()
				m.activeAccusation = &Accusation{
					AccuserID:   uuid.New(),
					AccusedCode: "char_A",
					Votes:       make(map[uuid.UUID]bool),
				}
				m.mu.Unlock()
			},
			payload: `{"targetCode":"char_B"}`,
			wantErr: true,
		},
		{
			name:   "max accusations reached",
			config: `{"maxPerRound":1}`,
			setup: func(m *AccusationModule) {
				m.mu.Lock()
				m.accusationCount = 1
				m.mu.Unlock()
			},
			payload: `{"targetCode":"char_B"}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := initAccusationModule(t, tt.config)
			tt.setup(m)
			err := m.HandleMessage(context.Background(), uuid.New(), "accusation:accuse", json.RawMessage(tt.payload))
			if (err != nil) != tt.wantErr {
				t.Errorf("error = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}

func TestAccusationModule_AccuseCreatesAccusation(t *testing.T) {
	m := initAccusationModule(t, "")
	m.timeNow = func() time.Time { return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) }

	pid := uuid.New()
	err := m.HandleMessage(context.Background(), pid, "accusation:accuse", json.RawMessage(`{"targetCode":"char_B"}`))
	if err != nil {
		t.Fatalf("accuse: %v", err)
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.activeAccusation == nil {
		t.Fatal("expected active accusation")
	}
	if m.activeAccusation.AccuserID != pid {
		t.Error("accuser ID mismatch")
	}
	if m.activeAccusation.AccusedCode != "char_B" {
		t.Errorf("accusedCode = %q, want %q", m.activeAccusation.AccusedCode, "char_B")
	}
	expectedDeadline := time.Date(2026, 1, 1, 0, 1, 0, 0, time.UTC)
	if !m.activeAccusation.DefenseDeadline.Equal(expectedDeadline) {
		t.Errorf("deadline = %v, want %v", m.activeAccusation.DefenseDeadline, expectedDeadline)
	}
	if m.accusationCount != 1 {
		t.Errorf("accusationCount = %d, want 1", m.accusationCount)
	}
	if !m.isActive {
		t.Error("expected isActive=true")
	}
}

func TestAccusationModule_Vote(t *testing.T) {
	tests := []struct {
		name            string
		config          string
		guiltyVotes     int
		totalVoters     int
		eligibleVoters  int
		wantExpelled    bool
		wantResolved    bool
	}{
		{
			name:           "majority guilty -> expelled",
			config:         `{"voteThreshold":50}`,
			guiltyVotes:    3,
			totalVoters:    4,
			eligibleVoters: 4,
			wantExpelled:   true,
			wantResolved:   true,
		},
		{
			name:           "exactly at threshold -> expelled",
			config:         `{"voteThreshold":50}`,
			guiltyVotes:    2,
			totalVoters:    4,
			eligibleVoters: 4,
			wantExpelled:   true,
			wantResolved:   true,
		},
		{
			name:           "below threshold -> not expelled",
			config:         `{"voteThreshold":50}`,
			guiltyVotes:    1,
			totalVoters:    4,
			eligibleVoters: 4,
			wantExpelled:   false,
			wantResolved:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := initAccusationModule(t, tt.config)
			accuserID := uuid.New()
			accusedID := uuid.New()

			// Set up active accusation with pre-existing votes.
			m.mu.Lock()
			m.activeAccusation = &Accusation{
				AccuserID:      accuserID,
				AccusedID:      accusedID,
				AccusedCode:    "char_B",
				Votes:          make(map[uuid.UUID]bool),
				EligibleVoters: tt.eligibleVoters,
			}
			m.isActive = true
			// Add votes except the last one.
			for i := 0; i < tt.totalVoters-1; i++ {
				guilty := i < tt.guiltyVotes-1
				m.activeAccusation.Votes[uuid.New()] = guilty
			}
			m.mu.Unlock()

			// Cast the final vote.
			lastGuilty := tt.guiltyVotes > tt.totalVoters-1
			payload, _ := json.Marshal(accusationVotePayload{Guilty: lastGuilty})
			voter := uuid.New()
			err := m.HandleMessage(context.Background(), voter, "accusation:vote", payload)
			if err != nil {
				t.Fatalf("vote: %v", err)
			}

			// Accusation should be resolved.
			m.mu.RLock()
			if tt.wantResolved {
				if m.activeAccusation != nil {
					t.Error("expected accusation to be resolved (nil)")
				}
				if m.isActive {
					t.Error("expected isActive=false after resolution")
				}
			}
			m.mu.RUnlock()
		})
	}
}

func TestAccusationModule_VoteNoActiveAccusation(t *testing.T) {
	m := initAccusationModule(t, "")
	err := m.HandleMessage(context.Background(), uuid.New(), "accusation:vote", json.RawMessage(`{"guilty":true}`))
	if err == nil {
		t.Error("expected error when voting with no active accusation")
	}
}

func TestAccusationModule_AccuserCannotVote(t *testing.T) {
	m := initAccusationModule(t, "")
	accuserID := uuid.New()
	accusedID := uuid.New()
	m.mu.Lock()
	m.activeAccusation = &Accusation{
		AccuserID:      accuserID,
		AccusedID:      accusedID,
		AccusedCode:    "char_B",
		Votes:          make(map[uuid.UUID]bool),
		EligibleVoters: 4,
	}
	m.isActive = true
	m.mu.Unlock()

	err := m.HandleMessage(context.Background(), accuserID, "accusation:vote", json.RawMessage(`{"guilty":true}`))
	if err == nil {
		t.Error("expected error when accuser tries to vote")
	}
}

func TestAccusationModule_AccusedCannotVote(t *testing.T) {
	m := initAccusationModule(t, "")
	accuserID := uuid.New()
	accusedID := uuid.New()
	m.mu.Lock()
	m.activeAccusation = &Accusation{
		AccuserID:      accuserID,
		AccusedID:      accusedID,
		AccusedCode:    "char_B",
		Votes:          make(map[uuid.UUID]bool),
		EligibleVoters: 4,
	}
	m.isActive = true
	m.mu.Unlock()

	err := m.HandleMessage(context.Background(), accusedID, "accusation:vote", json.RawMessage(`{"guilty":true}`))
	if err == nil {
		t.Error("expected error when accused tries to vote on own accusation")
	}
}

func TestAccusationModule_Reset(t *testing.T) {
	m := initAccusationModule(t, "")
	m.mu.Lock()
	m.accusationCount = 3
	m.activeAccusation = &Accusation{
		AccuserID:   uuid.New(),
		AccusedCode: "char_A",
		Votes:       make(map[uuid.UUID]bool),
	}
	m.isActive = true
	m.mu.Unlock()

	err := m.HandleMessage(context.Background(), uuid.New(), "accusation:reset", nil)
	if err != nil {
		t.Fatalf("reset: %v", err)
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.accusationCount != 0 {
		t.Errorf("accusationCount = %d, want 0", m.accusationCount)
	}
	if m.activeAccusation != nil {
		t.Error("expected activeAccusation to be nil after reset")
	}
	if m.isActive {
		t.Error("expected isActive=false after reset")
	}
}

func TestAccusationModule_VoteQuorum(t *testing.T) {
	// With 4 eligible voters and threshold 50%, a single vote should NOT resolve.
	m := initAccusationModule(t, `{"voteThreshold":50}`)
	accuserID := uuid.New()
	accusedID := uuid.New()
	m.mu.Lock()
	m.activeAccusation = &Accusation{
		AccuserID:      accuserID,
		AccusedID:      accusedID,
		AccusedCode:    "char_B",
		Votes:          make(map[uuid.UUID]bool),
		EligibleVoters: 4,
	}
	m.isActive = true
	m.mu.Unlock()

	// First vote: guilty. Should NOT resolve yet.
	voter1 := uuid.New()
	err := m.HandleMessage(context.Background(), voter1, "accusation:vote", json.RawMessage(`{"guilty":true}`))
	if err != nil {
		t.Fatalf("vote1: %v", err)
	}

	m.mu.RLock()
	if m.activeAccusation == nil {
		t.Fatal("accusation should NOT be resolved after 1 of 4 votes")
	}
	m.mu.RUnlock()
}

func TestAccusationModule_BuildState(t *testing.T) {
	m := initAccusationModule(t, "")

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}

	var state accusationState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if state.IsActive {
		t.Error("expected isActive=false")
	}
	if state.AccusationCount != 0 {
		t.Errorf("accusationCount = %d, want 0", state.AccusationCount)
	}
}

func TestAccusationModule_Schema(t *testing.T) {
	m := NewAccusationModule()
	schema := m.Schema()
	if len(schema) == 0 {
		t.Error("Schema() returned empty")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("Schema() not valid JSON: %v", err)
	}
}

func TestAccusationModule_Cleanup(t *testing.T) {
	m := initAccusationModule(t, "")
	m.mu.Lock()
	m.activeAccusation = &Accusation{}
	m.isActive = true
	m.mu.Unlock()

	if err := m.Cleanup(context.Background()); err != nil {
		t.Fatalf("Cleanup: %v", err)
	}
	if m.activeAccusation != nil {
		t.Error("activeAccusation should be nil after cleanup")
	}
	if m.isActive {
		t.Error("isActive should be false after cleanup")
	}
}

func TestAccusationModule_UnknownMessageType(t *testing.T) {
	m := initAccusationModule(t, "")
	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Error("expected error for unknown message type")
	}
}

// --- GameEventHandler tests ---

func TestAccusationModule_Validate_Accuse(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(m *AccusationModule)
		payload string
		wantErr bool
	}{
		{
			name:    "valid accusation",
			setup:   func(m *AccusationModule) {},
			payload: `{"playerId":"` + uuid.New().String() + `","targetCode":"char_B"}`,
			wantErr: false,
		},
		{
			name:    "missing targetCode",
			setup:   func(m *AccusationModule) {},
			payload: `{"playerId":"` + uuid.New().String() + `","targetCode":""}`,
			wantErr: true,
		},
		{
			name: "accusation already active",
			setup: func(m *AccusationModule) {
				m.mu.Lock()
				m.activeAccusation = &Accusation{AccuserID: uuid.New(), Votes: make(map[uuid.UUID]bool)}
				m.mu.Unlock()
			},
			payload: `{"playerId":"` + uuid.New().String() + `","targetCode":"char_B"}`,
			wantErr: true,
		},
		{
			name: "max accusations reached",
			setup: func(m *AccusationModule) {
				m.mu.Lock()
				m.accusationCount = 1
				m.mu.Unlock()
			},
			payload: `{"playerId":"` + uuid.New().String() + `","targetCode":"char_B"}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := initAccusationModule(t, "")
			tt.setup(m)
			event := engine.GameEvent{
				Type:    "accusation:accuse",
				Payload: json.RawMessage(tt.payload),
			}
			err := m.Validate(context.Background(), event, engine.GameState{})
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}

func TestAccusationModule_Validate_Vote(t *testing.T) {
	m := initAccusationModule(t, "")
	accuserID := uuid.New()
	accusedID := uuid.New()
	m.mu.Lock()
	m.activeAccusation = &Accusation{
		AccuserID:      accuserID,
		AccusedID:      accusedID,
		AccusedCode:    "char_B",
		Votes:          make(map[uuid.UUID]bool),
		EligibleVoters: 4,
	}
	m.isActive = true
	m.mu.Unlock()

	// Valid voter.
	voter := uuid.New()
	event := engine.GameEvent{
		Type:    "accusation:vote",
		Payload: json.RawMessage(`{"playerId":"` + voter.String() + `","guilty":true}`),
	}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err != nil {
		t.Fatalf("valid voter should pass: %v", err)
	}

	// Accuser cannot vote.
	event.Payload = json.RawMessage(`{"playerId":"` + accuserID.String() + `","guilty":true}`)
	if err := m.Validate(context.Background(), event, engine.GameState{}); err == nil {
		t.Error("accuser should not be able to vote")
	}

	// Accused cannot vote.
	event.Payload = json.RawMessage(`{"playerId":"` + accusedID.String() + `","guilty":true}`)
	if err := m.Validate(context.Background(), event, engine.GameState{}); err == nil {
		t.Error("accused should not be able to vote")
	}
}

func TestAccusationModule_Validate_UnsupportedEvent(t *testing.T) {
	m := initAccusationModule(t, "")
	event := engine.GameEvent{Type: "unknown", Payload: json.RawMessage(`{}`)}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err == nil {
		t.Error("expected error for unsupported event type")
	}
}

func TestAccusationModule_Apply_Accuse(t *testing.T) {
	m := initAccusationModule(t, "")
	m.timeNow = func() time.Time { return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) }
	pid := uuid.New()

	state := engine.GameState{Modules: make(map[string]json.RawMessage)}
	event := engine.GameEvent{
		Type:    "accusation:accuse",
		Payload: json.RawMessage(`{"playerId":"` + pid.String() + `","targetCode":"char_B"}`),
	}

	if err := m.Apply(context.Background(), event, &state); err != nil {
		t.Fatalf("Apply: %v", err)
	}

	if _, ok := state.Modules["accusation"]; !ok {
		t.Error("expected accusation state in GameState.Modules")
	}
	m.mu.RLock()
	if m.activeAccusation == nil {
		t.Error("expected active accusation after Apply")
	}
	m.mu.RUnlock()
}

func TestAccusationModule_Apply_Vote(t *testing.T) {
	m := initAccusationModule(t, "")
	accuserID := uuid.New()
	m.mu.Lock()
	m.activeAccusation = &Accusation{
		AccuserID:   accuserID,
		AccusedCode: "char_B",
		Votes:       make(map[uuid.UUID]bool),
	}
	m.isActive = true
	m.mu.Unlock()

	voter := uuid.New()
	state := engine.GameState{Modules: make(map[string]json.RawMessage)}
	event := engine.GameEvent{
		Type:    "accusation:vote",
		Payload: json.RawMessage(`{"playerId":"` + voter.String() + `","guilty":true}`),
	}

	if err := m.Apply(context.Background(), event, &state); err != nil {
		t.Fatalf("Apply vote: %v", err)
	}

	m.mu.RLock()
	guilty, exists := m.activeAccusation.Votes[voter]
	m.mu.RUnlock()
	if !exists || !guilty {
		t.Error("expected guilty vote recorded")
	}
}

// --- WinChecker tests ---

func TestAccusationModule_CheckWin(t *testing.T) {
	tests := []struct {
		name    string
		state   engine.GameState
		wantWon bool
	}{
		{
			name:    "no accusation state",
			state:   engine.GameState{},
			wantWon: false,
		},
		{
			name: "no expulsion",
			state: engine.GameState{
				Modules: map[string]json.RawMessage{
					"accusation": json.RawMessage(`{"expelledCode":"","expelledIsCulprit":false}`),
				},
			},
			wantWon: false,
		},
		{
			name: "expelled but wrong person",
			state: engine.GameState{
				Modules: map[string]json.RawMessage{
					"accusation": json.RawMessage(`{"expelledCode":"char_B","expelledIsCulprit":false}`),
				},
			},
			wantWon: false,
		},
		{
			name: "expelled culprit -> win",
			state: engine.GameState{
				Modules: map[string]json.RawMessage{
					"accusation": json.RawMessage(`{"expelledCode":"char_B","expelledIsCulprit":true}`),
				},
			},
			wantWon: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewAccusationModule()
			result, err := m.CheckWin(context.Background(), tt.state)
			if err != nil {
				t.Fatalf("CheckWin: %v", err)
			}
			if result.Won != tt.wantWon {
				t.Errorf("Won = %v, want %v", result.Won, tt.wantWon)
			}
		})
	}
}

// --- PhaseHookModule tests ---

func TestAccusationModule_OnPhaseEnter(t *testing.T) {
	m := initAccusationModule(t, "")
	m.mu.Lock()
	m.accusationCount = 3
	m.activeAccusation = &Accusation{AccuserID: uuid.New(), Votes: make(map[uuid.UUID]bool)}
	m.isActive = true
	m.mu.Unlock()

	if err := m.OnPhaseEnter(context.Background(), engine.Phase("discussion")); err != nil {
		t.Fatalf("OnPhaseEnter: %v", err)
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.accusationCount != 0 {
		t.Errorf("accusationCount = %d, want 0", m.accusationCount)
	}
	if m.activeAccusation != nil {
		t.Error("expected activeAccusation nil after phase enter")
	}
	if m.isActive {
		t.Error("expected isActive=false after phase enter")
	}
}

func TestAccusationModule_OnPhaseExit(t *testing.T) {
	m := initAccusationModule(t, "")
	m.mu.Lock()
	m.activeAccusation = &Accusation{AccuserID: uuid.New(), Votes: make(map[uuid.UUID]bool)}
	m.isActive = true
	m.mu.Unlock()

	if err := m.OnPhaseExit(context.Background(), engine.Phase("discussion")); err != nil {
		t.Fatalf("OnPhaseExit: %v", err)
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.activeAccusation != nil {
		t.Error("expected activeAccusation nil after phase exit")
	}
	if m.isActive {
		t.Error("expected isActive=false after phase exit")
	}
}
