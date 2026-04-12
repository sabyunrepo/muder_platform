package engine

import (
	"testing"
)

func TestCreateModule_Success(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{
		"mod_a": func() Module { return &stubCoreModule{name: "mod_a"} },
	}
	defer func() { globalRegistry.factories = origFactories }()

	mod, err := CreateModule("mod_a")
	if err != nil {
		t.Fatal(err)
	}
	if mod.Name() != "mod_a" {
		t.Fatalf("expected mod_a, got %s", mod.Name())
	}
}

func TestCreateModule_UnknownError(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{}
	defer func() { globalRegistry.factories = origFactories }()

	_, err := CreateModule("nonexistent")
	if err == nil {
		t.Fatal("expected error for unknown module")
	}
}

func TestCreateModulesBatch_Success(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{
		"mod_a": func() Module { return &stubCoreModule{name: "mod_a"} },
		"mod_b": func() Module { return &stubCoreModule{name: "mod_b"} },
	}
	defer func() { globalRegistry.factories = origFactories }()

	modules, err := CreateModulesBatch([]string{"mod_a", "mod_b"})
	if err != nil {
		t.Fatal(err)
	}
	if len(modules) != 2 {
		t.Fatalf("expected 2 modules, got %d", len(modules))
	}
}

func TestCreateModulesBatch_UnknownError(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{}
	defer func() { globalRegistry.factories = origFactories }()

	_, err := CreateModulesBatch([]string{"nonexistent"})
	if err == nil {
		t.Fatal("expected error for unknown module")
	}
}

func TestRegisteredModules(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{
		"alpha": func() Module { return &stubCoreModule{name: "alpha"} },
		"beta":  func() Module { return &stubCoreModule{name: "beta"} },
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
		"exists": func() Module { return &stubCoreModule{name: "exists"} },
	}
	defer func() { globalRegistry.factories = origFactories }()

	if !HasModule("exists") {
		t.Fatal("expected true")
	}
	if HasModule("nope") {
		t.Fatal("expected false")
	}
}
