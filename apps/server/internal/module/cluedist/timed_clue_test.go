package cluedist

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestTimedClueModule_Name(t *testing.T) {
	m := NewTimedClueModule()
	if m.Name() != "timed_clue" {
		t.Fatalf("expected %q, got %q", "timed_clue", m.Name())
	}
}

func TestTimedClueModule_Init(t *testing.T) {
	tests := []struct {
		name         string
		config       json.RawMessage
		wantInterval int
		wantMax      int
		wantMode     string
		wantErr      bool
	}{
		{
			name:         "defaults with nil config",
			config:       nil,
			wantInterval: 120,
			wantMax:      5,
			wantMode:     "all",
		},
		{
			name:         "custom config",
			config:       json.RawMessage(`{"interval":60,"maxAutoClues":3,"targetMode":"least_clues"}`),
			wantInterval: 60,
			wantMax:      3,
			wantMode:     "least_clues",
		},
		{
			name:    "invalid JSON",
			config:  json.RawMessage(`{bad}`),
			wantErr: true,
		},
		{
			name:    "invalid target mode",
			config:  json.RawMessage(`{"targetMode":"invalid"}`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewTimedClueModule()
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
			if m.config.Interval != tt.wantInterval {
				t.Fatalf("interval = %d, want %d", m.config.Interval, tt.wantInterval)
			}
			if m.config.MaxAutoClues != tt.wantMax {
				t.Fatalf("maxAutoClues = %d, want %d", m.config.MaxAutoClues, tt.wantMax)
			}
			if m.config.TargetMode != tt.wantMode {
				t.Fatalf("targetMode = %q, want %q", m.config.TargetMode, tt.wantMode)
			}
		})
	}
}

func TestTimedClueModule_StartStop(t *testing.T) {
	m := NewTimedClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	if m.isActive {
		t.Fatal("should not be active initially")
	}

	_ = m.HandleMessage(context.Background(), uuid.New(), "timed_clue:start", nil)
	m.mu.RLock()
	if !m.isActive {
		t.Fatal("should be active after start")
	}
	m.mu.RUnlock()

	_ = m.HandleMessage(context.Background(), uuid.New(), "timed_clue:stop", nil)
	m.mu.RLock()
	if m.isActive {
		t.Fatal("should be inactive after stop")
	}
	m.mu.RUnlock()
}

func TestTimedClueModule_TickDistributeWhenReady(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{"interval":10,"maxAutoClues":2,"cluePool":["tc1","tc2","tc3"]}`)
	m := NewTimedClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	// Use a controllable clock.
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	m.nowFunc = func() time.Time { return now }

	// Start the timer.
	_ = m.HandleMessage(context.Background(), uuid.New(), "timed_clue:start", nil)

	var distributedClues []string
	deps.EventBus.Subscribe("clue.timed_distributed", func(e engine.Event) {
		payload := e.Payload.(map[string]any)
		distributedClues = append(distributedClues, payload["clueId"].(string))
	})

	// Tick immediately — interval not elapsed, should not distribute.
	_ = m.HandleMessage(context.Background(), uuid.New(), "timed_clue:tick", nil)
	if len(distributedClues) != 0 {
		t.Fatalf("expected 0 distributions, got %d", len(distributedClues))
	}

	// Advance time past interval.
	now = now.Add(11 * time.Second)
	_ = m.HandleMessage(context.Background(), uuid.New(), "timed_clue:tick", nil)
	if len(distributedClues) != 1 || distributedClues[0] != "tc1" {
		t.Fatalf("expected [tc1], got %v", distributedClues)
	}

	// Advance again and tick.
	now = now.Add(11 * time.Second)
	_ = m.HandleMessage(context.Background(), uuid.New(), "timed_clue:tick", nil)
	if len(distributedClues) != 2 || distributedClues[1] != "tc2" {
		t.Fatalf("expected [tc1, tc2], got %v", distributedClues)
	}

	// Third tick should not distribute (maxAutoClues reached).
	now = now.Add(11 * time.Second)
	_ = m.HandleMessage(context.Background(), uuid.New(), "timed_clue:tick", nil)
	if len(distributedClues) != 2 {
		t.Fatalf("expected 2 distributions (max reached), got %d", len(distributedClues))
	}
}

func TestTimedClueModule_TickInactive(t *testing.T) {
	deps := newTestDeps()
	m := NewTimedClueModule()
	_ = m.Init(context.Background(), deps, nil)

	count := 0
	deps.EventBus.Subscribe("clue.timed_distributed", func(_ engine.Event) {
		count++
	})

	// Tick without starting — should do nothing.
	_ = m.HandleMessage(context.Background(), uuid.New(), "timed_clue:tick", nil)
	if count != 0 {
		t.Fatalf("expected 0 distributions when inactive, got %d", count)
	}
}

func TestTimedClueModule_LeastCluesMode(t *testing.T) {
	deps := newTestDeps()
	cfg := json.RawMessage(`{"interval":1,"maxAutoClues":5,"targetMode":"least_clues","cluePool":["lc1"]}`)
	m := NewTimedClueModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	// Simulate two players with different clue counts.
	p1 := uuid.New()
	p2 := uuid.New()
	m.mu.Lock()
	m.playerClueCount[p1] = 5
	m.playerClueCount[p2] = 1
	m.mu.Unlock()

	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	m.nowFunc = func() time.Time { return now }

	_ = m.HandleMessage(context.Background(), uuid.New(), "timed_clue:start", nil)

	var targetPlayerID string
	deps.EventBus.Subscribe("clue.timed_distributed", func(e engine.Event) {
		payload := e.Payload.(map[string]any)
		targetPlayerID = payload["targetPlayerId"].(string)
	})

	now = now.Add(2 * time.Second)
	_ = m.HandleMessage(context.Background(), uuid.New(), "timed_clue:tick", nil)

	if targetPlayerID != p2.String() {
		t.Fatalf("expected target %q (least clues), got %q", p2.String(), targetPlayerID)
	}
}

func TestTimedClueModule_TrackPlayerClueCount(t *testing.T) {
	deps := newTestDeps()
	m := NewTimedClueModule()
	_ = m.Init(context.Background(), deps, nil)

	pid := uuid.New()
	deps.EventBus.Publish(engine.Event{
		Type:    "clue.acquired",
		Payload: map[string]any{"playerId": pid.String()},
	})

	m.mu.RLock()
	count := m.playerClueCount[pid]
	m.mu.RUnlock()

	if count != 1 {
		t.Fatalf("expected player clue count 1, got %d", count)
	}
}

func TestTimedClueModule_HandleMessage_UnknownType(t *testing.T) {
	m := NewTimedClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestTimedClueModule_BuildState(t *testing.T) {
	m := NewTimedClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state timedClueState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if state.IsActive {
		t.Fatal("expected isActive false")
	}
	if state.MaxAutoClues != 5 {
		t.Fatalf("expected maxAutoClues 5, got %d", state.MaxAutoClues)
	}
}

func TestTimedClueModule_Schema(t *testing.T) {
	m := NewTimedClueModule()
	schema := m.Schema()
	if schema == nil {
		t.Fatal("Schema returned nil")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("Schema not valid JSON: %v", err)
	}
}

func TestTimedClueModule_Cleanup(t *testing.T) {
	m := NewTimedClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.playerClueCount != nil {
		t.Fatal("expected playerClueCount nil after cleanup")
	}
}

func TestTimedClueModule_SaveRestoreState(t *testing.T) {
	m := NewTimedClueModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	// Activate and distribute once.
	_ = m.handleStart()
	m.mu.Lock()
	m.distributedCount = 3
	m.mu.Unlock()

	// Save state.
	gs, err := m.SaveState(context.Background())
	if err != nil {
		t.Fatalf("SaveState failed: %v", err)
	}
	if _, ok := gs.Modules["timed_clue"]; !ok {
		t.Fatal("expected timed_clue key in GameState.Modules")
	}

	// Restore into fresh module.
	m2 := NewTimedClueModule()
	_ = m2.Init(context.Background(), newTestDeps(), nil)
	if err := m2.RestoreState(context.Background(), uuid.New(), gs); err != nil {
		t.Fatalf("RestoreState failed: %v", err)
	}

	m2.mu.RLock()
	if m2.distributedCount != 3 {
		t.Fatalf("expected distributedCount=3, got %d", m2.distributedCount)
	}
	if !m2.isActive {
		t.Fatal("expected isActive=true after restore")
	}
	m2.mu.RUnlock()
}

func TestTimedClueModule_RestoreState_NoKey(t *testing.T) {
	m := NewTimedClueModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.RestoreState(context.Background(), uuid.New(), engine.GameState{
		Modules: map[string]json.RawMessage{},
	})
	if err != nil {
		t.Fatalf("RestoreState with no key should succeed: %v", err)
	}
}
