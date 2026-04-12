package e2e_test

import (
	"context"
	"testing"
	"time"
)

func TestSmoke_MurderMystery_Classic6P(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	h := newSmokeHarness(t, "murder_mystery_classic_6p", 6)
	defer h.stop(ctx)

	// Verify engine started on first phase.
	phase := h.eng.CurrentPhase()
	if phase == nil {
		t.Fatal("expected non-nil current phase after start")
	}
	if phase.ID != "lobby" {
		t.Fatalf("expected first phase 'lobby', got %q", phase.ID)
	}

	// Advance through all 11 phases.
	h.advanceAllPhases(ctx)

	// After advancing past the last phase, engine should be past the end.
	// CurrentPhase returns nil when index is out of range.
	if h.eng.CurrentPhase() != nil {
		t.Errorf("expected nil phase after completion, got %v", h.eng.CurrentPhase())
	}
}
