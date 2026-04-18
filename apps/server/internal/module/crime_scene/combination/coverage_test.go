package combination

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// --- Combination: Validate, Apply, RestoreState errors ---

func TestCombinationModule_Validate_Combine(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	payload, _ := json.Marshal(map[string]any{"evidence_ids": []string{"knife", "glove"}})
	event := engine.GameEvent{Type: "combination.combine", Payload: payload}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err != nil {
		t.Fatalf("Validate valid combo: %v", err)
	}
}

func TestCombinationModule_Validate_NoMatch(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	payload, _ := json.Marshal(map[string]any{"evidence_ids": []string{"x", "y"}})
	event := engine.GameEvent{Type: "combination.combine", Payload: payload}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err == nil {
		t.Fatal("expected error for unmatched combo in Validate")
	}
}

func TestCombinationModule_Validate_OtherEvent(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	event := engine.GameEvent{Type: "other.event", Payload: json.RawMessage(`{}`)}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err != nil {
		t.Fatalf("Validate other event should be no-op: %v", err)
	}
}

func TestCombinationModule_Validate_InvalidPayload(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	event := engine.GameEvent{Type: "combination.combine", Payload: json.RawMessage(`{bad}`)}
	if err := m.Validate(context.Background(), event, engine.GameState{}); err == nil {
		t.Fatal("expected error for invalid Validate payload")
	}
}

func TestCombinationModule_Apply_Combine(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	payload, _ := json.Marshal(map[string]any{"evidence_ids": []string{"knife", "glove"}})
	event := engine.GameEvent{SessionID: playerID, Type: "combination.combine", Payload: payload}
	if err := m.Apply(context.Background(), event, nil); err != nil {
		t.Fatalf("Apply combine: %v", err)
	}
	m.mu.RLock()
	found := false
	for _, id := range m.completed[playerID] {
		if id == "combo1" {
			found = true
		}
	}
	m.mu.RUnlock()
	if !found {
		t.Fatal("combo1 not in completed after Apply")
	}
}

func TestCombinationModule_Apply_OtherEvent_NoOp(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	event := engine.GameEvent{Type: "other.event", Payload: json.RawMessage(`{}`)}
	if err := m.Apply(context.Background(), event, nil); err != nil {
		t.Fatalf("Apply other event should be no-op: %v", err)
	}
}

func TestCombinationModule_Apply_InvalidPayload(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	event := engine.GameEvent{Type: "combination.combine", Payload: json.RawMessage(`{bad}`)}
	if err := m.Apply(context.Background(), event, nil); err == nil {
		t.Fatal("expected error for invalid Apply payload")
	}
}

func TestCombinationModule_RestoreState_NoKey(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.RestoreState(context.Background(), uuid.New(), engine.GameState{
		Modules: map[string]json.RawMessage{},
	}); err != nil {
		t.Fatalf("RestoreState no key: %v", err)
	}
}

func TestCombinationModule_RestoreState_InvalidPlayerID(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	raw, _ := json.Marshal(combinationState{
		Completed: map[string][]string{"not-a-uuid": {"combo1"}},
	})
	if err := m.RestoreState(context.Background(), uuid.New(), engine.GameState{
		Modules: map[string]json.RawMessage{"combination": raw},
	}); err == nil {
		t.Fatal("expected error for invalid playerID in RestoreState completed")
	}
}

func TestCombinationModule_HandleCombine_EmptyIDs(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.HandleMessage(context.Background(), uuid.New(), "combine",
		json.RawMessage(`{"evidence_ids":[]}`)); err == nil {
		t.Fatal("expected error for empty evidence_ids")
	}
}

func TestCombinationModule_HandleCombine_InvalidPayload(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.HandleMessage(context.Background(), uuid.New(), "combine",
		json.RawMessage(`{bad}`)); err == nil {
		t.Fatal("expected error for invalid combine payload")
	}
}
