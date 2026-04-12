package e2e_test

import (
	"context"
	"testing"
	"time"
)

func TestSmoke_CrimeScene_3Locations(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	h := newSmokeHarness(t, "crime_scene_3loc", 5)
	defer h.stop(ctx)

	// Verify engine started on first phase.
	phase := h.eng.CurrentPhase()
	if phase == nil {
		t.Fatal("expected non-nil current phase after start")
	}
	if phase.ID != "lobby" {
		t.Fatalf("expected first phase 'lobby', got %q", phase.ID)
	}

	// Simulate player moves to location and discovers evidence during investigation.
	_ = h.sendMessage(ctx, 0, "floor_exploration", "move", map[string]any{"location": "kitchen"})
	_ = h.sendMessage(ctx, 0, "location_clue", "search", map[string]any{"location": "kitchen"})
	_ = h.sendMessage(ctx, 1, "clue_interaction", "draw", map[string]any{})

	// Advance through all phases.
	h.advanceAllPhases(ctx)

	if h.eng.CurrentPhase() != nil {
		t.Errorf("expected nil phase after completion, got %v", h.eng.CurrentPhase())
	}
}
