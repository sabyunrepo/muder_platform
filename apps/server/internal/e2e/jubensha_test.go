package e2e_test

import (
	"context"
	"testing"
	"time"
)

func TestSmoke_Jubensha_FirstPerson(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	h := newSmokeHarness(t, "jubensha_1st_person", 6)
	defer h.stop(ctx)

	// Verify engine started on first phase.
	phase := h.eng.CurrentPhase()
	if phase == nil {
		t.Fatal("expected non-nil current phase after start")
	}
	if phase.ID != "lobby" {
		t.Fatalf("expected first phase 'lobby', got %q", phase.ID)
	}

	// Advance through all 8 phases (lobby → script → round_1/2/3/4 → vote → ending).
	h.advanceAllPhases(ctx)

	if h.eng.CurrentPhase() != nil {
		t.Errorf("expected nil phase after completion, got %v", h.eng.CurrentPhase())
	}
}
