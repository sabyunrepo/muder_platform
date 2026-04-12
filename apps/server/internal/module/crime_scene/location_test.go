package crime_scene

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func newTestDeps() engine.ModuleDeps {
	return engine.ModuleDeps{
		SessionID: uuid.New(),
		EventBus:  engine.NewEventBus(nil),
		Logger:    nil,
	}
}

func locationCfg() json.RawMessage {
	return json.RawMessage(`{
		"locations": [
			{"id":"hall","name":"Hall","description":"Entry hall"},
			{"id":"library","name":"Library","description":"Book room"}
		],
		"startingLocation": "hall",
		"moveCooldownSec": 0
	}`)
}

func TestLocationModule_Name(t *testing.T) {
	m := NewLocationModule()
	if m.Name() != "location" {
		t.Fatalf("expected %q, got %q", "location", m.Name())
	}
}

func TestLocationModule_Init_Defaults(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), nil); err != nil {
		t.Fatalf("Init with nil config: %v", err)
	}
}

func TestLocationModule_Init_ValidConfig(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	m.mu.RLock()
	if len(m.locationSet) != 2 {
		t.Fatalf("expected 2 locations, got %d", len(m.locationSet))
	}
	m.mu.RUnlock()
}

func TestLocationModule_Init_InvalidConfig(t *testing.T) {
	m := NewLocationModule()
	err := m.Init(context.Background(), newTestDeps(), json.RawMessage(`{bad}`))
	if err == nil {
		t.Fatal("expected error for bad JSON")
	}
}

func TestLocationModule_Init_MissingStartingLoc(t *testing.T) {
	m := NewLocationModule()
	err := m.Init(context.Background(), newTestDeps(), json.RawMessage(`{
		"locations":[{"id":"hall","name":"Hall"}],
		"startingLocation":"nowhere"
	}`))
	if err == nil {
		t.Fatal("expected error for missing startingLocation")
	}
}

func TestLocationModule_HandleMessage_Move(t *testing.T) {
	m := NewLocationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}

	playerID := uuid.New()
	var moved bool
	deps.EventBus.Subscribe("location.moved", func(e engine.Event) { moved = true })

	err := m.HandleMessage(context.Background(), playerID,
		"move", json.RawMessage(`{"location_id":"library"}`))
	if err != nil {
		t.Fatalf("move: %v", err)
	}
	if !moved {
		t.Fatal("expected location.moved event")
	}

	m.mu.RLock()
	if m.positions[playerID] != "library" {
		t.Fatalf("expected position library, got %q", m.positions[playerID])
	}
	m.mu.RUnlock()
}

func TestLocationModule_HandleMessage_Move_UnknownLocation(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	err := m.HandleMessage(context.Background(), uuid.New(),
		"move", json.RawMessage(`{"location_id":"nowhere"}`))
	if err == nil {
		t.Fatal("expected error for unknown location")
	}
}

func TestLocationModule_HandleMessage_Examine(t *testing.T) {
	m := NewLocationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}

	playerID := uuid.New()
	var examined bool
	deps.EventBus.Subscribe("location.examined", func(e engine.Event) { examined = true })

	err := m.HandleMessage(context.Background(), playerID,
		"examine", json.RawMessage(`{"location_id":"hall"}`))
	if err != nil {
		t.Fatalf("examine: %v", err)
	}
	if !examined {
		t.Fatal("expected location.examined event")
	}
}

func TestLocationModule_HandleMessage_Examine_UnknownLocation(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	err := m.HandleMessage(context.Background(), uuid.New(),
		"examine", json.RawMessage(`{"location_id":"nowhere"}`))
	if err == nil {
		t.Fatal("expected error for unknown location")
	}
}

func TestLocationModule_HandleMessage_UnknownType(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestLocationModule_BuildState(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var s locationState
	if err := json.Unmarshal(data, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if s.Positions == nil {
		t.Fatal("expected non-nil positions map")
	}
}

func TestLocationModule_SaveRestoreState(t *testing.T) {
	m := NewLocationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}

	playerID := uuid.New()
	if err := m.HandleMessage(context.Background(), playerID,
		"move", json.RawMessage(`{"location_id":"library"}`)); err != nil {
		t.Fatalf("move: %v", err)
	}

	gs, err := m.SaveState(context.Background())
	if err != nil {
		t.Fatalf("SaveState: %v", err)
	}
	if _, ok := gs.Modules["location"]; !ok {
		t.Fatal("expected location key in saved state")
	}

	m2 := NewLocationModule()
	if err := m2.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init m2: %v", err)
	}
	if err := m2.RestoreState(context.Background(), uuid.New(), gs); err != nil {
		t.Fatalf("RestoreState: %v", err)
	}

	m2.mu.RLock()
	if m2.positions[playerID] != "library" {
		t.Fatalf("expected library after restore, got %q", m2.positions[playerID])
	}
	m2.mu.RUnlock()
}

func TestLocationModule_RestoreState_NoKey(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	err := m.RestoreState(context.Background(), uuid.New(), engine.GameState{
		Modules: map[string]json.RawMessage{},
	})
	if err != nil {
		t.Fatalf("RestoreState with no key: %v", err)
	}
}

func TestLocationModule_GetRules(t *testing.T) {
	m := NewLocationModule()
	rules := m.GetRules()
	if len(rules) == 0 {
		t.Fatal("expected at least one rule")
	}
	for _, r := range rules {
		if r.ID == "" {
			t.Fatal("rule missing ID")
		}
		if r.Logic == nil {
			t.Fatal("rule missing Logic")
		}
	}
}

func TestLocationModule_Validate(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}

	payload, _ := json.Marshal(map[string]string{"location_id": "hall"})
	event := engine.GameEvent{Type: "location.move", Payload: payload}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err != nil {
		t.Fatalf("Validate known location: %v", err)
	}

	bad, _ := json.Marshal(map[string]string{"location_id": "nowhere"})
	badEvent := engine.GameEvent{Type: "location.move", Payload: bad}
	if err := m.Validate(context.Background(), badEvent, engine.GameState{}); err == nil {
		t.Fatal("expected error for unknown location in Validate")
	}
}

func TestLocationModule_Cleanup(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.Cleanup(context.Background()); err != nil {
		t.Fatalf("Cleanup: %v", err)
	}
	m.mu.RLock()
	if m.positions != nil {
		t.Fatal("expected nil positions after cleanup")
	}
	m.mu.RUnlock()
}
