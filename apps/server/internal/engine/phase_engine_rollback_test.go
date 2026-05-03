package engine

import (
	"context"
	"fmt"
	"testing"
)

type failingEnterHookModule struct {
	stubCoreModule
	failPhase Phase
}

func (h *failingEnterHookModule) OnPhaseEnter(_ context.Context, phase Phase) error {
	if phase == h.failPhase {
		return fmt.Errorf("enter failed for %s", phase)
	}
	return nil
}

func (h *failingEnterHookModule) OnPhaseExit(_ context.Context, _ Phase) error { return nil }

func TestPhaseEngine_StartRollsBackWhenInitialEnterFails(t *testing.T) {
	hook := &failingEnterHookModule{stubCoreModule: stubCoreModule{name: "hook"}, failPhase: "intro"}
	pe, audit := newTestPhaseEngine(t, []Module{hook}, testPhaseDefinitions)

	err := pe.Start(context.Background(), nil)
	if err == nil {
		t.Fatal("expected start enter failure")
	}
	if pe.started {
		t.Fatal("engine should not remain started after initial enter failure")
	}
	if phase := pe.CurrentPhase(); phase != nil {
		t.Fatalf("CurrentPhase after failed start = %#v, want nil", phase)
	}
	if got := len(audit.eventsOfType("engine.started")); got != 0 {
		t.Fatalf("engine.started audits = %d, want 0", got)
	}
}

func TestPhaseEngine_AdvanceRollsBackCurrentWhenTargetEnterFails(t *testing.T) {
	hook := &failingEnterHookModule{stubCoreModule: stubCoreModule{name: "hook"}, failPhase: "invest"}
	pe, audit := newTestPhaseEngine(t, []Module{hook}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	hasNext, err := pe.AdvancePhase(ctx)
	if err == nil || hasNext {
		t.Fatalf("AdvancePhase should fail without advancing, hasNext=%v err=%v", hasNext, err)
	}
	if got := pe.CurrentPhase().ID; got != "intro" {
		t.Fatalf("CurrentPhase after failed advance = %s, want intro", got)
	}
	if got := pe.CurrentRound(); got != 1 {
		t.Fatalf("CurrentRound after failed advance = %d, want 1", got)
	}
	if got := len(audit.eventsOfType("phase.advanced")); got != 0 {
		t.Fatalf("phase.advanced audits = %d, want 0", got)
	}
}

func TestPhaseEngine_SkipRollsBackCurrentWhenTargetEnterFails(t *testing.T) {
	hook := &failingEnterHookModule{stubCoreModule: stubCoreModule{name: "hook"}, failPhase: "vote"}
	pe, audit := newTestPhaseEngine(t, []Module{hook}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	err := pe.SkipToPhase(ctx, "vote")
	if err == nil {
		t.Fatal("expected SkipToPhase enter failure")
	}
	if got := pe.CurrentPhase().ID; got != "intro" {
		t.Fatalf("CurrentPhase after failed skip = %s, want intro", got)
	}
	if got := len(audit.eventsOfType("phase.skipped")); got != 0 {
		t.Fatalf("phase.skipped audits = %d, want 0", got)
	}
}
