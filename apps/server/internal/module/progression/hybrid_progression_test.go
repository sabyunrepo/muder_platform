package progression

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestHybridProgressionModule_Init(t *testing.T) {
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
			name:   "custom threshold",
			config: json.RawMessage(`{"ConsensusThreshold":50}`),
		},
		{
			name:    "invalid json",
			config:  json.RawMessage(`{bad`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewHybridProgressionModule()
			err := m.Init(context.Background(), newTestDeps(t), tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("Init() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestHybridProgressionModule_HandleMessage(t *testing.T) {
	tests := []struct {
		name      string
		threshold int
		msgType   string
		payload   json.RawMessage
		voters    int // number of approving voters before this message
		wantErr   bool
		wantEvent string
	}{
		{
			name:      "consensus vote reaching threshold",
			threshold: 50,
			msgType:   "hybrid:consensus_vote",
			payload:   json.RawMessage(`{"Vote":true}`),
			wantEvent: "hybrid.consensus_reached",
		},
		{
			name:      "trigger event",
			threshold: 70,
			msgType:   "hybrid:trigger_event",
			payload:   json.RawMessage(`{"EventID":"evt_1"}`),
			wantEvent: "hybrid.trigger_fired",
		},
		{
			name:    "invalid payload",
			msgType: "hybrid:consensus_vote",
			payload: json.RawMessage(`{bad`),
			wantErr: true,
		},
		{
			name:    "unknown message",
			msgType: "hybrid:unknown",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deps := newTestDeps(t)
			m := NewHybridProgressionModule()

			threshold := tt.threshold
			if threshold == 0 {
				threshold = 70
			}
			cfg, _ := json.Marshal(map[string]any{"ConsensusThreshold": threshold})
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

func TestHybridProgressionModule_ConsensusThreshold(t *testing.T) {
	deps := newTestDeps(t)
	m := NewHybridProgressionModule()

	cfg := json.RawMessage(`{"ConsensusThreshold":60}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	var reached bool
	deps.EventBus.Subscribe("hybrid.consensus_reached", func(e engine.Event) {
		reached = true
	})

	// 1 of 1 = 100% >= 60% -> consensus reached
	payload := json.RawMessage(`{"Vote":true}`)
	if err := m.HandleMessage(context.Background(), uuid.New(), "hybrid:consensus_vote", payload); err != nil {
		t.Fatalf("HandleMessage() error = %v", err)
	}
	if !reached {
		t.Error("expected consensus_reached event")
	}
}

func TestHybridProgressionModule_BuildState(t *testing.T) {
	deps := newTestDeps(t)
	m := NewHybridProgressionModule()

	if err := m.Init(context.Background(), deps, nil); err != nil {
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

	if state["consensusThreshold"] != float64(70) {
		t.Errorf("consensusThreshold = %v, want 70", state["consensusThreshold"])
	}
	if state["conditionMet"] != false {
		t.Errorf("conditionMet = %v, want false", state["conditionMet"])
	}
}
