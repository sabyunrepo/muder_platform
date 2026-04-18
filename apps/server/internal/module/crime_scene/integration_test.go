package crime_scene

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/mmp-platform/server/internal/module/crime_scene/combination"
)

// TestIntegration_FullFlow exercises all three modules together:
// move to location → examine → auto-discover (manual here) → collect → combine → win.
func TestIntegration_FullFlow(t *testing.T) {
	ctx := context.Background()
	deps := newTestDeps()

	// --- Init Location ---
	loc := NewLocationModule()
	locCfg := json.RawMessage(`{
		"locations": [
			{"id":"study","name":"Study","description":"The study"},
			{"id":"kitchen","name":"Kitchen","description":"The kitchen"}
		],
		"startingLocation": "study"
	}`)
	if err := loc.Init(ctx, deps, locCfg); err != nil {
		t.Fatalf("location Init: %v", err)
	}

	// --- Init Evidence ---
	ev := NewEvidenceModule()
	evCfg := json.RawMessage(`{
		"evidence": [
			{"id":"poison","name":"Poison","locationId":"kitchen","availableAtPhase":"","hidden":false},
			{"id":"diary","name":"Diary","locationId":"study","availableAtPhase":"","hidden":false}
		],
		"autoDiscover": false
	}`)
	if err := ev.Init(ctx, deps, evCfg); err != nil {
		t.Fatalf("evidence Init: %v", err)
	}

	// --- Init Combination ---
	combo := combination.NewCombinationModule()
	comboCfg := json.RawMessage(`{
		"combinations": [
			{
				"id": "poison_diary",
				"inputIds": ["poison","diary"],
				"outputClueId": "murder_method",
				"description": "Poison + Diary = murder method"
			}
		],
		"winCombination": ["poison","diary"]
	}`)
	if err := combo.Init(ctx, deps, comboCfg); err != nil {
		t.Fatalf("combination Init: %v", err)
	}

	playerID := uuid.New()

	// Track events.
	events := make(map[string]int)
	for _, evType := range []string{
		"location.moved", "location.examined",
		"evidence.discovered", "evidence.collected",
		"combination.completed", "combination.clue_unlocked",
	} {
		et := evType
		deps.EventBus.Subscribe(et, func(e engine.Event) { events[et]++ })
	}

	// Step 1: Move to kitchen.
	if err := loc.HandleMessage(ctx, playerID, "move",
		json.RawMessage(`{"location_id":"kitchen"}`)); err != nil {
		t.Fatalf("move to kitchen: %v", err)
	}
	if events["location.moved"] != 1 {
		t.Fatalf("expected 1 location.moved, got %d", events["location.moved"])
	}

	// Step 2: Examine kitchen.
	if err := loc.HandleMessage(ctx, playerID, "examine",
		json.RawMessage(`{"location_id":"kitchen"}`)); err != nil {
		t.Fatalf("examine kitchen: %v", err)
	}
	if events["location.examined"] != 1 {
		t.Fatalf("expected 1 location.examined, got %d", events["location.examined"])
	}

	// Step 3: Discover poison.
	if err := ev.HandleMessage(ctx, playerID, "discover",
		json.RawMessage(`{"evidence_id":"poison","location_id":"kitchen"}`)); err != nil {
		t.Fatalf("discover poison: %v", err)
	}

	// Step 4: Discover diary.
	if err := ev.HandleMessage(ctx, playerID, "discover",
		json.RawMessage(`{"evidence_id":"diary","location_id":"study"}`)); err != nil {
		t.Fatalf("discover diary: %v", err)
	}
	if events["evidence.discovered"] != 2 {
		t.Fatalf("expected 2 evidence.discovered, got %d", events["evidence.discovered"])
	}

	// Step 5: Collect both.
	if err := ev.HandleMessage(ctx, playerID, "collect",
		json.RawMessage(`{"evidence_id":"poison"}`)); err != nil {
		t.Fatalf("collect poison: %v", err)
	}
	if err := ev.HandleMessage(ctx, playerID, "collect",
		json.RawMessage(`{"evidence_id":"diary"}`)); err != nil {
		t.Fatalf("collect diary: %v", err)
	}
	if events["evidence.collected"] != 2 {
		t.Fatalf("expected 2 evidence.collected, got %d", events["evidence.collected"])
	}

	// Mirror collected into combination module (normally done via eventbus subscription in combo.Init).
	combo.SeedCollectedForTest(playerID, "poison", "diary")

	// Step 6: Combine evidence.
	if err := combo.HandleMessage(ctx, playerID, "combine",
		json.RawMessage(`{"evidence_ids":["poison","diary"]}`)); err != nil {
		t.Fatalf("combine: %v", err)
	}
	if events["combination.completed"] != 1 {
		t.Fatalf("expected 1 combination.completed, got %d", events["combination.completed"])
	}
	if events["combination.clue_unlocked"] != 1 {
		t.Fatalf("expected 1 combination.clue_unlocked, got %d", events["combination.clue_unlocked"])
	}

	// Step 7: Check win.
	result, err := combo.CheckWin(ctx, engine.GameState{})
	if err != nil {
		t.Fatalf("CheckWin: %v", err)
	}
	if !result.Won {
		t.Fatal("expected win after collecting all required evidence")
	}
	if len(result.WinnerIDs) == 0 || result.WinnerIDs[0] != playerID {
		t.Fatalf("expected playerID as winner, got %v", result.WinnerIDs)
	}

	// Step 8: Cleanup all modules.
	if err := loc.Cleanup(ctx); err != nil {
		t.Fatalf("location Cleanup: %v", err)
	}
	if err := ev.Cleanup(ctx); err != nil {
		t.Fatalf("evidence Cleanup: %v", err)
	}
	if err := combo.Cleanup(ctx); err != nil {
		t.Fatalf("combination Cleanup: %v", err)
	}
}

// TestIntegration_PhaseUnlock tests that OnPhaseEnter unlocks phase-gated evidence.
func TestIntegration_PhaseUnlock(t *testing.T) {
	ctx := context.Background()
	deps := newTestDeps()

	ev := NewEvidenceModule()
	if err := ev.Init(ctx, deps, json.RawMessage(`{
		"evidence": [
			{"id":"secret_doc","name":"Secret Doc","locationId":"vault","availableAtPhase":"revelation","hidden":false}
		],
		"autoDiscover": false
	}`)); err != nil {
		t.Fatalf("Init: %v", err)
	}

	playerID := uuid.New()

	// Before phase unlock, discover should fail.
	err := ev.HandleMessage(ctx, playerID, "discover",
		json.RawMessage(`{"evidence_id":"secret_doc"}`))
	if err == nil {
		t.Fatal("expected error before phase unlock")
	}

	// Trigger phase unlock.
	if err := ev.OnPhaseEnter(ctx, "revelation"); err != nil {
		t.Fatalf("OnPhaseEnter: %v", err)
	}

	// After phase unlock, discover should succeed.
	if err := ev.HandleMessage(ctx, playerID, "discover",
		json.RawMessage(`{"evidence_id":"secret_doc"}`)); err != nil {
		t.Fatalf("discover after phase unlock: %v", err)
	}
}

// TestIntegration_SaveRestore verifies state round-trips for all three modules.
func TestIntegration_SaveRestore(t *testing.T) {
	ctx := context.Background()
	deps := newTestDeps()

	loc := NewLocationModule()
	if err := loc.Init(ctx, deps, json.RawMessage(`{
		"locations": [{"id":"room1","name":"Room1","description":""}]
	}`)); err != nil {
		t.Fatalf("loc Init: %v", err)
	}

	ev := NewEvidenceModule()
	if err := ev.Init(ctx, deps, json.RawMessage(`{
		"evidence": [{"id":"clue1","name":"Clue1","locationId":"room1","availableAtPhase":"","hidden":false}],
		"autoDiscover": false
	}`)); err != nil {
		t.Fatalf("ev Init: %v", err)
	}

	combo := combination.NewCombinationModule()
	if err := combo.Init(ctx, deps, json.RawMessage(`{
		"combinations": [{"id":"c1","inputIds":["clue1"],"outputClueId":"result1","description":""}],
		"winCombination": ["clue1"]
	}`)); err != nil {
		t.Fatalf("combo Init: %v", err)
	}

	playerID := uuid.New()

	// Perform some actions.
	_ = loc.HandleMessage(ctx, playerID, "move", json.RawMessage(`{"location_id":"room1"}`))
	_ = ev.HandleMessage(ctx, playerID, "discover", json.RawMessage(`{"evidence_id":"clue1"}`))
	_ = ev.HandleMessage(ctx, playerID, "collect", json.RawMessage(`{"evidence_id":"clue1"}`))
	combo.SeedCollectedForTest(playerID, "clue1")
	_ = combo.HandleMessage(ctx, playerID, "combine", json.RawMessage(`{"evidence_ids":["clue1"]}`))

	// Save all.
	locGS, err := loc.SaveState(ctx)
	if err != nil {
		t.Fatalf("loc SaveState: %v", err)
	}
	evGS, err := ev.SaveState(ctx)
	if err != nil {
		t.Fatalf("ev SaveState: %v", err)
	}
	comboGS, err := combo.SaveState(ctx)
	if err != nil {
		t.Fatalf("combo SaveState: %v", err)
	}

	// Restore into fresh modules.
	loc2 := NewLocationModule()
	_ = loc2.Init(ctx, newTestDeps(), json.RawMessage(`{"locations":[{"id":"room1","name":"Room1","description":""}]}`))
	if err := loc2.RestoreState(ctx, uuid.New(), locGS); err != nil {
		t.Fatalf("loc RestoreState: %v", err)
	}
	loc2.mu.RLock()
	if loc2.positions[playerID] != "room1" {
		t.Fatalf("expected room1, got %q", loc2.positions[playerID])
	}
	loc2.mu.RUnlock()

	ev2 := NewEvidenceModule()
	_ = ev2.Init(ctx, newTestDeps(), json.RawMessage(`{"evidence":[{"id":"clue1","name":"Clue1","locationId":"room1","availableAtPhase":"","hidden":false}]}`))
	if err := ev2.RestoreState(ctx, uuid.New(), evGS); err != nil {
		t.Fatalf("ev RestoreState: %v", err)
	}

	combo2 := combination.NewCombinationModule()
	_ = combo2.Init(ctx, newTestDeps(), json.RawMessage(`{
		"combinations": [{"id":"c1","inputIds":["clue1"],"outputClueId":"result1","description":""}],
		"winCombination": ["clue1"]
	}`))
	if err := combo2.RestoreState(ctx, uuid.New(), comboGS); err != nil {
		t.Fatalf("combo RestoreState: %v", err)
	}

	result, err := combo2.CheckWin(ctx, engine.GameState{})
	if err != nil {
		t.Fatalf("CheckWin after restore: %v", err)
	}
	if !result.Won {
		t.Fatal("expected win after restore")
	}
}
