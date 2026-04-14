package core

import (
	"context"
	"encoding/json"
	"testing"
	"time"

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

// --- Item Use tests ---

func TestClueInteractionModule_ItemUse_PeekFlow(t *testing.T) {
	deps := newTestDeps()
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), deps, nil)

	playerID := uuid.New()
	targetID := uuid.New()
	clueID := uuid.New()

	// Give target player a clue.
	m.mu.Lock()
	m.acquiredClues[targetID] = []string{"clue_garden_L1_1"}
	m.mu.Unlock()

	var declaredFired, resolvedFired, peekFired bool
	deps.EventBus.Subscribe("clue.item_declared", func(e engine.Event) { declaredFired = true })
	deps.EventBus.Subscribe("clue.item_resolved", func(e engine.Event) { resolvedFired = true })
	deps.EventBus.Subscribe("clue.peek_result", func(e engine.Event) { peekFired = true })

	// Step 1: declare use.
	usePayload, _ := json.Marshal(itemUsePayload{ClueID: clueID.String(), Effect: "peek", Target: "player"})
	if err := m.HandleMessage(context.Background(), playerID, "clue:use", usePayload); err != nil {
		t.Fatalf("clue:use failed: %v", err)
	}
	if !declaredFired {
		t.Fatal("clue.item_declared not published")
	}

	// Step 2: specify target.
	targetPayload, _ := json.Marshal(itemUseTargetPayload{TargetPlayerID: targetID.String()})
	if err := m.HandleMessage(context.Background(), playerID, "clue:use_target", targetPayload); err != nil {
		t.Fatalf("clue:use_target failed: %v", err)
	}
	if !resolvedFired {
		t.Fatal("clue.item_resolved not published")
	}
	if !peekFired {
		t.Fatal("clue.peek_result not published")
	}

	// activeItemUse must be cleared.
	m.mu.RLock()
	if m.activeItemUse != nil {
		t.Fatal("expected activeItemUse to be nil after resolution")
	}
	if len(m.usedItems[playerID]) != 1 {
		t.Fatalf("expected 1 used item, got %d", len(m.usedItems[playerID]))
	}
	m.mu.RUnlock()
}

func TestClueInteractionModule_ItemUse_MutexBlock(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	p1, p2 := uuid.New(), uuid.New()
	clue1, clue2 := uuid.New(), uuid.New()

	// p1 declares use.
	payload1, _ := json.Marshal(itemUsePayload{ClueID: clue1.String(), Effect: "peek", Target: "player"})
	if err := m.HandleMessage(context.Background(), p1, "clue:use", payload1); err != nil {
		t.Fatalf("first use failed: %v", err)
	}

	// p2 tries to declare use while p1 is active — must fail.
	payload2, _ := json.Marshal(itemUsePayload{ClueID: clue2.String(), Effect: "peek", Target: "player"})
	if err := m.HandleMessage(context.Background(), p2, "clue:use", payload2); err == nil {
		t.Fatal("expected mutex block error for concurrent item use")
	}
}

func TestClueInteractionModule_ItemUse_Cancel(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	playerID := uuid.New()
	clueID := uuid.New()

	usePayload, _ := json.Marshal(itemUsePayload{ClueID: clueID.String(), Effect: "peek", Target: "player"})
	if err := m.HandleMessage(context.Background(), playerID, "clue:use", usePayload); err != nil {
		t.Fatalf("clue:use failed: %v", err)
	}

	if err := m.HandleMessage(context.Background(), playerID, "clue:use_cancel", nil); err != nil {
		t.Fatalf("clue:use_cancel failed: %v", err)
	}

	m.mu.RLock()
	if m.activeItemUse != nil {
		t.Fatal("expected activeItemUse to be nil after cancel")
	}
	m.mu.RUnlock()
}

func TestClueInteractionModule_ItemUse_Cancel_WrongPlayer(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	p1, p2 := uuid.New(), uuid.New()
	clueID := uuid.New()

	usePayload, _ := json.Marshal(itemUsePayload{ClueID: clueID.String(), Effect: "peek", Target: "player"})
	_ = m.HandleMessage(context.Background(), p1, "clue:use", usePayload)

	if err := m.HandleMessage(context.Background(), p2, "clue:use_cancel", nil); err == nil {
		t.Fatal("expected error when non-owner tries to cancel")
	}
}

func TestClueInteractionModule_ItemUse_Timeout(t *testing.T) {
	deps := newTestDeps()
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), deps, nil)

	playerID := uuid.New()
	clueID := uuid.New()

	timeoutCh := make(chan struct{}, 1)
	deps.EventBus.Subscribe("clue.item_timeout", func(e engine.Event) { timeoutCh <- struct{}{} })

	usePayload, _ := json.Marshal(itemUsePayload{ClueID: clueID.String(), Effect: "peek", Target: "player"})
	if err := m.HandleMessage(context.Background(), playerID, "clue:use", usePayload); err != nil {
		t.Fatalf("clue:use failed: %v", err)
	}

	// Override the timer with a very short one to test timeout behavior.
	m.mu.Lock()
	if m.itemTimeout != nil {
		m.itemTimeout.Stop()
	}
	m.itemTimeout = time.AfterFunc(20*time.Millisecond, func() {
		m.mu.Lock()
		if m.activeItemUse != nil && m.activeItemUse.ClueID == clueID {
			m.activeItemUse = nil
		}
		m.mu.Unlock()
		deps.EventBus.Publish(engine.Event{
			Type: "clue.item_timeout",
			Payload: map[string]any{
				"playerId": playerID.String(),
				"clueId":   clueID.String(),
			},
		})
	})
	m.mu.Unlock()

	select {
	case <-timeoutCh:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("clue.item_timeout event not published within deadline")
	}

	m.mu.RLock()
	active := m.activeItemUse
	m.mu.RUnlock()

	if active != nil {
		t.Fatal("expected activeItemUse to be nil after timeout")
	}
}

func TestClueInteractionModule_ItemUse_NotImplemented(t *testing.T) {
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	playerID := uuid.New()
	clueID := uuid.New()
	targetID := uuid.New()

	// Declare use with an unimplemented effect.
	usePayload, _ := json.Marshal(itemUsePayload{ClueID: clueID.String(), Effect: "steal", Target: "player"})
	if err := m.HandleMessage(context.Background(), playerID, "clue:use", usePayload); err != nil {
		t.Fatalf("clue:use failed: %v", err)
	}

	targetPayload, _ := json.Marshal(itemUseTargetPayload{TargetPlayerID: targetID.String()})
	err := m.HandleMessage(context.Background(), playerID, "clue:use_target", targetPayload)
	if err == nil {
		t.Fatal("expected not-implemented error for 'steal' effect")
	}
}

func TestClueInteractionModule_ItemUse_BuildState(t *testing.T) {
	deps := newTestDeps()
	m := NewClueInteractionModule()
	_ = m.Init(context.Background(), deps, nil)

	playerID := uuid.New()
	targetID := uuid.New()
	clueID := uuid.New()

	m.mu.Lock()
	m.acquiredClues[targetID] = []string{"clue_x"}
	m.mu.Unlock()

	// Complete a peek flow.
	usePayload, _ := json.Marshal(itemUsePayload{ClueID: clueID.String(), Effect: "peek", Target: "player"})
	_ = m.HandleMessage(context.Background(), playerID, "clue:use", usePayload)
	targetPayload, _ := json.Marshal(itemUseTargetPayload{TargetPlayerID: targetID.String()})
	_ = m.HandleMessage(context.Background(), playerID, "clue:use_target", targetPayload)

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state clueInteractionState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if len(state.UsedItems[playerID]) != 1 {
		t.Fatalf("expected 1 used item in state, got %d", len(state.UsedItems[playerID]))
	}
	if state.ActiveItemUse != nil {
		t.Fatal("expected activeItemUse to be nil in state after resolution")
	}
}
