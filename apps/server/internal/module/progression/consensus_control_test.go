package progression

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestConsensusControlModule_Init(t *testing.T) {
	tests := []struct {
		name    string
		config  json.RawMessage
		wantErr bool
	}{
		{
			name:   "no config",
			config: nil,
		},
		{
			name:   "with total players",
			config: json.RawMessage(`{"TotalPlayers":6}`),
		},
		{
			name:    "invalid json",
			config:  json.RawMessage(`{bad`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewConsensusControlModule()
			err := m.Init(context.Background(), newTestDeps(t), tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("Init() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestConsensusControlModule_HandleMessage(t *testing.T) {
	tests := []struct {
		name      string
		msgType   string
		payload   json.RawMessage
		wantErr   bool
		wantEvent string
	}{
		{
			name:      "propose valid action",
			msgType:   "consensus:propose",
			payload:   json.RawMessage(`{"ActionType":"NEXT_PHASE"}`),
			wantEvent: "consensus.proposed",
		},
		{
			name:    "propose invalid action",
			msgType: "consensus:propose",
			payload: json.RawMessage(`{"ActionType":"INVALID_TYPE"}`),
			wantErr: true,
		},
		{
			name:    "vote without proposal",
			msgType: "consensus:vote",
			payload: json.RawMessage(`{"ActionType":"NEXT_PHASE","Approve":true}`),
			wantErr: true,
		},
		{
			name:    "unknown message",
			msgType: "consensus:unknown",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deps := newTestDeps(t)
			m := NewConsensusControlModule()

			cfg := json.RawMessage(`{"TotalPlayers":5}`)
			if err := m.Init(context.Background(), deps, cfg); err != nil {
				t.Fatalf("Init() error = %v", err)
			}

			var received string
			if tt.wantEvent != "" {
				deps.EventBus.Subscribe(tt.wantEvent, func(e engine.Event) {
					received = e.Type
				})
			}

			err := m.HandleMessage(context.Background(), uuid.New(), tt.msgType, tt.payload)
			if (err != nil) != tt.wantErr {
				t.Errorf("HandleMessage() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantEvent != "" && received != tt.wantEvent {
				t.Errorf("expected event %q, got %q", tt.wantEvent, received)
			}
		})
	}
}

func TestConsensusControlModule_MajorityApproval(t *testing.T) {
	deps := newTestDeps(t)
	m := NewConsensusControlModule()

	cfg := json.RawMessage(`{"TotalPlayers":3}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	var resolvedType string
	var resolvedApproved bool
	deps.EventBus.Subscribe("consensus.resolved", func(e engine.Event) {
		if p, ok := e.Payload.(map[string]any); ok {
			resolvedType, _ = p["ActionType"].(string)
			resolvedApproved, _ = p["Approved"].(bool)
		}
	})

	player1 := uuid.New()
	player2 := uuid.New()

	// Player 1 proposes (auto-approves)
	payload := json.RawMessage(`{"ActionType":"START_GAME"}`)
	if err := m.HandleMessage(context.Background(), player1, "consensus:propose", payload); err != nil {
		t.Fatalf("propose error = %v", err)
	}

	// Player 2 approves -> 2 of 3 = majority
	votePayload := json.RawMessage(`{"ActionType":"START_GAME","Approve":true}`)
	if err := m.HandleMessage(context.Background(), player2, "consensus:vote", votePayload); err != nil {
		t.Fatalf("vote error = %v", err)
	}

	if resolvedType != "START_GAME" {
		t.Errorf("resolvedType = %q, want START_GAME", resolvedType)
	}
	if !resolvedApproved {
		t.Error("expected proposal to be approved")
	}
}

func TestConsensusControlModule_MajorityRejection(t *testing.T) {
	deps := newTestDeps(t)
	m := NewConsensusControlModule()

	cfg := json.RawMessage(`{"TotalPlayers":3}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	var resolved bool
	var resolvedApproved bool
	deps.EventBus.Subscribe("consensus.resolved", func(e engine.Event) {
		resolved = true
		if p, ok := e.Payload.(map[string]any); ok {
			resolvedApproved, _ = p["Approved"].(bool)
		}
	})

	player1 := uuid.New()
	player2 := uuid.New()
	player3 := uuid.New()

	// Player 1 proposes
	payload := json.RawMessage(`{"ActionType":"SHOW_ENDING"}`)
	if err := m.HandleMessage(context.Background(), player1, "consensus:propose", payload); err != nil {
		t.Fatalf("propose error = %v", err)
	}

	// Player 2 rejects
	votePayload := json.RawMessage(`{"ActionType":"SHOW_ENDING","Approve":false}`)
	if err := m.HandleMessage(context.Background(), player2, "consensus:vote", votePayload); err != nil {
		t.Fatalf("vote error = %v", err)
	}

	// Player 3 rejects -> 2 rejections > 3/2 = majority rejected
	if err := m.HandleMessage(context.Background(), player3, "consensus:vote", votePayload); err != nil {
		t.Fatalf("vote error = %v", err)
	}

	if !resolved {
		t.Error("expected proposal to be resolved")
	}
	if resolvedApproved {
		t.Error("expected proposal to be rejected")
	}
}

func TestConsensusControlModule_AllActionTypes(t *testing.T) {
	actionTypes := []string{
		"START_GAME", "NEXT_PHASE", "NEXT_ROUND", "START_VOTING",
		"SHOW_ENDING", "READING_COMPLETE", "REVEAL_ALL_CLUES",
	}

	for _, actionType := range actionTypes {
		t.Run(actionType, func(t *testing.T) {
			deps := newTestDeps(t)
			m := NewConsensusControlModule()

			cfg := json.RawMessage(`{"TotalPlayers":1}`)
			if err := m.Init(context.Background(), deps, cfg); err != nil {
				t.Fatalf("Init() error = %v", err)
			}

			payload, _ := json.Marshal(map[string]string{"ActionType": actionType})
			err := m.HandleMessage(context.Background(), uuid.New(), "consensus:propose", payload)
			if err != nil {
				t.Errorf("propose %q error = %v", actionType, err)
			}
		})
	}
}

func TestConsensusControlModule_BuildState(t *testing.T) {
	deps := newTestDeps(t)
	m := NewConsensusControlModule()

	cfg := json.RawMessage(`{"TotalPlayers":4}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	raw, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState() error = %v", err)
	}

	var state map[string]any
	if err := json.Unmarshal(raw, &state); err != nil {
		t.Fatalf("unmarshal error = %v", err)
	}

	if state["totalPlayers"] != float64(4) {
		t.Errorf("totalPlayers = %v, want 4", state["totalPlayers"])
	}
}
