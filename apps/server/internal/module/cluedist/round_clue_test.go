package cluedist

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestRoundClueModule_Name(t *testing.T) {
	m := NewRoundClueModule()
	if m.Name() != "round_clue" {
		t.Fatalf("expected %q, got %q", "round_clue", m.Name())
	}
}

func TestRoundClueModule_Init(t *testing.T) {
	tests := []struct {
		name     string
		config   json.RawMessage
		wantMode string
		wantPub  bool
		wantErr  bool
	}{
		{
			name:     "defaults with nil config",
			config:   nil,
			wantMode: "specific",
			wantPub:  true,
		},
		{
			name:     "custom config",
			config:   json.RawMessage(`{"distributeMode":"random","announcePublic":false}`),
			wantMode: "random",
			wantPub:  false,
		},
		{
			name:    "invalid JSON",
			config:  json.RawMessage(`{bad}`),
			wantErr: true,
		},
		{
			name:    "invalid distribute mode",
			config:  json.RawMessage(`{"distributeMode":"invalid"}`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewRoundClueModule()
			err := m.Init(context.Background(), newTestDeps(), tt.config)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("Init failed: %v", err)
			}
			if m.config.DistributeMode != tt.wantMode {
				t.Fatalf("distributeMode = %q, want %q", m.config.DistributeMode, tt.wantMode)
			}
			if m.config.AnnouncePublic != tt.wantPub {
				t.Fatalf("announcePublic = %v, want %v", m.config.AnnouncePublic, tt.wantPub)
			}
		})
	}
}

func TestRoundClueModule_DistributeOnRoundChange(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"distributions": [
			{"round": 1, "clueId": "r1_clue", "targetCode": "detective"},
			{"round": 2, "clueId": "r2_clue", "targetCode": "butler"}
		]
	}`)
	m := NewRoundClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	var distributedClues []string
	deps.EventBus.Subscribe("clue.round_distributed", func(e engine.Event) {
		payload := e.Payload.(map[string]any)
		distributedClues = append(distributedClues, payload["clueId"].(string))
	})

	// Trigger round 1.
	deps.EventBus.Publish(engine.Event{
		Type:    "phase.changed",
		Payload: map[string]any{"round": 1},
	})
	time.Sleep(10 * time.Millisecond)

	if len(distributedClues) != 1 || distributedClues[0] != "r1_clue" {
		t.Fatalf("expected [r1_clue], got %v", distributedClues)
	}

	// Trigger round 2.
	deps.EventBus.Publish(engine.Event{
		Type:    "phase.changed",
		Payload: map[string]any{"round": 2},
	})
	time.Sleep(10 * time.Millisecond)

	if len(distributedClues) != 2 || distributedClues[1] != "r2_clue" {
		t.Fatalf("expected [r1_clue, r2_clue], got %v", distributedClues)
	}
}

func TestRoundClueModule_NoDuplicateDistribution(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"distributions": [{"round": 1, "clueId": "x", "targetCode": "y"}]
	}`)
	m := NewRoundClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	count := 0
	deps.EventBus.Subscribe("clue.round_distributed", func(_ engine.Event) {
		count++
	})

	// Trigger round 1 twice.
	deps.EventBus.Publish(engine.Event{Type: "phase.changed", Payload: map[string]any{"round": 1}})
	deps.EventBus.Publish(engine.Event{Type: "phase.changed", Payload: map[string]any{"round": 1}})
	time.Sleep(10 * time.Millisecond)

	if count != 1 {
		t.Fatalf("expected 1 distribution, got %d", count)
	}
}

func TestRoundClueModule_NoDistributionForUnmatchedRound(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"distributions": [{"round": 3, "clueId": "x", "targetCode": "y"}]
	}`)
	m := NewRoundClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	count := 0
	deps.EventBus.Subscribe("clue.round_distributed", func(_ engine.Event) {
		count++
	})

	deps.EventBus.Publish(engine.Event{Type: "phase.changed", Payload: map[string]any{"round": 1}})
	time.Sleep(10 * time.Millisecond)

	if count != 0 {
		t.Fatalf("expected 0 distributions, got %d", count)
	}
}

func TestRoundClueModule_ModeOverridePerDistribution(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"distributeMode": "specific",
		"distributions": [{"round": 1, "clueId": "x", "targetCode": "y", "mode": "all"}]
	}`)
	m := NewRoundClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	var receivedMode string
	deps.EventBus.Subscribe("clue.round_distributed", func(e engine.Event) {
		payload := e.Payload.(map[string]any)
		receivedMode = payload["mode"].(string)
	})

	deps.EventBus.Publish(engine.Event{Type: "phase.changed", Payload: map[string]any{"round": 1}})
	time.Sleep(10 * time.Millisecond)

	if receivedMode != "all" {
		t.Fatalf("expected mode override to all, got %q", receivedMode)
	}
}

func TestRoundClueModule_HandleMessage_UnknownType(t *testing.T) {
	m := NewRoundClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestRoundClueModule_HandleMessage_Status(t *testing.T) {
	m := NewRoundClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "round_clue:status", nil)
	if err != nil {
		t.Fatalf("round_clue:status failed: %v", err)
	}
}

func TestRoundClueModule_BuildState(t *testing.T) {
	m := NewRoundClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state roundClueState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if state.CurrentRound != 0 {
		t.Fatalf("expected currentRound 0, got %d", state.CurrentRound)
	}
}

func TestRoundClueModule_Schema(t *testing.T) {
	m := NewRoundClueModule()
	schema := m.Schema()
	if schema == nil {
		t.Fatal("Schema returned nil")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("Schema not valid JSON: %v", err)
	}
}

func TestRoundClueModule_Cleanup(t *testing.T) {
	m := NewRoundClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.distributions != nil {
		t.Fatal("expected distributions nil after cleanup")
	}
	if m.distributedRounds != nil {
		t.Fatal("expected distributedRounds nil after cleanup")
	}
}
