package crime_scene

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// --- Location: Apply, cooldown path, invalid examine payload ---

func TestLocationModule_Apply_Move(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	payload, _ := json.Marshal(map[string]string{"location_id": "library"})
	event := engine.GameEvent{SessionID: playerID, Type: "location.move", Payload: payload}
	if err := m.Apply(context.Background(), event, nil); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	m.mu.RLock()
	if m.positions[playerID] != "library" {
		t.Fatalf("expected library after Apply, got %q", m.positions[playerID])
	}
	m.mu.RUnlock()
}

func TestLocationModule_Apply_NonMove_NoOp(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	event := engine.GameEvent{Type: "something.else", Payload: json.RawMessage(`{}`)}
	if err := m.Apply(context.Background(), event, nil); err != nil {
		t.Fatalf("Apply non-move should be no-op: %v", err)
	}
}

func TestLocationModule_Apply_InvalidPayload(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	event := engine.GameEvent{Type: "location.move", Payload: json.RawMessage(`{bad}`)}
	if err := m.Apply(context.Background(), event, nil); err == nil {
		t.Fatal("expected error for invalid Apply payload")
	}
}

func TestLocationModule_Validate_NonMove_NoOp(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	event := engine.GameEvent{Type: "other.event", Payload: json.RawMessage(`{}`)}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err != nil {
		t.Fatalf("Validate non-move should be no-op: %v", err)
	}
}

func TestLocationModule_Validate_InvalidPayload(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	event := engine.GameEvent{Type: "location.move", Payload: json.RawMessage(`{bad}`)}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err == nil {
		t.Fatal("expected error for invalid Validate payload")
	}
}

func TestLocationModule_Move_Cooldown(t *testing.T) {
	m := NewLocationModule()
	cfg := json.RawMessage(`{
		"locations": [
			{"id":"a","name":"A","description":""},
			{"id":"b","name":"B","description":""}
		],
		"moveCooldownSec": 10
	}`)
	if err := m.Init(context.Background(), newTestDeps(), cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()

	// First move succeeds.
	if err := m.HandleMessage(context.Background(), playerID, "move",
		json.RawMessage(`{"location_id":"a"}`)); err != nil {
		t.Fatalf("first move: %v", err)
	}

	// Second move within cooldown fails.
	if err := m.HandleMessage(context.Background(), playerID, "move",
		json.RawMessage(`{"location_id":"b"}`)); err == nil {
		t.Fatal("expected cooldown error on second move")
	}
}

func TestLocationModule_Move_CooldownExpired(t *testing.T) {
	m := NewLocationModule()
	cfg := json.RawMessage(`{
		"locations": [
			{"id":"a","name":"A","description":""},
			{"id":"b","name":"B","description":""}
		],
		"moveCooldownSec": 1
	}`)
	if err := m.Init(context.Background(), newTestDeps(), cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()

	_ = m.HandleMessage(context.Background(), playerID, "move",
		json.RawMessage(`{"location_id":"a"}`))

	// Backdate lastMove so cooldown is expired.
	m.mu.Lock()
	m.lastMove[playerID] = time.Now().Add(-2 * time.Second)
	m.mu.Unlock()

	if err := m.HandleMessage(context.Background(), playerID, "move",
		json.RawMessage(`{"location_id":"b"}`)); err != nil {
		t.Fatalf("move after cooldown expiry: %v", err)
	}
}

func TestLocationModule_HandleMove_InvalidPayload(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.HandleMessage(context.Background(), uuid.New(), "move",
		json.RawMessage(`{bad}`)); err == nil {
		t.Fatal("expected error for invalid move payload")
	}
}

func TestLocationModule_HandleExamine_InvalidPayload(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.HandleMessage(context.Background(), uuid.New(), "examine",
		json.RawMessage(`{bad}`)); err == nil {
		t.Fatal("expected error for invalid examine payload")
	}
}

func TestLocationModule_RestoreState_InvalidPlayerID(t *testing.T) {
	m := NewLocationModule()
	if err := m.Init(context.Background(), newTestDeps(), locationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	raw, _ := json.Marshal(locationState{
		Positions: map[string]string{"not-a-uuid": "hall"},
	})
	err := m.RestoreState(context.Background(), uuid.New(), engine.GameState{
		Modules: map[string]json.RawMessage{"location": raw},
	})
	if err == nil {
		t.Fatal("expected error for invalid playerID in RestoreState")
	}
}

// --- Evidence: autoDiscover, Validate, Apply, invalid payloads ---

func TestEvidenceModule_AutoDiscover(t *testing.T) {
	deps := newTestDeps()
	m := NewEvidenceModule()
	cfg := json.RawMessage(`{
		"evidence": [
			{"id":"ring","name":"Ring","locationId":"foyer","availableAtPhase":"","hidden":false}
		],
		"autoDiscover": true
	}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}

	playerID := uuid.New()
	var discovered bool
	deps.EventBus.Subscribe("evidence.discovered", func(e engine.Event) { discovered = true })

	// Simulate location.examined event.
	deps.EventBus.Publish(engine.Event{
		Type: "location.examined",
		Payload: map[string]any{
			"playerID":   playerID,
			"locationID": "foyer",
		},
	})
	// Give handler time to run.
	time.Sleep(10 * time.Millisecond)

	if !discovered {
		t.Fatal("expected auto-discovery on location.examined")
	}
}

func TestEvidenceModule_AutoDiscover_Hidden(t *testing.T) {
	deps := newTestDeps()
	m := NewEvidenceModule()
	cfg := json.RawMessage(`{
		"evidence": [
			{"id":"secret","name":"Secret","locationId":"foyer","availableAtPhase":"","hidden":true}
		],
		"autoDiscover": true
	}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}

	playerID := uuid.New()
	var discovered bool
	deps.EventBus.Subscribe("evidence.discovered", func(e engine.Event) { discovered = true })

	deps.EventBus.Publish(engine.Event{
		Type: "location.examined",
		Payload: map[string]any{
			"playerID":   playerID,
			"locationID": "foyer",
		},
	})
	time.Sleep(10 * time.Millisecond)

	if discovered {
		t.Fatal("hidden evidence should not be auto-discovered")
	}
}

func TestEvidenceModule_Validate_DiscoverKnown(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	payload, _ := json.Marshal(map[string]string{"evidence_id": "knife"})
	event := engine.GameEvent{Type: "evidence.discover", Payload: payload}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err != nil {
		t.Fatalf("Validate known evidence: %v", err)
	}
}

func TestEvidenceModule_Validate_UnknownEvidence(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	payload, _ := json.Marshal(map[string]string{"evidence_id": "unknown"})
	event := engine.GameEvent{Type: "evidence.collect", Payload: payload}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err == nil {
		t.Fatal("expected error for unknown evidence in Validate")
	}
}

func TestEvidenceModule_Validate_OtherEvent(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	event := engine.GameEvent{Type: "other.event", Payload: json.RawMessage(`{}`)}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err != nil {
		t.Fatalf("Validate other event should be no-op: %v", err)
	}
}

func TestEvidenceModule_Validate_InvalidPayload(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	event := engine.GameEvent{Type: "evidence.discover", Payload: json.RawMessage(`{bad}`)}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err == nil {
		t.Fatal("expected error for invalid Validate payload")
	}
}

func TestEvidenceModule_Apply_Discover(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	payload, _ := json.Marshal(map[string]string{"evidence_id": "knife"})
	event := engine.GameEvent{SessionID: playerID, Type: "evidence.discover", Payload: payload}
	if err := m.Apply(context.Background(), event, nil); err != nil {
		t.Fatalf("Apply discover: %v", err)
	}
	m.mu.RLock()
	found := false
	for _, id := range m.discovered[playerID] {
		if id == "knife" {
			found = true
		}
	}
	m.mu.RUnlock()
	if !found {
		t.Fatal("knife not in discovered after Apply")
	}
}

func TestEvidenceModule_Apply_Collect(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	// Pre-populate discovered so collect Apply works.
	m.mu.Lock()
	m.discovered[playerID] = []string{"knife"}
	m.mu.Unlock()

	payload, _ := json.Marshal(map[string]string{"evidence_id": "knife"})
	event := engine.GameEvent{SessionID: playerID, Type: "evidence.collect", Payload: payload}
	if err := m.Apply(context.Background(), event, nil); err != nil {
		t.Fatalf("Apply collect: %v", err)
	}
	m.mu.RLock()
	found := false
	for _, id := range m.collected[playerID] {
		if id == "knife" {
			found = true
		}
	}
	m.mu.RUnlock()
	if !found {
		t.Fatal("knife not in collected after Apply")
	}
}

func TestEvidenceModule_Apply_InvalidPayload(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	event := engine.GameEvent{Type: "evidence.discover", Payload: json.RawMessage(`{bad}`)}
	if err := m.Apply(context.Background(), event, nil); err == nil {
		t.Fatal("expected error for invalid Apply payload")
	}
}

func TestEvidenceModule_HandleDiscover_InvalidPayload(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.HandleMessage(context.Background(), uuid.New(), "discover",
		json.RawMessage(`{bad}`)); err == nil {
		t.Fatal("expected error for invalid discover payload")
	}
}

func TestEvidenceModule_HandleCollect_InvalidPayload(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.HandleMessage(context.Background(), uuid.New(), "collect",
		json.RawMessage(`{bad}`)); err == nil {
		t.Fatal("expected error for invalid collect payload")
	}
}

func TestEvidenceModule_HandleDiscover_UnknownEvidence(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.HandleMessage(context.Background(), uuid.New(), "discover",
		json.RawMessage(`{"evidence_id":"nonexistent"}`)); err == nil {
		t.Fatal("expected error for unknown evidence")
	}
}

func TestEvidenceModule_HandleCollect_UnknownEvidence(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.HandleMessage(context.Background(), uuid.New(), "collect",
		json.RawMessage(`{"evidence_id":"nonexistent"}`)); err == nil {
		t.Fatal("expected error for unknown evidence in collect")
	}
}

func TestEvidenceModule_RestoreState_NoKey(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.RestoreState(context.Background(), uuid.New(), engine.GameState{
		Modules: map[string]json.RawMessage{},
	}); err != nil {
		t.Fatalf("RestoreState no key: %v", err)
	}
}

func TestEvidenceModule_RestoreState_InvalidPlayerID(t *testing.T) {
	m := NewEvidenceModule()
	if err := m.Init(context.Background(), newTestDeps(), evidenceCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	raw, _ := json.Marshal(evidenceState{
		Discovered: map[string][]string{"not-a-uuid": {"knife"}},
	})
	if err := m.RestoreState(context.Background(), uuid.New(), engine.GameState{
		Modules: map[string]json.RawMessage{"evidence": raw},
	}); err == nil {
		t.Fatal("expected error for invalid playerID in RestoreState")
	}
}
