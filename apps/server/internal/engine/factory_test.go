package engine

import (
	"context"
	"strings"
	"testing"
)

func TestParseGameConfig_Valid(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1"}],"modules":[{"name":"clue_interaction","config":{}}]}`)
	cfg, err := ParseGameConfig(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Modules) != 1 {
		t.Fatalf("expected 1 module, got %d", len(cfg.Modules))
	}
	if cfg.Modules[0].Name != "clue_interaction" {
		t.Fatalf("unexpected module name: %s", cfg.Modules[0].Name)
	}
}

func TestParseGameConfig_Empty(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1"}],"modules":[]}`)
	cfg, err := ParseGameConfig(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Modules) != 0 {
		t.Fatalf("expected 0 modules, got %d", len(cfg.Modules))
	}
}

func TestParseGameConfig_UnknownField(t *testing.T) {
	data := []byte(`{"modules":[],"evil_field":"injection"}`)
	_, err := ParseGameConfig(data)
	if err == nil {
		t.Fatal("expected error for unknown field, got nil")
	}
}

func TestParseGameConfig_RejectsTrailingJSON(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1"}],"modules":[]}{"extra":1}`)
	_, err := ParseGameConfig(data)
	if err == nil {
		t.Fatal("expected trailing JSON error")
	}
}

func TestParseGameConfig_TooManyModules(t *testing.T) {
	// Build a config with 51 modules.
	entries := make([]string, 51)
	for i := range entries {
		entries[i] = `{"name":"mod"}`
	}
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1"}],"modules":[` + strings.Join(entries, ",") + `]}`)
	_, err := ParseGameConfig(data)
	if err == nil {
		t.Fatal("expected error for >50 modules, got nil")
	}
}

func TestParseGameConfig_InvalidJSON(t *testing.T) {
	_, err := ParseGameConfig([]byte(`not json`))
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
}

func TestBuildModules_Success(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{
		"test_mod": func() Module { return &stubCoreModule{name: "test_mod"} },
	}
	defer func() { globalRegistry.factories = origFactories }()

	cfg := &GameConfig{
		Modules: []ModuleConfig{{Name: "test_mod"}},
	}
	mods, _, err := BuildModules(context.Background(), cfg, ModuleDeps{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mods) != 1 {
		t.Fatalf("expected 1 module, got %d", len(mods))
	}
}

func TestBuildModules_UnknownModule(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{}
	defer func() { globalRegistry.factories = origFactories }()

	cfg := &GameConfig{
		Modules: []ModuleConfig{{Name: "nonexistent"}},
	}
	_, _, err := BuildModules(context.Background(), cfg, ModuleDeps{})
	if err == nil {
		t.Fatal("expected error for unknown module, got nil")
	}
}

// blockedModule implements HostSubmittable returning false (admin-only).
type blockedModule struct{ stubCoreModule }

func (b *blockedModule) IsHostSubmittable() bool { return false }

func TestBuildModules_BlockedModule(t *testing.T) {
	origFactories := globalRegistry.factories
	globalRegistry.factories = map[string]ModuleFactory{
		"admin_mod": func() Module { return &blockedModule{stubCoreModule{name: "admin_mod"}} },
	}
	defer func() { globalRegistry.factories = origFactories }()

	cfg := &GameConfig{
		Modules: []ModuleConfig{{Name: "admin_mod"}},
	}
	_, _, err := BuildModules(context.Background(), cfg, ModuleDeps{})
	if err == nil {
		t.Fatal("expected error for blocked module, got nil")
	}
}

func TestParseGameConfig_NormalizedModulesMap(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1"}],"modules":{"information_delivery":{"enabled":true,"config":{"note":"ok"}},"disabled_mod":{"enabled":false}}}`)
	cfg, err := ParseGameConfig(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Modules) != 1 {
		t.Fatalf("expected 1 enabled module, got %d", len(cfg.Modules))
	}
	if cfg.Modules[0].Name != "information_delivery" {
		t.Fatalf("module name = %q", cfg.Modules[0].Name)
	}
	if string(cfg.Modules[0].Config) != `{"note":"ok"}` {
		t.Fatalf("module config = %s", cfg.Modules[0].Config)
	}
}

func TestParseGameConfig_NormalizedModulesRejectsEmptyModuleName(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1"}],"modules":{"":{"enabled":true}}}`)
	_, err := ParseGameConfig(data)
	if err == nil {
		t.Fatal("expected empty normalized module name error")
	}
}

func TestParseGameConfig_NormalizedModulesRejectsUnknownEnvelopeField(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1"}],"modules":{"information_delivery":{"enabled":true,"confg":{}}}}`)
	_, err := ParseGameConfig(data)
	if err == nil {
		t.Fatal("expected unknown normalized module field error")
	}
}

func TestParseGameConfig_LegacyModulesRejectsEmptyModuleName(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1"}],"modules":[{"name":""}]}`)
	_, err := ParseGameConfig(data)
	if err == nil {
		t.Fatal("expected empty legacy module name error")
	}
}

func TestParseGameConfig_LegacyModulesRejectsDuplicateModuleName(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1"}],"modules":[{"name":"information_delivery"},{"name":"information_delivery"}]}`)
	_, err := ParseGameConfig(data)
	if err == nil {
		t.Fatal("expected duplicate legacy module name error")
	}
}

func TestParseGameConfig_LegacyModulesRejectsUnknownEnvelopeField(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1"}],"modules":[{"name":"information_delivery","enabled":true}]}`)
	_, err := ParseGameConfig(data)
	if err == nil {
		t.Fatal("expected unknown legacy module field error")
	}
}

func TestParseGameConfig_AddsInformationDeliveryModuleForPhaseAction(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1","onEnter":[{"type":"DELIVER_INFORMATION","params":{"deliveries":[]}}]}],"modules":[]}`)
	cfg, err := ParseGameConfig(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Modules) != 1 || cfg.Modules[0].Name != "information_delivery" {
		t.Fatalf("implicit modules = %#v", cfg.Modules)
	}
}

func TestParseGameConfig_InvalidPhaseActionConfigFailsEarly(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1","onEnter":"not-actions"}],"modules":[]}`)
	_, err := ParseGameConfig(data)
	if err == nil {
		t.Fatal("expected invalid phase action config error")
	}
}
