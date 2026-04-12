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

func TestStartingClueModule_PhaseHookModule(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"distributeAt": "game_start",
		"startingClues": {"detective": ["c1"]}
	}`)
	m := NewStartingClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	var distributed bool
	deps.EventBus.Subscribe("clue.starting_distributed", func(_ engine.Event) {
		distributed = true
	})

	// OnPhaseEnter with game_start config should trigger distribution.
	if err := m.OnPhaseEnter(context.Background(), "introduction"); err != nil {
		t.Fatalf("OnPhaseEnter failed: %v", err)
	}
	time.Sleep(10 * time.Millisecond)
	if !distributed {
		t.Fatal("expected distribution via OnPhaseEnter")
	}

	// Second call should not re-distribute (once-only guard).
	distributed = false
	if err := m.OnPhaseEnter(context.Background(), "discussion"); err != nil {
		t.Fatalf("OnPhaseEnter failed: %v", err)
	}
	if distributed {
		t.Fatal("should not distribute twice")
	}

	// OnPhaseExit is a no-op.
	if err := m.OnPhaseExit(context.Background(), "introduction"); err != nil {
		t.Fatalf("OnPhaseExit failed: %v", err)
	}
}

func TestStartingClueModule_SaveRestoreState(t *testing.T) {
	m := NewStartingClueModule()
	deps := newTestDeps()
	cfg := json.RawMessage(`{
		"distributeAt": "game_start",
		"startingClues": {"detective": ["c1", "c2"]}
	}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	// Trigger distribution.
	deps.EventBus.Publish(engine.Event{Type: "game.started"})
	time.Sleep(10 * time.Millisecond)

	// Save state.
	gs, err := m.SaveState(context.Background())
	if err != nil {
		t.Fatalf("SaveState failed: %v", err)
	}
	if _, ok := gs.Modules["starting_clue"]; !ok {
		t.Fatal("expected starting_clue key in GameState.Modules")
	}

	// Restore into a fresh module.
	m2 := NewStartingClueModule()
	_ = m2.Init(context.Background(), newTestDeps(), nil)
	if err := m2.RestoreState(context.Background(), uuid.New(), gs); err != nil {
		t.Fatalf("RestoreState failed: %v", err)
	}

	m2.mu.RLock()
	if !m2.distributed {
		t.Fatal("expected distributed=true after restore")
	}
	if len(m2.distributions) != 1 {
		t.Fatalf("expected 1 distribution entry, got %d", len(m2.distributions))
	}
	m2.mu.RUnlock()
}

func TestStartingClueModule_RestoreState_NoKey(t *testing.T) {
	m := NewStartingClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	// RestoreState with empty modules should be no-op.
	err := m.RestoreState(context.Background(), uuid.New(), engine.GameState{
		Modules: map[string]json.RawMessage{},
	})
	if err != nil {
		t.Fatalf("RestoreState with no key should succeed: %v", err)
	}
}
