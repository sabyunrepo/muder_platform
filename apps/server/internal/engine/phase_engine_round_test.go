package engine

import (
	"context"
	"testing"
)

// Phase 20 PR-5: CurrentRound — monotonic counter starting at 1 on Start,
// incrementing once per successful AdvancePhase, staying put after the final
// phase exits.
func TestPhaseEngine_CurrentRound_IncrementsWithAdvance(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	ctx := context.Background()

	if got := pe.CurrentRound(); got != 0 {
		t.Fatalf("pre-Start round = %d, want 0", got)
	}

	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	if got := pe.CurrentRound(); got != 1 {
		t.Fatalf("post-Start round = %d, want 1", got)
	}

	// Advance 1 → round 2
	if _, err := pe.AdvancePhase(ctx); err != nil {
		t.Fatalf("advance 1: %v", err)
	}
	if got := pe.CurrentRound(); got != 2 {
		t.Fatalf("after advance 1, round = %d, want 2", got)
	}

	// Advance 2 → round 3
	if _, err := pe.AdvancePhase(ctx); err != nil {
		t.Fatalf("advance 2: %v", err)
	}
	if got := pe.CurrentRound(); got != 3 {
		t.Fatalf("after advance 2, round = %d, want 3", got)
	}

	// Advance past the last phase — engine completes, round sticks.
	if hasNext, _ := pe.AdvancePhase(ctx); hasNext {
		t.Fatal("expected engine complete on 3rd advance")
	}
	if got := pe.CurrentRound(); got != 3 {
		t.Fatalf("post-completion round = %d, want 3 (sticks)", got)
	}
}
