package engine

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

// testLogger implements the Printf interface for testing.
type testLogger struct{ t *testing.T }

func (l *testLogger) Printf(format string, v ...any) {
	l.t.Helper()
	l.t.Logf(format, v...)
}

func setupTestEngine(t *testing.T) (*GameProgressionEngine, func()) {
	t.Helper()

	// Register test modules in the global registry.
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{
		"script_progression": func() Module { return &stubModule{name: "script_progression"} },
		"voting": func() Module {
			return &stubReactor{
				stubModule: stubModule{name: "voting"},
				actions:    []PhaseAction{ActionOpenVoting, ActionCloseVoting},
			}
		},
		"gm_control": func() Module { return &stubModule{name: "gm_control"} },
	}

	cleanup := func() { globalRegistry.factories = origFactories }

	engine := NewEngine(uuid.New(), &testLogger{t})
	return engine, cleanup
}

func testConfigJSON(t *testing.T) json.RawMessage {
	t.Helper()
	config := GameConfig{
		Strategy: "script",
		GmMode:   "REQUIRED",
		Phases: []PhaseConfig{
			{ID: "intro", Name: "Intro", Type: "discussion", Duration: 60},
			{
				ID: "vote", Name: "Vote", Type: "voting", Duration: 30,
				OnEnter: []PhaseActionPayload{{Action: ActionOpenVoting}},
				OnExit:  []PhaseActionPayload{{Action: ActionCloseVoting}},
			},
			{ID: "end", Name: "End", Type: "ending"},
		},
		Modules: []ModuleConfig{
			{Name: "script_progression", Enabled: true},
			{Name: "voting", Enabled: true},
			{Name: "gm_control", Enabled: true},
		},
	}
	data, err := json.Marshal(config)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func TestEngine_StartAndAdvance(t *testing.T) {
	engine, cleanup := setupTestEngine(t)
	defer cleanup()

	ctx := context.Background()
	if err := engine.Start(ctx, testConfigJSON(t)); err != nil {
		t.Fatal(err)
	}
	defer engine.Stop(ctx)

	// Should be on first phase.
	phase := engine.CurrentPhase()
	if phase == nil || phase.ID != "intro" {
		t.Fatalf("expected intro, got %v", phase)
	}

	// Advance to vote phase (onEnter dispatches OPEN_VOTING).
	hasNext, err := engine.Advance(ctx)
	if err != nil || !hasNext {
		t.Fatalf("expected advance to vote, got hasNext=%v err=%v", hasNext, err)
	}
	if engine.CurrentPhase().ID != "vote" {
		t.Fatalf("expected vote, got %s", engine.CurrentPhase().ID)
	}

	// Advance to end phase (onExit dispatches CLOSE_VOTING).
	hasNext, err = engine.Advance(ctx)
	if err != nil || !hasNext {
		t.Fatalf("expected advance to end, got hasNext=%v err=%v", hasNext, err)
	}

	// Advance past last phase.
	hasNext, _ = engine.Advance(ctx)
	if hasNext {
		t.Fatal("expected no more phases")
	}
}

func TestEngine_GMOverride(t *testing.T) {
	engine, cleanup := setupTestEngine(t)
	defer cleanup()

	ctx := context.Background()
	if err := engine.Start(ctx, testConfigJSON(t)); err != nil {
		t.Fatal(err)
	}
	defer engine.Stop(ctx)

	// Skip from intro directly to end.
	if err := engine.GMOverride(ctx, "end"); err != nil {
		t.Fatal(err)
	}
	if engine.CurrentPhase().ID != "end" {
		t.Fatalf("expected end, got %s", engine.CurrentPhase().ID)
	}
}

func TestEngine_BuildState(t *testing.T) {
	engine, cleanup := setupTestEngine(t)
	defer cleanup()

	ctx := context.Background()
	if err := engine.Start(ctx, testConfigJSON(t)); err != nil {
		t.Fatal(err)
	}
	defer engine.Stop(ctx)

	state, err := engine.BuildState()
	if err != nil {
		t.Fatal(err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(state, &parsed); err != nil {
		t.Fatal(err)
	}

	if parsed["sessionId"] == "" {
		t.Fatal("expected sessionId in state")
	}
	if _, ok := parsed["modules"]; !ok {
		t.Fatal("expected modules in state")
	}
}

func TestEngine_HandleMessageUnknownModule(t *testing.T) {
	engine, cleanup := setupTestEngine(t)
	defer cleanup()

	ctx := context.Background()
	if err := engine.Start(ctx, testConfigJSON(t)); err != nil {
		t.Fatal(err)
	}
	defer engine.Stop(ctx)

	err := engine.HandleMessage(ctx, uuid.New(), "nonexistent", "test", nil)
	if err == nil {
		t.Fatal("expected error for unknown module")
	}
}

func TestEngine_DoubleStartError(t *testing.T) {
	engine, cleanup := setupTestEngine(t)
	defer cleanup()

	ctx := context.Background()
	cfg := testConfigJSON(t)
	if err := engine.Start(ctx, cfg); err != nil {
		t.Fatal(err)
	}
	defer engine.Stop(ctx)

	if err := engine.Start(ctx, cfg); err == nil {
		t.Fatal("expected error on double start")
	}
}

func TestEngine_InvalidConfigError(t *testing.T) {
	engine, cleanup := setupTestEngine(t)
	defer cleanup()

	err := engine.Start(context.Background(), json.RawMessage(`{invalid`))
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestEngine_StopIdempotent(t *testing.T) {
	engine, cleanup := setupTestEngine(t)
	defer cleanup()

	// Stop without start should not error.
	if err := engine.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestEngine_EventBusReceivesPhaseChanged(t *testing.T) {
	engine, cleanup := setupTestEngine(t)
	defer cleanup()

	ctx := context.Background()
	if err := engine.Start(ctx, testConfigJSON(t)); err != nil {
		t.Fatal(err)
	}
	defer engine.Stop(ctx)

	var received bool
	engine.EventBus().Subscribe("phase:changed", func(e Event) {
		received = true
		info := e.Payload.(*PhaseInfo)
		if info.ID != "vote" {
			t.Errorf("expected vote, got %s", info.ID)
		}
	})

	_, _ = engine.Advance(ctx)
	if !received {
		t.Fatal("expected phase:changed event")
	}
}

func TestEngine_ValidationRejectsInvalidConfig(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{
		"script_progression": func() Module { return &stubModule{name: "script_progression"} },
	}
	defer func() { globalRegistry.factories = origFactories }()

	engine := NewEngine(uuid.New(), &testLogger{t})

	// Config uses OPEN_VOTING but voting module not enabled + missing gmMode.
	config := GameConfig{
		Strategy: "script",
		GmMode:   "REQUIRED",
		Phases: []PhaseConfig{
			{
				ID: "p1", OnEnter: []PhaseActionPayload{{Action: ActionOpenVoting}},
			},
		},
		Modules: []ModuleConfig{
			{Name: "script_progression", Enabled: true},
		},
	}
	data, _ := json.Marshal(config)

	err := engine.Start(context.Background(), data)
	if err == nil {
		t.Fatal("expected validation error")
	}
	t.Logf("validation error (expected): %v", err)
}
