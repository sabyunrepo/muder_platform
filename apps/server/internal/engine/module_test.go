package engine

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// stub implementations for optional interface tests
// ---------------------------------------------------------------------------

// optMinModule implements only the Module interface (no optionals).
// PR-2a: embed PublicStateMarker to pass the F-sec-2 boot gate.
type optMinModule struct {
	PublicStateMarker
	name string
}

func (s *optMinModule) Name() string { return s.name }
func (s *optMinModule) Init(_ context.Context, _ ModuleDeps, _ json.RawMessage) error {
	return nil
}
func (s *optMinModule) BuildState() (json.RawMessage, error) { return json.RawMessage(`{}`), nil }
func (s *optMinModule) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return nil
}
func (s *optMinModule) Cleanup(_ context.Context) error { return nil }

// optMaxModule implements Module + all 5 optional interfaces.
// PR-2a: embed PublicStateMarker to pass the F-sec-2 boot gate.
type optMaxModule struct {
	PublicStateMarker
	name string
}

func (s *optMaxModule) Name() string { return s.name }
func (s *optMaxModule) Init(_ context.Context, _ ModuleDeps, _ json.RawMessage) error {
	return nil
}
func (s *optMaxModule) BuildState() (json.RawMessage, error) { return json.RawMessage(`{}`), nil }
func (s *optMaxModule) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return nil
}
func (s *optMaxModule) Cleanup(_ context.Context) error { return nil }

// GameEventHandler
func (s *optMaxModule) Validate(_ context.Context, _ GameEvent, _ GameState) error { return nil }
func (s *optMaxModule) Apply(_ context.Context, _ GameEvent, _ *GameState) error   { return nil }

// WinChecker
func (s *optMaxModule) CheckWin(_ context.Context, _ GameState) (WinResult, error) {
	return WinResult{Won: false}, nil
}

// PhaseHookModule
func (s *optMaxModule) OnPhaseEnter(_ context.Context, _ Phase) error { return nil }
func (s *optMaxModule) OnPhaseExit(_ context.Context, _ Phase) error  { return nil }

// SerializableModule
func (s *optMaxModule) SaveState(_ context.Context) (GameState, error) {
	return GameState{SessionID: uuid.Nil, Phase: "test"}, nil
}
func (s *optMaxModule) RestoreState(_ context.Context, _ uuid.UUID, _ GameState) error {
	return nil
}

// RuleProvider
func (s *optMaxModule) GetRules() []Rule {
	return []Rule{{ID: "rule1", Logic: json.RawMessage(`{"==": [1, 1]}`)}}
}

// ---------------------------------------------------------------------------
// type assertion tests — verify ISP optional interface segregation
// ---------------------------------------------------------------------------

func TestModule_MinimalDoesNotImplementOptionals(t *testing.T) {
	var m Module = &optMinModule{name: "min"}

	if m.Name() != "min" {
		t.Fatalf("expected name min, got %s", m.Name())
	}

	if _, ok := m.(GameEventHandler); ok {
		t.Error("optMinModule must not implement GameEventHandler")
	}
	if _, ok := m.(WinChecker); ok {
		t.Error("optMinModule must not implement WinChecker")
	}
	if _, ok := m.(PhaseHookModule); ok {
		t.Error("optMinModule must not implement PhaseHookModule")
	}
	if _, ok := m.(SerializableModule); ok {
		t.Error("optMinModule must not implement SerializableModule")
	}
	if _, ok := m.(RuleProvider); ok {
		t.Error("optMinModule must not implement RuleProvider")
	}
}

func TestModule_MaxImplementsAllOptionals(t *testing.T) {
	var m Module = &optMaxModule{name: "max"}

	if m.Name() != "max" {
		t.Fatalf("expected name max, got %s", m.Name())
	}

	if _, ok := m.(GameEventHandler); !ok {
		t.Error("optMaxModule must implement GameEventHandler")
	}
	if _, ok := m.(WinChecker); !ok {
		t.Error("optMaxModule must implement WinChecker")
	}
	if _, ok := m.(PhaseHookModule); !ok {
		t.Error("optMaxModule must implement PhaseHookModule")
	}
	if _, ok := m.(SerializableModule); !ok {
		t.Error("optMaxModule must implement SerializableModule")
	}
	if _, ok := m.(RuleProvider); !ok {
		t.Error("optMaxModule must implement RuleProvider")
	}
}

func TestModule_OptionalMethodCalls(t *testing.T) {
	ctx := context.Background()
	var m Module = &optMaxModule{name: "max"}

	// GameEventHandler
	eh := m.(GameEventHandler)
	if err := eh.Validate(ctx, GameEvent{ID: uuid.New(), Type: "test"}, GameState{}); err != nil {
		t.Errorf("Validate: %v", err)
	}
	state := &GameState{}
	if err := eh.Apply(ctx, GameEvent{ID: uuid.New(), Type: "test"}, state); err != nil {
		t.Errorf("Apply: %v", err)
	}

	// WinChecker
	wc := m.(WinChecker)
	wr, err := wc.CheckWin(ctx, GameState{})
	if err != nil {
		t.Errorf("CheckWin: %v", err)
	}
	if wr.Won {
		t.Error("expected Won=false from stub")
	}

	// PhaseHookModule
	ph := m.(PhaseHookModule)
	if err := ph.OnPhaseEnter(ctx, Phase("intro")); err != nil {
		t.Errorf("OnPhaseEnter: %v", err)
	}
	if err := ph.OnPhaseExit(ctx, Phase("intro")); err != nil {
		t.Errorf("OnPhaseExit: %v", err)
	}

	// RuleProvider
	rp := m.(RuleProvider)
	rules := rp.GetRules()
	if len(rules) == 0 {
		t.Error("expected at least one rule from stub")
	}
}

// ---------------------------------------------------------------------------
// Registry tests (global module registry)
// ---------------------------------------------------------------------------

func TestRegistry_RegisterAndCreate(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{
		"opt_min": func() Module { return &optMinModule{name: "opt_min"} },
	}
	defer func() { globalRegistry.factories = origFactories }()

	mod, err := CreateModule("opt_min")
	if err != nil {
		t.Fatalf("CreateModule: %v", err)
	}
	if mod.Name() != "opt_min" {
		t.Errorf("expected opt_min, got %s", mod.Name())
	}
}
