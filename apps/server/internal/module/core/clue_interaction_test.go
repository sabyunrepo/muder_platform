package core

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestClueInteractionModule_Name(t *testing.T) {
	m := NewClueInteractionModule()
	if m.Name() != "clue_interaction" {
		t.Fatalf("expected %q, got %q", "clue_interaction", m.Name())
	}
}

func TestClueInteractionModule_Init(t *testing.T) {
	tests := []struct {
		name       string
		config     json.RawMessage
		wantLimit  int
		wantLevel  int
		wantPolicy string
	}{
		{
			name:       "defaults with nil config",
			config:     nil,
			wantLimit:  5,
			wantLevel:  1,
			wantPolicy: "exclusive",
		},
		{
			name:       "custom config",
			config:     json.RawMessage(`{"drawLimit":10,"initialClueLevel":3,"duplicatePolicy":"shared"}`),
			wantLimit:  10,
			wantLevel:  3,
			wantPolicy: "shared",
		},
		{
			name:       "partial config uses defaults for zero values",
			config:     json.RawMessage(`{"drawLimit":7}`),
			wantLimit:  7,
			wantLevel:  1,
			wantPolicy: "exclusive",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewClueInteractionModule()
			err := m.Init(context.Background(), newTestDeps(), tt.config)
			if err != nil {
				t.Fatalf("Init failed: %v", err)
			}
			if m.config.DrawLimit != tt.wantLimit {
				t.Fatalf("drawLimit = %d, want %d", m.config.DrawLimit, tt.wantLimit)
			}
			if m.currentClueLevel != tt.wantLevel {
				t.Fatalf("currentClueLevel = %d, want %d", m.currentClueLevel, tt.wantLevel)
			}
			if m.config.DuplicatePolicy != tt.wantPolicy {
				t.Fatalf("duplicatePolicy = %q, want %q", m.config.DuplicatePolicy, tt.wantPolicy)
			}
		})
	}
}

func TestClueInteractionModule_InitInvalidConfig(t *testing.T) {
	m := NewClueInteractionModule()
	err := m.Init(context.Background(), newTestDeps(), json.RawMessage(`{invalid}`))
	if err == nil {
		t.Fatal("expected error for invalid config JSON")
	}
}

func TestClueInteractionModule_DrawClue(t *testing.T) {
	deps := newTestDeps()
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), deps, nil)

	var eventFired bool
	deps.EventBus.Subscribe("clue.acquired", func(e engine.Event) { eventFired = true })

	playerID := uuid.New()
	payload, _ := json.Marshal(drawCluePayload{LocationID: "kitchen"})

	err := m.HandleMessage(context.Background(), playerID, "draw_clue", payload)
	if err != nil {
		t.Fatalf("draw_clue failed: %v", err)
	}
	if !eventFired {
		t.Fatal("clue.acquired event not published")
	}

	m.mu.RLock()
	if m.playerDrawCounts[playerID] != 1 {
		t.Fatalf("draw count = %d, want 1", m.playerDrawCounts[playerID])
	}
	if len(m.acquiredClues[playerID]) != 1 {
		t.Fatalf("acquired clues = %d, want 1", len(m.acquiredClues[playerID]))
	}
	m.mu.RUnlock()
}

func TestClueInteractionModule_DrawClue_LimitReached(t *testing.T) {
	m := NewClueInteractionModule()
	cfg, _ := json.Marshal(ClueInteractionConfig{DrawLimit: 2, InitialClueLevel: 1, DuplicatePolicy: "shared", CommonClueVisibility: "all"})
	_ = m.Init(context.Background(), newTestDeps(), cfg)

	playerID := uuid.New()

	for i := 0; i < 2; i++ {
		payload, _ := json.Marshal(drawCluePayload{LocationID: "room_a"})
		err := m.HandleMessage(context.Background(), playerID, "draw_clue", payload)
		if err != nil {
			t.Fatalf("draw %d failed: %v", i+1, err)
		}
	}

	// Third draw should fail.
	payload, _ := json.Marshal(drawCluePayload{LocationID: "room_a"})
	err := m.HandleMessage(context.Background(), playerID, "draw_clue", payload)
	if err == nil {
		t.Fatal("expected draw limit error")
	}
}

func TestClueInteractionModule_DrawClue_ExclusivePolicy(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	p1, p2 := uuid.New(), uuid.New()

	// Player 1 draws.
	payload, _ := json.Marshal(drawCluePayload{LocationID: "hall"})
	_ = m.HandleMessage(context.Background(), p1, "draw_clue", payload)

	// Player 2 draws the same location at same level with same count — generates same clue ID.
	err := m.HandleMessage(context.Background(), p2, "draw_clue", payload)
	if err == nil {
		t.Fatal("expected exclusive policy error for duplicate clue")
	}
}

func TestClueInteractionModule_TransferClue(t *testing.T) {
	deps := newTestDeps()
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), deps, nil)

	playerID := uuid.New()

	// Draw a clue first.
	drawPayload, _ := json.Marshal(drawCluePayload{LocationID: "garden"})
	_ = m.HandleMessage(context.Background(), playerID, "draw_clue", drawPayload)

	m.mu.RLock()
	clueID := m.acquiredClues[playerID][0]
	m.mu.RUnlock()

	var transferFired bool
	deps.EventBus.Subscribe("clue.transferred", func(e engine.Event) { transferFired = true })

	transferPayload, _ := json.Marshal(transferCluePayload{TargetCode: "butler", ClueID: clueID})
	err := m.HandleMessage(context.Background(), playerID, "transfer_clue", transferPayload)
	if err != nil {
		t.Fatalf("transfer_clue failed: %v", err)
	}
	if !transferFired {
		t.Fatal("clue.transferred event not published")
	}

	// Clue should be removed from sender.
	m.mu.RLock()
	if len(m.acquiredClues[playerID]) != 0 {
		t.Fatalf("expected 0 clues after transfer, got %d", len(m.acquiredClues[playerID]))
	}
	m.mu.RUnlock()
}

func TestClueInteractionModule_TransferClue_NotOwned(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	payload, _ := json.Marshal(transferCluePayload{TargetCode: "nurse", ClueID: "nonexistent"})
	err := m.HandleMessage(context.Background(), uuid.New(), "transfer_clue", payload)
	if err == nil {
		t.Fatal("expected error when transferring unowned clue")
	}
}

func TestClueInteractionModule_UnknownMessage(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

// --- PhaseReactor tests ---

func TestClueInteractionModule_SupportedActions(t *testing.T) {
	m := NewClueInteractionModule()
	actions := m.SupportedActions()
	if len(actions) != 2 {
		t.Fatalf("expected 2 supported actions, got %d", len(actions))
	}
	expected := map[engine.PhaseAction]bool{
		engine.ActionResetDrawCount: true,
		engine.ActionSetClueLevel:   true,
	}
	for _, a := range actions {
		if !expected[a] {
			t.Fatalf("unexpected action %q", a)
		}
	}
}

func TestClueInteractionModule_ReactTo_ResetDrawCount(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	p1 := uuid.New()
	payload, _ := json.Marshal(drawCluePayload{LocationID: "lib"})
	_ = m.HandleMessage(context.Background(), p1, "draw_clue", payload)

	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionResetDrawCount,
	})
	if err != nil {
		t.Fatalf("ReactTo RESET_DRAW_COUNT failed: %v", err)
	}

	m.mu.RLock()
	if m.playerDrawCounts[p1] != 0 {
		t.Fatalf("expected draw count 0 after reset, got %d", m.playerDrawCounts[p1])
	}
	m.mu.RUnlock()
}

func TestClueInteractionModule_ReactTo_SetClueLevel(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	params, _ := json.Marshal(map[string]int{"level": 3})
	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionSetClueLevel,
		Params: params,
	})
	if err != nil {
		t.Fatalf("ReactTo SET_CLUE_LEVEL failed: %v", err)
	}

	m.mu.RLock()
	if m.currentClueLevel != 3 {
		t.Fatalf("expected clue level 3, got %d", m.currentClueLevel)
	}
	m.mu.RUnlock()
}

func TestClueInteractionModule_ReactTo_SetClueLevel_InvalidLevel(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	params, _ := json.Marshal(map[string]int{"level": 0})
	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionSetClueLevel,
		Params: params,
	})
	if err == nil {
		t.Fatal("expected error for level <= 0")
	}
}

func TestClueInteractionModule_ReactTo_UnsupportedAction(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionOpenVoting,
	})
	if err == nil {
		t.Fatal("expected error for unsupported action")
	}
}

// --- ConfigSchema test ---

func TestClueInteractionModule_Schema(t *testing.T) {
	m := NewClueInteractionModule()
	schema := m.Schema()
	if schema == nil {
		t.Fatal("Schema returned nil")
	}

	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("Schema not valid JSON: %v", err)
	}
	if parsed["type"] != "object" {
		t.Fatalf("expected schema type %q, got %v", "object", parsed["type"])
	}
	props, ok := parsed["properties"].(map[string]any)
	if !ok {
		t.Fatal("expected properties to be an object")
	}
	expectedFields := []string{"drawLimit", "initialClueLevel", "cumulativeLevel", "duplicatePolicy", "commonClueVisibility", "autoRevealClues"}
	for _, f := range expectedFields {
		if _, exists := props[f]; !exists {
			t.Fatalf("missing field %q in schema", f)
		}
	}
}

func TestClueInteractionModule_BuildState(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state clueInteractionState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if state.CurrentClueLevel != 1 {
		t.Fatalf("expected clue level 1, got %d", state.CurrentClueLevel)
	}
	if state.Config.DrawLimit != 5 {
		t.Fatalf("expected draw limit 5, got %d", state.Config.DrawLimit)
	}
}

func TestClueInteractionModule_Cleanup(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.playerDrawCounts != nil {
		t.Fatal("expected playerDrawCounts to be nil after cleanup")
	}
}

func TestClueInteractionModule_Validate(t *testing.T) {
	m := NewClueInteractionModule()
	if err := m.Validate(context.Background(), engine.GameEvent{Type: "draw_clue"}, engine.GameState{}); err != nil {
		t.Fatalf("Validate draw_clue: %v", err)
	}
	if err := m.Validate(context.Background(), engine.GameEvent{Type: "transfer_clue"}, engine.GameState{}); err != nil {
		t.Fatalf("Validate transfer_clue: %v", err)
	}
	if err := m.Validate(context.Background(), engine.GameEvent{Type: "unknown"}, engine.GameState{}); err == nil {
		t.Error("expected error for unknown event type")
	}
}

func TestClueInteractionModule_Apply(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	state := engine.GameState{Modules: make(map[string]json.RawMessage)}
	if err := m.Apply(context.Background(), engine.GameEvent{Type: "draw_clue"}, &state); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if _, ok := state.Modules["clue_interaction"]; !ok {
		t.Error("expected clue_interaction state in GameState.Modules")
	}
}
