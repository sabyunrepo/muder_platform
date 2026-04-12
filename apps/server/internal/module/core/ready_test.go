package core

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestReadyModule_Name(t *testing.T) {
	m := NewReadyModule()
	if m.Name() != "ready" {
		t.Fatalf("expected %q, got %q", "ready", m.Name())
	}
}

func TestReadyModule_Init(t *testing.T) {
	tests := []struct {
		name         string
		config       json.RawMessage
		wantTotal    int
	}{
		{
			name:      "nil config",
			config:    nil,
			wantTotal: 0,
		},
		{
			name:      "with totalPlayers",
			config:    json.RawMessage(`{"totalPlayers": 4}`),
			wantTotal: 4,
		},
		{
			name:      "invalid config ignored",
			config:    json.RawMessage(`{invalid}`),
			wantTotal: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewReadyModule()
			err := m.Init(context.Background(), newTestDeps(), tt.config)
			if err != nil {
				t.Fatalf("Init failed: %v", err)
			}
			if m.totalPlayers != tt.wantTotal {
				t.Fatalf("totalPlayers = %d, want %d", m.totalPlayers, tt.wantTotal)
			}
		})
	}
}

func TestReadyModule_Toggle(t *testing.T) {
	m := NewReadyModule()
	cfg, _ := json.Marshal(readyConfig{TotalPlayers: 2})
	_ = m.Init(context.Background(), newTestDeps(), cfg)

	p1 := uuid.New()

	// Toggle on.
	err := m.HandleMessage(context.Background(), p1, "ready:toggle", nil)
	if err != nil {
		t.Fatalf("toggle failed: %v", err)
	}
	m.mu.RLock()
	if !m.readyPlayers[p1] {
		t.Fatal("expected player to be ready")
	}
	m.mu.RUnlock()

	// Toggle off.
	err = m.HandleMessage(context.Background(), p1, "ready:toggle", nil)
	if err != nil {
		t.Fatalf("toggle off failed: %v", err)
	}
	m.mu.RLock()
	if m.readyPlayers[p1] {
		t.Fatal("expected player to be not ready")
	}
	m.mu.RUnlock()
}

func TestReadyModule_AllReady(t *testing.T) {
	deps := newTestDeps()
	m := NewReadyModule()
	cfg, _ := json.Marshal(readyConfig{TotalPlayers: 2})
	_ = m.Init(context.Background(), deps, cfg)

	var allReadyFired bool
	deps.EventBus.Subscribe("ready.all_ready", func(e engine.Event) {
		allReadyFired = true
	})

	p1, p2 := uuid.New(), uuid.New()
	_ = m.HandleMessage(context.Background(), p1, "ready:toggle", nil)
	if allReadyFired {
		t.Fatal("all_ready fired too early")
	}

	_ = m.HandleMessage(context.Background(), p2, "ready:toggle", nil)
	if !allReadyFired {
		t.Fatal("all_ready not fired when all players ready")
	}
}

func TestReadyModule_StatusChangedEvent(t *testing.T) {
	deps := newTestDeps()
	m := NewReadyModule()
	_ = m.Init(context.Background(), deps, nil)

	var received bool
	deps.EventBus.Subscribe("ready.status_changed", func(e engine.Event) {
		received = true
	})

	_ = m.HandleMessage(context.Background(), uuid.New(), "ready:toggle", nil)
	if !received {
		t.Fatal("ready.status_changed event not published")
	}
}

func TestReadyModule_BuildState(t *testing.T) {
	m := NewReadyModule()
	cfg, _ := json.Marshal(readyConfig{TotalPlayers: 2})
	_ = m.Init(context.Background(), newTestDeps(), cfg)

	p1 := uuid.New()
	_ = m.HandleMessage(context.Background(), p1, "ready:toggle", nil)

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state readyState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if !state.Players[p1] {
		t.Fatal("expected player to be ready in state")
	}
	if state.AllReady {
		t.Fatal("expected allReady to be false (only 1 of 2)")
	}
}

func TestReadyModule_UnknownMessage(t *testing.T) {
	m := NewReadyModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestReadyModule_Cleanup(t *testing.T) {
	m := NewReadyModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.readyPlayers != nil {
		t.Fatal("expected readyPlayers to be nil after cleanup")
	}
}

func TestReadyModule_OnPhaseEnter(t *testing.T) {
	m := NewReadyModule()
	_ = m.Init(context.Background(), newTestDeps(), json.RawMessage(`{"totalPlayers":3}`))
	pid := uuid.New()
	_ = m.HandleMessage(context.Background(), pid, "ready:toggle", nil)

	if err := m.OnPhaseEnter(context.Background(), engine.Phase("discussion")); err != nil {
		t.Fatalf("OnPhaseEnter: %v", err)
	}
	m.mu.RLock()
	if len(m.readyPlayers) != 0 {
		t.Error("expected readyPlayers reset after OnPhaseEnter")
	}
	m.mu.RUnlock()
}

func TestReadyModule_OnPhaseExit(t *testing.T) {
	m := NewReadyModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	if err := m.OnPhaseExit(context.Background(), engine.Phase("lobby")); err != nil {
		t.Fatalf("OnPhaseExit: %v", err)
	}
}

func TestReadyModule_Validate(t *testing.T) {
	m := NewReadyModule()
	if err := m.Validate(context.Background(), engine.GameEvent{Type: "ready:toggle"}, engine.GameState{}); err != nil {
		t.Fatalf("Validate ready:toggle: %v", err)
	}
	if err := m.Validate(context.Background(), engine.GameEvent{Type: "unknown"}, engine.GameState{}); err == nil {
		t.Error("expected error for unknown event type")
	}
}

func TestReadyModule_Apply(t *testing.T) {
	m := NewReadyModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	pid := uuid.New()
	state := engine.GameState{Modules: make(map[string]json.RawMessage)}
	event := engine.GameEvent{
		Type:    "ready:toggle",
		Payload: json.RawMessage(`{"playerId":"` + pid.String() + `"}`),
	}
	if err := m.Apply(context.Background(), event, &state); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if _, ok := state.Modules["ready"]; !ok {
		t.Error("expected ready state in GameState.Modules")
	}
}
