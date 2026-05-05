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

func TestParseGameConfig_PreservesSceneTransitions(t *testing.T) {
	data := []byte(`{"phases":[{"id":"intro","name":"Intro"},{"id":"invest","name":"Invest"}],"sceneTransitions":[{"id":"edge-1","from":"intro","to":"invest","label":"조사 시작","sortOrder":2}],"modules":[]}`)
	cfg, err := ParseGameConfig(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.SceneTransitions) != 1 {
		t.Fatalf("expected 1 scene transition, got %d", len(cfg.SceneTransitions))
	}
	transition := cfg.SceneTransitions[0]
	if transition.ID != "edge-1" || transition.From != "intro" || transition.To != "invest" || transition.SortOrder != 2 {
		t.Fatalf("scene transition = %#v", transition)
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

func TestParseGameConfig_AddsInformationDeliveryModuleForLegacyPhaseAction(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1","onEnter":[{"type":"deliver_information","params":{"deliveries":[]}}]}],"modules":[]}`)
	cfg, err := ParseGameConfig(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Modules) != 1 || cfg.Modules[0].Name != "information_delivery" {
		t.Fatalf("implicit modules = %#v", cfg.Modules)
	}
}

func TestParseGameConfig_AddsEndingBranchModuleForEvaluateEndingAction(t *testing.T) {
	data := []byte(`{"phases":[{"id":"final","name":"Final","onEnter":[{"type":"EVALUATE_ENDING"}]}],"modules":[]}`)
	cfg, err := ParseGameConfig(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Modules) != 1 || cfg.Modules[0].Name != "ending_branch" {
		t.Fatalf("implicit modules = %#v", cfg.Modules)
	}
}

func TestParseGameConfig_DoesNotDuplicateImplicitEndingBranchModule(t *testing.T) {
	data := []byte(`{"phases":[{"id":"final","name":"Final","onEnter":[{"type":"EVALUATE_ENDING"}]}],"modules":[{"name":"ending_branch","config":{"defaultEnding":"미해결"}}]}`)
	cfg, err := ParseGameConfig(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Modules) != 1 || cfg.Modules[0].Name != "ending_branch" {
		t.Fatalf("modules = %#v", cfg.Modules)
	}
}

func TestParseGameConfig_AddsGroupChatModuleForDiscussionRoomPolicy(t *testing.T) {
	data := []byte(`{"phases":[{"id":"discussion","name":"Discussion","discussionRoomPolicy":{"enabled":true,"mainRoomName":"추리 회의"}}],"modules":[]}`)
	cfg, err := ParseGameConfig(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Modules) != 1 || cfg.Modules[0].Name != "group_chat" {
		t.Fatalf("implicit modules = %#v", cfg.Modules)
	}
	if cfg.Phases[0].DiscussionRoomPolicy == nil || cfg.Phases[0].DiscussionRoomPolicy.MainRoomName != "추리 회의" {
		t.Fatalf("discussion room policy = %#v", cfg.Phases[0].DiscussionRoomPolicy)
	}
}

func TestParseGameConfig_InvalidPhaseActionConfigFailsEarly(t *testing.T) {
	data := []byte(`{"phases":[{"id":"p1","name":"Phase 1","onEnter":"not-actions"}],"modules":[]}`)
	_, err := ParseGameConfig(data)
	if err == nil {
		t.Fatal("expected invalid phase action config error")
	}
}
