package engine

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

// stubModule is a minimal Module implementation for testing.
type stubModule struct {
	name string
}

func (s *stubModule) Name() string { return s.name }
func (s *stubModule) Init(_ context.Context, _ ModuleDeps, _ json.RawMessage) error {
	return nil
}
func (s *stubModule) BuildState() (json.RawMessage, error) {
	return json.Marshal(map[string]string{"name": s.name})
}
func (s *stubModule) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return nil
}
func (s *stubModule) Cleanup(_ context.Context) error { return nil }

func TestCreateModules_EnabledOnly(t *testing.T) {
	// Reset global registry for test isolation.
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{
		"mod_a": func() Module { return &stubModule{name: "mod_a"} },
		"mod_b": func() Module { return &stubModule{name: "mod_b"} },
	}
	defer func() { globalRegistry.factories = origFactories }()

	config := GameConfig{
		Modules: []ModuleConfig{
			{Name: "mod_a", Enabled: true},
			{Name: "mod_b", Enabled: false},
		},
	}

	modules, err := CreateModules(config)
	if err != nil {
		t.Fatal(err)
	}

	if len(modules) != 1 {
		t.Fatalf("expected 1 module, got %d", len(modules))
	}
	if _, ok := modules["mod_a"]; !ok {
		t.Fatal("expected mod_a to be created")
	}
}

func TestCreateModules_UnknownModuleError(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{}
	defer func() { globalRegistry.factories = origFactories }()

	config := GameConfig{
		Modules: []ModuleConfig{
			{Name: "nonexistent", Enabled: true},
		},
	}

	_, err := CreateModules(config)
	if err == nil {
		t.Fatal("expected error for unknown module")
	}
}

func TestRegisteredModules(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{
		"alpha": func() Module { return &stubModule{name: "alpha"} },
		"beta":  func() Module { return &stubModule{name: "beta"} },
	}
	defer func() { globalRegistry.factories = origFactories }()

	names := RegisteredModules()
	if len(names) != 2 {
		t.Fatalf("expected 2, got %d", len(names))
	}
}

func TestHasModule(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{
		"exists": func() Module { return &stubModule{name: "exists"} },
	}
	defer func() { globalRegistry.factories = origFactories }()

	if !HasModule("exists") {
		t.Fatal("expected true")
	}
	if HasModule("nope") {
		t.Fatal("expected false")
	}
}
