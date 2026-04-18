package engine

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// PR-2a / Phase 19.1 PR-A — F-sec-2 boot gate tests.
//
// These tests verify that:
//   1. assertModuleContract accepts PlayerAware modules.
//   2. assertModuleContract accepts PublicStateMarker-bearing modules.
//   3. assertModuleContract rejects modules that implement neither.
//   4. Register() panics on a violating module — the gate is always on; the
//      Phase 18/19 env-driven escape hatch (MMP_PLAYERAWARE_STRICT) was
//      retired in Phase 19.1 PR-A.
//   5. BuildModules returns an error when a manually injected factory violates
//      the contract (tests that bypass Register via direct map mutation).
//   6. Every currently-registered module satisfies the gate (regression).
// ---------------------------------------------------------------------------

// gateBareModule implements Module only (no marker, no BuildStateFor).
// It must fail the PR-2a gate.
type gateBareModule struct{ name string }

func (g *gateBareModule) Name() string { return g.name }
func (g *gateBareModule) Init(_ context.Context, _ ModuleDeps, _ json.RawMessage) error {
	return nil
}
func (g *gateBareModule) BuildState() (json.RawMessage, error) { return json.RawMessage(`{}`), nil }
func (g *gateBareModule) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return nil
}
func (g *gateBareModule) Cleanup(_ context.Context) error { return nil }

// gatePublicModule embeds PublicStateMarker and satisfies the gate.
type gatePublicModule struct {
	PublicStateMarker
	name string
}

func (g *gatePublicModule) Name() string { return g.name }
func (g *gatePublicModule) Init(_ context.Context, _ ModuleDeps, _ json.RawMessage) error {
	return nil
}
func (g *gatePublicModule) BuildState() (json.RawMessage, error) {
	return json.RawMessage(`{"public":true}`), nil
}
func (g *gatePublicModule) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return nil
}
func (g *gatePublicModule) Cleanup(_ context.Context) error { return nil }

// gatePlayerAwareModule implements BuildStateFor and satisfies the gate.
type gatePlayerAwareModule struct{ name string }

func (g *gatePlayerAwareModule) Name() string { return g.name }
func (g *gatePlayerAwareModule) Init(_ context.Context, _ ModuleDeps, _ json.RawMessage) error {
	return nil
}
func (g *gatePlayerAwareModule) BuildState() (json.RawMessage, error) {
	return json.RawMessage(`{"public":true}`), nil
}
func (g *gatePlayerAwareModule) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return nil
}
func (g *gatePlayerAwareModule) Cleanup(_ context.Context) error { return nil }
func (g *gatePlayerAwareModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	return json.Marshal(map[string]string{"viewer": playerID.String()})
}

// ---------------------------------------------------------------------------
// assertModuleContract unit tests.
// ---------------------------------------------------------------------------

func TestAssertModuleContract_AcceptsPlayerAware(t *testing.T) {
	m := &gatePlayerAwareModule{name: "pa"}
	if err := assertModuleContract("pa", m); err != nil {
		t.Fatalf("PlayerAware module rejected: %v", err)
	}
}

func TestAssertModuleContract_AcceptsPublicMarker(t *testing.T) {
	m := &gatePublicModule{name: "pub"}
	if err := assertModuleContract("pub", m); err != nil {
		t.Fatalf("PublicStateMarker module rejected: %v", err)
	}
}

func TestAssertModuleContract_RejectsBare(t *testing.T) {
	m := &gateBareModule{name: "bare"}
	err := assertModuleContract("bare", m)
	if err == nil {
		t.Fatal("expected gate violation for bare module, got nil")
	}
	if !strings.Contains(err.Error(), "F-sec-2") {
		t.Errorf("error must mention F-sec-2: %v", err)
	}
	if !strings.Contains(err.Error(), "bare") {
		t.Errorf("error must name the module: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Register() panic gate.
// ---------------------------------------------------------------------------

func TestRegister_PanicsOnGateViolation(t *testing.T) {
	// Default strict mode on. Save+restore registry.
	orig := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{}
	defer func() { globalRegistry.factories = orig }()

	defer func() {
		r := recover()
		if r == nil {
			t.Fatal("Register did not panic on gate violation")
		}
		msg, ok := r.(string)
		if !ok {
			t.Fatalf("expected string panic, got %T: %v", r, r)
		}
		if !strings.Contains(msg, "F-sec-2") {
			t.Errorf("panic message missing F-sec-2: %s", msg)
		}
	}()

	Register("gate_bare", func() Module { return &gateBareModule{name: "gate_bare"} })
}

func TestRegister_AcceptsPlayerAware(t *testing.T) {
	orig := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{}
	defer func() { globalRegistry.factories = orig }()

	Register("gate_pa", func() Module { return &gatePlayerAwareModule{name: "gate_pa"} })

	if !HasModule("gate_pa") {
		t.Fatal("PlayerAware module was not registered")
	}
}

func TestRegister_AcceptsPublicMarker(t *testing.T) {
	orig := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{}
	defer func() { globalRegistry.factories = orig }()

	Register("gate_pub", func() Module { return &gatePublicModule{name: "gate_pub"} })

	if !HasModule("gate_pub") {
		t.Fatal("PublicStateMarker module was not registered")
	}
}

// ---------------------------------------------------------------------------
// BuildModules runtime gate (for tests that inject factories manually).
// ---------------------------------------------------------------------------

func TestBuildModules_RejectsGateViolation(t *testing.T) {
	orig := globalRegistry.factories
	// Inject a bare factory directly, bypassing Register's panic.
	globalRegistry.factories = map[string]ModuleFactory{
		"bare_inject": func() Module { return &gateBareModule{name: "bare_inject"} },
	}
	defer func() { globalRegistry.factories = orig }()

	cfg := &GameConfig{
		Modules: []ModuleConfig{{Name: "bare_inject"}},
	}
	_, _, err := BuildModules(context.Background(), cfg, ModuleDeps{})
	if err == nil {
		t.Fatal("BuildModules must reject bare modules that bypassed Register")
	}
	if !strings.Contains(err.Error(), "F-sec-2") {
		t.Errorf("BuildModules error must mention F-sec-2: %v", err)
	}
}

// ---------------------------------------------------------------------------
// All registered modules (production 33) must satisfy the gate — regression
// test. With the env-driven escape hatch retired in Phase 19.1 PR-A, any new
// non-compliant module would panic at init(). This test still runs so that
// future refactors of the gate logic itself are caught.
// ---------------------------------------------------------------------------

func TestAllRegisteredModules_SatisfyGate(t *testing.T) {
	// This test runs against the real globalRegistry populated by init().
	// Any module that slipped through without marker or BuildStateFor will
	// fail here, even if its Register call did not panic (non-strict mode).
	names := RegisteredModules()
	if len(names) == 0 {
		t.Skip("no modules registered in this test binary — skipping")
	}
	for _, name := range names {
		mod, err := CreateModule(name)
		if err != nil {
			t.Errorf("CreateModule(%q): %v", name, err)
			continue
		}
		if err := assertModuleContract(name, mod); err != nil {
			t.Errorf("module %q fails PR-2a gate: %v", name, err)
		}
	}
}
