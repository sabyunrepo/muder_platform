package engine_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// stubModule is a minimal Module used in factory tests.
type stubModule struct{ name string }

func (s *stubModule) Name() string { return s.name }
func (s *stubModule) Init(_ context.Context, _ engine.ModuleDeps, _ json.RawMessage) error {
	return nil
}
func (s *stubModule) BuildState() (json.RawMessage, error) { return json.RawMessage(`{}`), nil }
func (s *stubModule) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return nil
}
func (s *stubModule) Cleanup(_ context.Context) error { return nil }

func TestParseGameConfig_Valid(t *testing.T) {
	raw, _ := json.Marshal(map[string]any{
		"phases":  []map[string]any{{"id": "p1", "name": "Phase 1"}},
		"modules": []map[string]any{{"name": "mod_a"}},
	})
	cfg, err := engine.ParseGameConfig(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Phases) != 1 {
		t.Errorf("phases: want 1, got %d", len(cfg.Phases))
	}
	if len(cfg.Modules) != 1 {
		t.Errorf("modules: want 1, got %d", len(cfg.Modules))
	}
}

func TestParseGameConfig_Empty(t *testing.T) {
	_, err := engine.ParseGameConfig(nil)
	if err == nil {
		t.Fatal("expected error for nil input")
	}
}

func TestParseGameConfig_NoPhases(t *testing.T) {
	raw, _ := json.Marshal(map[string]any{
		"phases":  []any{},
		"modules": []any{},
	})
	_, err := engine.ParseGameConfig(raw)
	if err == nil {
		t.Fatal("expected error for empty phases")
	}
}

func TestBuildModules_UnknownModule(t *testing.T) {
	cfg := &engine.GameConfig{
		Phases: []engine.PhaseDefinition{{ID: "p1", Name: "P1"}},
		Modules: []engine.ModuleConfig{
			{Name: "not_registered_xyz"},
		},
	}
	deps := engine.ModuleDeps{SessionID: uuid.New()}
	_, _, err := engine.BuildModules(context.Background(), cfg, deps)
	if err == nil {
		t.Fatal("expected error for unknown module")
	}
}

func TestBuildModules_DuplicateModule(t *testing.T) {
	// Register a temp factory only for this test.
	// We can't easily clean up global registry, so use a unique name.
	engine.Register("dup_test_mod_"+t.Name(), func() engine.Module {
		return &stubModule{name: "dup_test_mod_" + t.Name()}
	})

	cfg := &engine.GameConfig{
		Phases: []engine.PhaseDefinition{{ID: "p1", Name: "P1"}},
		Modules: []engine.ModuleConfig{
			{Name: "dup_test_mod_" + t.Name()},
			{Name: "dup_test_mod_" + t.Name()},
		},
	}
	deps := engine.ModuleDeps{SessionID: uuid.New()}
	_, _, err := engine.BuildModules(context.Background(), cfg, deps)
	if err == nil {
		t.Fatal("expected error for duplicate module name in config")
	}
}

func TestBuildModules_EmptyName(t *testing.T) {
	cfg := &engine.GameConfig{
		Phases: []engine.PhaseDefinition{{ID: "p1", Name: "P1"}},
		Modules: []engine.ModuleConfig{
			{Name: ""},
		},
	}
	deps := engine.ModuleDeps{SessionID: uuid.New()}
	_, _, err := engine.BuildModules(context.Background(), cfg, deps)
	if err == nil {
		t.Fatal("expected error for empty module name")
	}
}
