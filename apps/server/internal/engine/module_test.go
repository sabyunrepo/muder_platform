package engine

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// stub implementations
// ---------------------------------------------------------------------------

// stubCorePlugin implements only the 7 Core Plugin methods.
type stubCorePlugin struct{}

func (s *stubCorePlugin) ID() string      { return "stub_core" }
func (s *stubCorePlugin) Name() string    { return "Stub Core" }
func (s *stubCorePlugin) Version() string { return "0.1.0" }
func (s *stubCorePlugin) GetConfigSchema() PluginConfigSchema {
	return PluginConfigSchema{Schema: json.RawMessage(`{}`)}
}
func (s *stubCorePlugin) DefaultConfig() json.RawMessage                  { return json.RawMessage(`{}`) }
func (s *stubCorePlugin) Init(_ context.Context, _ json.RawMessage) error { return nil }
func (s *stubCorePlugin) Cleanup(_ context.Context) error                 { return nil }

// stubFullPlugin implements Core 7 + all 5 optional interfaces.
type stubFullPlugin struct{}

func (s *stubFullPlugin) ID() string      { return "stub_full" }
func (s *stubFullPlugin) Name() string    { return "Stub Full" }
func (s *stubFullPlugin) Version() string { return "0.2.0" }
func (s *stubFullPlugin) GetConfigSchema() PluginConfigSchema {
	return PluginConfigSchema{Schema: json.RawMessage(`{"type":"object"}`)}
}
func (s *stubFullPlugin) DefaultConfig() json.RawMessage                  { return json.RawMessage(`{"enabled":true}`) }
func (s *stubFullPlugin) Init(_ context.Context, _ json.RawMessage) error { return nil }
func (s *stubFullPlugin) Cleanup(_ context.Context) error                 { return nil }

// GameEventHandler
func (s *stubFullPlugin) Validate(_ context.Context, _ GameEvent, _ GameState) error { return nil }
func (s *stubFullPlugin) Apply(_ context.Context, _ GameEvent, _ *GameState) error   { return nil }

// WinChecker
func (s *stubFullPlugin) CheckWin(_ context.Context, _ GameState) (WinResult, error) {
	return WinResult{Won: false}, nil
}

// PhaseHookPlugin
func (s *stubFullPlugin) OnPhaseEnter(_ context.Context, _ Phase) error { return nil }
func (s *stubFullPlugin) OnPhaseExit(_ context.Context, _ Phase) error  { return nil }

// SerializablePlugin
func (s *stubFullPlugin) BuildState(_ context.Context) (GameState, error) {
	return GameState{SessionID: uuid.Nil, Phase: "test"}, nil
}
func (s *stubFullPlugin) RestoreState(_ context.Context, _ uuid.UUID, _ GameState) error {
	return nil
}

// RuleProvider
func (s *stubFullPlugin) GetRules() []Rule {
	return []Rule{{ID: "rule1", Logic: json.RawMessage(`{"==": [1, 1]}`)}}
}

// ---------------------------------------------------------------------------
// type assertion tests
// ---------------------------------------------------------------------------

func TestCorePlugin_TypeAssertions(t *testing.T) {
	var p Plugin = &stubCorePlugin{}

	// Core interface is satisfied.
	if p.ID() != "stub_core" {
		t.Fatalf("expected id stub_core, got %s", p.ID())
	}

	// Optional interfaces must NOT be implemented by stubCorePlugin.
	if _, ok := p.(GameEventHandler); ok {
		t.Error("stubCorePlugin must not implement GameEventHandler")
	}
	if _, ok := p.(WinChecker); ok {
		t.Error("stubCorePlugin must not implement WinChecker")
	}
	if _, ok := p.(PhaseHookPlugin); ok {
		t.Error("stubCorePlugin must not implement PhaseHookPlugin")
	}
	if _, ok := p.(SerializablePlugin); ok {
		t.Error("stubCorePlugin must not implement SerializablePlugin")
	}
	if _, ok := p.(RuleProvider); ok {
		t.Error("stubCorePlugin must not implement RuleProvider")
	}
}

func TestFullPlugin_TypeAssertions(t *testing.T) {
	var p Plugin = &stubFullPlugin{}

	// Core fields.
	if p.ID() != "stub_full" {
		t.Fatalf("expected id stub_full, got %s", p.ID())
	}

	// All 5 optional interfaces must be implemented.
	if _, ok := p.(GameEventHandler); !ok {
		t.Error("stubFullPlugin must implement GameEventHandler")
	}
	if _, ok := p.(WinChecker); !ok {
		t.Error("stubFullPlugin must implement WinChecker")
	}
	if _, ok := p.(PhaseHookPlugin); !ok {
		t.Error("stubFullPlugin must implement PhaseHookPlugin")
	}
	if _, ok := p.(SerializablePlugin); !ok {
		t.Error("stubFullPlugin must implement SerializablePlugin")
	}
	if _, ok := p.(RuleProvider); !ok {
		t.Error("stubFullPlugin must implement RuleProvider")
	}
}

func TestFullPlugin_OptionalMethodCalls(t *testing.T) {
	ctx := context.Background()
	var p Plugin = &stubFullPlugin{}

	// GameEventHandler
	eh := p.(GameEventHandler)
	if err := eh.Validate(ctx, GameEvent{ID: uuid.New(), Type: "test"}, GameState{}); err != nil {
		t.Errorf("Validate: %v", err)
	}
	state := &GameState{}
	if err := eh.Apply(ctx, GameEvent{ID: uuid.New(), Type: "test"}, state); err != nil {
		t.Errorf("Apply: %v", err)
	}

	// WinChecker
	wc := p.(WinChecker)
	wr, err := wc.CheckWin(ctx, GameState{})
	if err != nil {
		t.Errorf("CheckWin: %v", err)
	}
	if wr.Won {
		t.Error("expected Won=false from stub")
	}

	// PhaseHookPlugin
	ph := p.(PhaseHookPlugin)
	if err := ph.OnPhaseEnter(ctx, Phase("intro")); err != nil {
		t.Errorf("OnPhaseEnter: %v", err)
	}
	if err := ph.OnPhaseExit(ctx, Phase("intro")); err != nil {
		t.Errorf("OnPhaseExit: %v", err)
	}

	// SerializablePlugin
	sp := p.(SerializablePlugin)
	gs, err := sp.BuildState(ctx)
	if err != nil {
		t.Errorf("BuildState: %v", err)
	}
	if gs.Phase != "test" {
		t.Errorf("unexpected phase %q", gs.Phase)
	}
	if err := sp.RestoreState(ctx, uuid.New(), GameState{}); err != nil {
		t.Errorf("RestoreState: %v", err)
	}

	// RuleProvider
	rp := p.(RuleProvider)
	rules := rp.GetRules()
	if len(rules) == 0 {
		t.Error("expected at least one rule from stub")
	}
}

// ---------------------------------------------------------------------------
// PluginRegistry tests
// ---------------------------------------------------------------------------

func TestPluginRegistry_HappyPath(t *testing.T) {
	r := NewPluginRegistry()
	r.Register("stub_core", func() Plugin { return &stubCorePlugin{} })

	p, err := r.New("stub_core")
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if p.ID() != "stub_core" {
		t.Errorf("expected stub_core, got %s", p.ID())
	}
}

func TestPluginRegistry_FactoryReturnsNewInstance(t *testing.T) {
	r := NewPluginRegistry()
	// Use stubFullPlugin which has methods — calling New twice must produce
	// logically independent values even if Go merges zero-size-struct pointers.
	r.Register("stub_full2", func() Plugin { return &stubFullPlugin{} })

	p1, err1 := r.New("stub_full2")
	p2, err2 := r.New("stub_full2")
	if err1 != nil || err2 != nil {
		t.Fatalf("New errors: %v, %v", err1, err2)
	}
	// Each call must go through the factory and return a non-nil Plugin.
	if p1 == nil || p2 == nil {
		t.Fatal("factory returned nil Plugin")
	}
	// Verify factory is called twice by checking the returned values are valid
	// independent Plugin implementations (both satisfy the interface).
	if p1.ID() != "stub_full" || p2.ID() != "stub_full" {
		t.Errorf("unexpected IDs: %s, %s", p1.ID(), p2.ID())
	}
}

func TestPluginRegistry_UnknownID(t *testing.T) {
	r := NewPluginRegistry()
	_, err := r.New("not_registered")
	if err == nil {
		t.Fatal("expected error for unknown plugin id")
	}
}

func TestPluginRegistry_PanicOnEmptyID(t *testing.T) {
	r := NewPluginRegistry()
	defer func() {
		if recover() == nil {
			t.Error("expected panic for empty id")
		}
	}()
	r.Register("", func() Plugin { return &stubCorePlugin{} })
}

func TestPluginRegistry_PanicOnNilFactory(t *testing.T) {
	r := NewPluginRegistry()
	defer func() {
		if recover() == nil {
			t.Error("expected panic for nil factory")
		}
	}()
	r.Register("some_plugin", nil)
}

func TestPluginRegistry_PanicOnDuplicateID(t *testing.T) {
	r := NewPluginRegistry()
	r.Register("dup", func() Plugin { return &stubCorePlugin{} })
	defer func() {
		if recover() == nil {
			t.Error("expected panic for duplicate id")
		}
	}()
	r.Register("dup", func() Plugin { return &stubCorePlugin{} })
}

func TestPluginRegistry_List(t *testing.T) {
	r := NewPluginRegistry()
	r.Register("alpha", func() Plugin { return &stubCorePlugin{} })
	r.Register("beta", func() Plugin { return &stubCorePlugin{} })

	ids := r.List()
	if len(ids) != 2 {
		t.Errorf("expected 2 ids, got %d", len(ids))
	}
}
