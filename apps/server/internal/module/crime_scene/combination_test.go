package crime_scene

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func combinationCfg() json.RawMessage {
	return json.RawMessage(`{
		"combinations": [
			{
				"id": "combo1",
				"inputIds": ["knife","glove"],
				"outputClueId": "weapon_set",
				"description": "Knife + Glove"
			},
			{
				"id": "combo2",
				"inputIds": ["note"],
				"outputClueId": "motive",
				"description": "Note reveals motive"
			}
		],
		"winCombination": ["knife","glove","note"]
	}`)
}

func TestCombinationModule_Name(t *testing.T) {
	m := NewCombinationModule()
	if m.Name() != "combination" {
		t.Fatalf("expected %q, got %q", "combination", m.Name())
	}
}

func TestCombinationModule_Init_ValidConfig(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	m.mu.RLock()
	if len(m.comboByID) != 2 {
		t.Fatalf("expected 2 combinations, got %d", len(m.comboByID))
	}
	m.mu.RUnlock()
}

func TestCombinationModule_Init_InvalidConfig(t *testing.T) {
	m := NewCombinationModule()
	err := m.Init(context.Background(), newTestDeps(), json.RawMessage(`{bad}`))
	if err == nil {
		t.Fatal("expected error for bad JSON")
	}
}

func TestCombinationModule_Init_NilConfig(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), nil); err != nil {
		t.Fatalf("Init with nil config: %v", err)
	}
}

func TestCombinationModule_HandleMessage_Combine(t *testing.T) {
	m := NewCombinationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}

	playerID := uuid.New()
	// Give player the required evidence via eventbus.
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true, "glove": true}
	m.mu.Unlock()

	var completedEvt, clueEvt bool
	deps.EventBus.Subscribe("combination.completed", func(e engine.Event) { completedEvt = true })
	deps.EventBus.Subscribe("combination.clue_unlocked", func(e engine.Event) { clueEvt = true })

	err := m.HandleMessage(context.Background(), playerID,
		"combine", json.RawMessage(`{"evidence_ids":["knife","glove"]}`))
	if err != nil {
		t.Fatalf("combine: %v", err)
	}
	if !completedEvt {
		t.Fatal("expected combination.completed event")
	}
	if !clueEvt {
		t.Fatal("expected combination.clue_unlocked event")
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
		t.Fatal("combo1 not in completed list")
	}
}

func TestCombinationModule_HandleMessage_Combine_MissingEvidence(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	// player has only knife, not glove
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true}
	m.mu.Unlock()

	err := m.HandleMessage(context.Background(), playerID,
		"combine", json.RawMessage(`{"evidence_ids":["knife","glove"]}`))
	if err == nil {
		t.Fatal("expected error: missing evidence glove")
	}
}

func TestCombinationModule_HandleMessage_Combine_NoMatch(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	err := m.HandleMessage(context.Background(), uuid.New(),
		"combine", json.RawMessage(`{"evidence_ids":["unknown1","unknown2"]}`))
	if err == nil {
		t.Fatal("expected error: no matching combination")
	}
}

func TestCombinationModule_HandleMessage_Combine_Idempotent(t *testing.T) {
	m := NewCombinationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true, "glove": true}
	m.mu.Unlock()

	p := json.RawMessage(`{"evidence_ids":["knife","glove"]}`)
	if err := m.HandleMessage(context.Background(), playerID, "combine", p); err != nil {
		t.Fatalf("first combine: %v", err)
	}
	if err := m.HandleMessage(context.Background(), playerID, "combine", p); err != nil {
		t.Fatalf("second combine (idempotent): %v", err)
	}

	m.mu.RLock()
	count := 0
	for _, id := range m.completed[playerID] {
		if id == "combo1" {
			count++
		}
	}
	m.mu.RUnlock()
	if count != 1 {
		t.Fatalf("expected exactly 1 combo1 completion, got %d", count)
	}
}

func TestCombinationModule_HandleMessage_UnknownType(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestCombinationModule_CheckWin_NotMet(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	result, err := m.CheckWin(context.Background(), engine.GameState{})
	if err != nil {
		t.Fatalf("CheckWin: %v", err)
	}
	if result.Won {
		t.Fatal("expected not won initially")
	}
}

func TestCombinationModule_CheckWin_Met(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true, "glove": true, "note": true}
	m.mu.Unlock()

	result, err := m.CheckWin(context.Background(), engine.GameState{})
	if err != nil {
		t.Fatalf("CheckWin: %v", err)
	}
	if !result.Won {
		t.Fatal("expected win when all required evidence collected")
	}
	if len(result.WinnerIDs) == 0 || result.WinnerIDs[0] != playerID {
		t.Fatalf("expected winner to be playerID, got %v", result.WinnerIDs)
	}
}

func TestCombinationModule_CheckWin_NoWinCombo(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), json.RawMessage(`{
		"combinations": [{"id":"c1","inputIds":["a"],"outputClueId":"b","description":""}]
	}`)); err != nil {
		t.Fatalf("Init: %v", err)
	}
	result, err := m.CheckWin(context.Background(), engine.GameState{})
	if err != nil {
		t.Fatalf("CheckWin: %v", err)
	}
	if result.Won {
		t.Fatal("expected no win without winCombination configured")
	}
}

func TestCombinationModule_GetRules(t *testing.T) {
	m := NewCombinationModule()
	rules := m.GetRules()
	if len(rules) == 0 {
		t.Fatal("expected at least one rule")
	}
	for _, r := range rules {
		if r.ID == "" {
			t.Fatal("rule missing ID")
		}
	}
}

func TestCombinationModule_SaveRestoreState(t *testing.T) {
	m := NewCombinationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true, "glove": true}
	m.mu.Unlock()
	_ = m.HandleMessage(context.Background(), playerID,
		"combine", json.RawMessage(`{"evidence_ids":["knife","glove"]}`))

	gs, err := m.SaveState(context.Background())
	if err != nil {
		t.Fatalf("SaveState: %v", err)
	}
	if _, ok := gs.Modules["combination"]; !ok {
		t.Fatal("expected combination key in saved state")
	}

	m2 := NewCombinationModule()
	if err := m2.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init m2: %v", err)
	}
	if err := m2.RestoreState(context.Background(), uuid.New(), gs); err != nil {
		t.Fatalf("RestoreState: %v", err)
	}

	m2.mu.RLock()
	found := false
	for _, id := range m2.completed[playerID] {
		if id == "combo1" {
			found = true
		}
	}
	m2.mu.RUnlock()
	if !found {
		t.Fatal("combo1 not in completed after restore")
	}
}

func TestCombinationModule_BuildState(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var s combinationState
	if err := json.Unmarshal(data, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
}

func TestCombinationModule_Cleanup(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.Cleanup(context.Background()); err != nil {
		t.Fatalf("Cleanup: %v", err)
	}
	m.mu.RLock()
	if m.comboByID != nil {
		t.Fatal("expected nil comboByID after cleanup")
	}
	m.mu.RUnlock()
}
