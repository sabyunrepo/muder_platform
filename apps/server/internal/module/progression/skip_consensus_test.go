package progression

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestSkipConsensusModule_Init(t *testing.T) {
	tests := []struct {
		name    string
		config  json.RawMessage
		wantErr bool
	}{
		{
			name:   "default config",
			config: nil,
		},
		{
			name:   "custom config",
			config: json.RawMessage(`{"AutoAgreeTimeout":5,"RequiredRatio":80,"TotalPlayers":4}`),
		},
		{
			name:    "invalid json",
			config:  json.RawMessage(`{bad`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewSkipConsensusModule()
			err := m.Init(context.Background(), newTestDeps(t), tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("Init() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSkipConsensusModule_HandleMessage(t *testing.T) {
	tests := []struct {
		name      string
		msgType   string
		wantErr   bool
		wantEvent string
	}{
		{
			name:      "skip request",
			msgType:   "skip:request",
			wantEvent: "skip.requested",
		},
		{
			name:    "agree without request",
			msgType: "skip:agree",
			wantErr: true,
		},
		{
			name:    "disagree without request",
			msgType: "skip:disagree",
			wantErr: true,
		},
		{
			name:    "unknown message",
			msgType: "skip:unknown",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deps := newTestDeps(t)
			m := NewSkipConsensusModule()

			cfg := json.RawMessage(`{"RequiredRatio":100,"TotalPlayers":3}`)
			if err := m.Init(context.Background(), deps, cfg); err != nil {
				t.Fatalf("Init() error = %v", err)
			}

			var received string
			if tt.wantEvent != "" {
				deps.EventBus.Subscribe(tt.wantEvent, func(e engine.Event) {
					received = e.Type
				})
			}

			err := m.HandleMessage(context.Background(), uuid.New(), tt.msgType, nil)
			if (err != nil) != tt.wantErr {
				t.Errorf("HandleMessage() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantEvent != "" && received != tt.wantEvent {
				t.Errorf("expected event %q, got %q", tt.wantEvent, received)
			}
		})
	}
}

func TestSkipConsensusModule_FullVoteCycle(t *testing.T) {
	deps := newTestDeps(t)
	m := NewSkipConsensusModule()

	cfg := json.RawMessage(`{"RequiredRatio":100,"TotalPlayers":2}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	var resolved bool
	var approved bool
	deps.EventBus.Subscribe("skip.resolved", func(e engine.Event) {
		resolved = true
		if p, ok := e.Payload.(map[string]any); ok {
			approved, _ = p["Approved"].(bool)
		}
	})

	player1 := uuid.New()
	player2 := uuid.New()

	// Player 1 requests (auto-agrees)
	if err := m.HandleMessage(context.Background(), player1, "skip:request", nil); err != nil {
		t.Fatalf("skip:request error = %v", err)
	}
	if resolved {
		t.Error("should not be resolved after 1 of 2 players")
	}

	// Player 2 agrees
	if err := m.HandleMessage(context.Background(), player2, "skip:agree", nil); err != nil {
		t.Fatalf("skip:agree error = %v", err)
	}
	if !resolved {
		t.Error("expected resolved after all players agreed")
	}
	if !approved {
		t.Error("expected skip to be approved")
	}
}

func TestSkipConsensusModule_Rejection(t *testing.T) {
	deps := newTestDeps(t)
	m := NewSkipConsensusModule()

	cfg := json.RawMessage(`{"RequiredRatio":100,"TotalPlayers":2}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	var resolved bool
	var approved bool
	deps.EventBus.Subscribe("skip.resolved", func(e engine.Event) {
		resolved = true
		if p, ok := e.Payload.(map[string]any); ok {
			approved, _ = p["Approved"].(bool)
		}
	})

	player1 := uuid.New()
	player2 := uuid.New()

	// Player 1 requests
	if err := m.HandleMessage(context.Background(), player1, "skip:request", nil); err != nil {
		t.Fatalf("skip:request error = %v", err)
	}

	// Player 2 disagrees -> impossible to reach 100%
	if err := m.HandleMessage(context.Background(), player2, "skip:disagree", nil); err != nil {
		t.Fatalf("skip:disagree error = %v", err)
	}
	if !resolved {
		t.Error("expected resolved after rejection makes threshold impossible")
	}
	if approved {
		t.Error("expected skip to be rejected")
	}
}

func TestSkipConsensusModule_BuildState(t *testing.T) {
	deps := newTestDeps(t)
	m := NewSkipConsensusModule()

	cfg := json.RawMessage(`{"RequiredRatio":80,"TotalPlayers":4}`)
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

	if state["activeRequest"] != false {
		t.Errorf("activeRequest = %v, want false", state["activeRequest"])
	}
	if state["requiredRatio"] != float64(80) {
		t.Errorf("requiredRatio = %v, want 80", state["requiredRatio"])
	}
}
