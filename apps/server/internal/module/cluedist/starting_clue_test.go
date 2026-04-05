package cluedist

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestStartingClueModule_Name(t *testing.T) {
	m := NewStartingClueModule()
	if m.Name() != "starting_clue" {
		t.Fatalf("expected %q, got %q", "starting_clue", m.Name())
	}
}

func TestStartingClueModule_Init(t *testing.T) {
	tests := []struct {
		name           string
		config         json.RawMessage
		wantDistAt     string
		wantNotify     bool
		wantCluesCount int
		wantErr        bool
	}{
		{
			name:           "defaults with nil config",
			config:         nil,
			wantDistAt:     "game_start",
			wantNotify:     true,
			wantCluesCount: 0,
		},
		{
			name: "custom config",
			config: json.RawMessage(`{
				"distributeAt": "first_phase",
				"notifyPlayer": false,
				"startingClues": {"detective": ["c1", "c2"], "butler": ["c3"]}
			}`),
			wantDistAt:     "first_phase",
			wantNotify:     false,
			wantCluesCount: 2,
		},
		{
			name:    "invalid JSON",
			config:  json.RawMessage(`{bad}`),
			wantErr: true,
		},
		{
			name:    "invalid distributeAt",
			config:  json.RawMessage(`{"distributeAt":"never"}`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewStartingClueModule()
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
			if m.config.DistributeAt != tt.wantDistAt {
				t.Fatalf("distributeAt = %q, want %q", m.config.DistributeAt, tt.wantDistAt)
			}
			if m.config.NotifyPlayer != tt.wantNotify {
				t.Fatalf("notifyPlayer = %v, want %v", m.config.NotifyPlayer, tt.wantNotify)
			}
			if len(m.distributions) != tt.wantCluesCount {
				t.Fatalf("distributions len = %d, want %d", len(m.distributions), tt.wantCluesCount)
			}
		})
	}
}

func TestStartingClueModule_DistributeOnGameStart(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"distributeAt": "game_start",
		"startingClues": {"detective": ["c1", "c2"]}
	}`)
	m := NewStartingClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	var distributed bool
	deps.EventBus.Subscribe("clue.starting_distributed", func(e engine.Event) {
		distributed = true
		payload := e.Payload.(map[string]any)
		if payload["characterCode"] != "detective" {
			t.Errorf("expected characterCode detective, got %v", payload["characterCode"])
		}
	})

	// Trigger game start.
	deps.EventBus.Publish(engine.Event{Type: "game.started", Payload: nil})
	time.Sleep(10 * time.Millisecond)

	if !distributed {
		t.Fatal("clue.starting_distributed event not published")
	}

	m.mu.RLock()
	if !m.distributed {
		t.Fatal("expected distributed to be true")
	}
	m.mu.RUnlock()
}

func TestStartingClueModule_DistributeOnFirstPhase(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"distributeAt": "first_phase",
		"startingClues": {"nurse": ["c5"]}
	}`)
	m := NewStartingClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	var distributed bool
	deps.EventBus.Subscribe("clue.starting_distributed", func(_ engine.Event) {
		distributed = true
	})

	deps.EventBus.Publish(engine.Event{Type: "phase.changed", Payload: nil})
	time.Sleep(10 * time.Millisecond)

	if !distributed {
		t.Fatal("expected distribution on phase.changed")
	}
}

func TestStartingClueModule_DistributeOnlyOnce(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"distributeAt": "game_start",
		"startingClues": {"x": ["c1"]}
	}`)
	m := NewStartingClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	count := 0
	deps.EventBus.Subscribe("clue.starting_distributed", func(_ engine.Event) {
		count++
	})

	deps.EventBus.Publish(engine.Event{Type: "game.started"})
	deps.EventBus.Publish(engine.Event{Type: "game.started"})
	time.Sleep(10 * time.Millisecond)

	if count != 1 {
		t.Fatalf("expected 1 distribution, got %d", count)
	}
}

func TestStartingClueModule_HandleMessage_UnknownType(t *testing.T) {
	m := NewStartingClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestStartingClueModule_HandleMessage_Status(t *testing.T) {
	m := NewStartingClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "starting:status", nil)
	if err != nil {
		t.Fatalf("starting:status failed: %v", err)
	}
}

func TestStartingClueModule_BuildState(t *testing.T) {
	m := NewStartingClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state startingClueState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if state.Distributed {
		t.Fatal("expected distributed to be false initially")
	}
}

func TestStartingClueModule_Schema(t *testing.T) {
	m := NewStartingClueModule()
	schema := m.Schema()
	if schema == nil {
		t.Fatal("Schema returned nil")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("Schema not valid JSON: %v", err)
	}
}

func TestStartingClueModule_Cleanup(t *testing.T) {
	m := NewStartingClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.distributions != nil {
		t.Fatal("expected distributions nil after cleanup")
	}
}
