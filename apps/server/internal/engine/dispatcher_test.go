package engine

import (
	"context"
	"testing"
)

// stubReactor is a PhaseReactor for testing.
type stubReactor struct {
	stubModule
	actions  []PhaseAction
	received []PhaseActionPayload
}

func (r *stubReactor) ReactTo(_ context.Context, action PhaseActionPayload) error {
	r.received = append(r.received, action)
	return nil
}

func (r *stubReactor) SupportedActions() []PhaseAction {
	return r.actions
}

func TestDispatcher_RoutesToRequiredModule(t *testing.T) {
	reactor := &stubReactor{
		stubModule: stubModule{name: "voting"},
		actions:    []PhaseAction{ActionOpenVoting, ActionCloseVoting},
	}

	modules := map[string]Module{"voting": reactor}
	d := NewActionDispatcher(modules)

	err := d.Dispatch(context.Background(), PhaseActionPayload{Action: ActionOpenVoting})
	if err != nil {
		t.Fatal(err)
	}

	if len(reactor.received) != 1 || reactor.received[0].Action != ActionOpenVoting {
		t.Fatalf("expected OPEN_VOTING dispatched, got %v", reactor.received)
	}
}

func TestDispatcher_LockModuleRequiresTarget(t *testing.T) {
	modules := map[string]Module{}
	d := NewActionDispatcher(modules)

	err := d.Dispatch(context.Background(), PhaseActionPayload{Action: ActionLockModule})
	if err == nil {
		t.Fatal("expected error for LOCK_MODULE without target")
	}
}

func TestDispatcher_LockModuleRoutesToTarget(t *testing.T) {
	reactor := &stubReactor{
		stubModule: stubModule{name: "text_chat"},
		actions:    []PhaseAction{ActionLockModule},
	}

	modules := map[string]Module{"text_chat": reactor}
	d := NewActionDispatcher(modules)

	err := d.Dispatch(context.Background(), PhaseActionPayload{
		Action: ActionLockModule,
		Target: "text_chat",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(reactor.received) != 1 {
		t.Fatal("expected 1 action dispatched")
	}
}

func TestDispatcher_MissingRequiredModuleError(t *testing.T) {
	modules := map[string]Module{} // no voting module
	d := NewActionDispatcher(modules)

	err := d.Dispatch(context.Background(), PhaseActionPayload{Action: ActionOpenVoting})
	if err == nil {
		t.Fatal("expected error for missing required module")
	}
}

func TestDispatcher_BroadcastToSupportingReactors(t *testing.T) {
	r1 := &stubReactor{
		stubModule: stubModule{name: "mod1"},
		actions:    []PhaseAction{ActionPlaySound},
	}
	r2 := &stubReactor{
		stubModule: stubModule{name: "mod2"},
		actions:    []PhaseAction{ActionPlaySound},
	}

	modules := map[string]Module{"mod1": r1, "mod2": r2}
	d := NewActionDispatcher(modules)

	err := d.Dispatch(context.Background(), PhaseActionPayload{Action: ActionPlaySound})
	if err != nil {
		t.Fatal(err)
	}

	if len(r1.received) != 1 || len(r2.received) != 1 {
		t.Fatalf("expected both reactors called, got %d and %d", len(r1.received), len(r2.received))
	}
}

func TestDispatcher_BatchStopsOnError(t *testing.T) {
	modules := map[string]Module{} // no modules → OPEN_VOTING will fail
	d := NewActionDispatcher(modules)

	actions := []PhaseActionPayload{
		{Action: ActionBroadcastMessage},
		{Action: ActionOpenVoting}, // should fail
		{Action: ActionPlaySound},  // should not run
	}

	err := d.DispatchBatch(context.Background(), actions)
	if err == nil {
		t.Fatal("expected batch error")
	}
}
