package template

import (
	"testing"

	// Blank imports to trigger init() module registration.
	_ "github.com/mmp-platform/server/internal/module/communication"
	_ "github.com/mmp-platform/server/internal/module/core"
)

func TestValidate_ValidTemplate(t *testing.T) {
	tmpl := &Template{
		ID:      "test",
		Genre:   "murder_mystery",
		Version: "1.0.0",
		Modules: []TemplateModule{
			{ID: "connection"},
			{ID: "room"},
			{ID: "ready"},
			{ID: "text_chat"},
		},
		Phases: []TemplatePhase{
			{ID: "lobby", Name: "Lobby"},
			{
				ID:   "discussion",
				Name: "Discussion",
				Actions: []TemplateAction{
					{Action: "UNMUTE_CHAT", Target: "text_chat"},
				},
			},
		},
	}

	if err := Validate(tmpl); err != nil {
		t.Fatalf("expected valid template, got: %v", err)
	}
}

func TestValidate_EmptyID(t *testing.T) {
	tmpl := &Template{Genre: "g", Version: "1.0.0",
		Modules: []TemplateModule{{ID: "connection"}},
		Phases:  []TemplatePhase{{ID: "p1", Name: "P1"}},
	}
	err := Validate(tmpl)
	if err == nil {
		t.Fatal("expected error for empty id")
	}
	ve, ok := err.(*ValidationError)
	if !ok {
		t.Fatalf("expected *ValidationError, got %T", err)
	}
	if len(ve.Issues) == 0 {
		t.Error("expected at least one issue")
	}
}

func TestValidate_UnknownModule(t *testing.T) {
	tmpl := &Template{
		ID: "test", Genre: "g", Version: "1.0.0",
		Modules: []TemplateModule{{ID: "nonexistent_module_xyz"}},
		Phases:  []TemplatePhase{{ID: "p1", Name: "P1"}},
	}
	err := Validate(tmpl)
	if err == nil {
		t.Fatal("expected error for unknown module")
	}
}

func TestValidate_DuplicateModule(t *testing.T) {
	tmpl := &Template{
		ID: "test", Genre: "g", Version: "1.0.0",
		Modules: []TemplateModule{{ID: "connection"}, {ID: "connection"}},
		Phases:  []TemplatePhase{{ID: "p1", Name: "P1"}},
	}
	err := Validate(tmpl)
	if err == nil {
		t.Fatal("expected error for duplicate module")
	}
}

func TestValidate_NoModules(t *testing.T) {
	tmpl := &Template{
		ID: "test", Genre: "g", Version: "1.0.0",
		Modules: []TemplateModule{},
		Phases:  []TemplatePhase{{ID: "p1", Name: "P1"}},
	}
	err := Validate(tmpl)
	if err == nil {
		t.Fatal("expected error for no modules")
	}
}

func TestValidate_NoPhases(t *testing.T) {
	tmpl := &Template{
		ID: "test", Genre: "g", Version: "1.0.0",
		Modules: []TemplateModule{{ID: "connection"}},
		Phases:  []TemplatePhase{},
	}
	err := Validate(tmpl)
	if err == nil {
		t.Fatal("expected error for no phases")
	}
}

func TestValidate_ActionTargetNotInTemplate(t *testing.T) {
	tmpl := &Template{
		ID: "test", Genre: "g", Version: "1.0.0",
		Modules: []TemplateModule{{ID: "connection"}},
		Phases: []TemplatePhase{{
			ID:   "p1",
			Name: "P1",
			Actions: []TemplateAction{
				{Action: "MUTE_CHAT", Target: "text_chat"},
			},
		}},
	}
	err := Validate(tmpl)
	if err == nil {
		t.Fatal("expected error for action targeting module not in template")
	}
}

func TestValidate_EmptyModuleID(t *testing.T) {
	tmpl := &Template{
		ID: "test", Genre: "g", Version: "1.0.0",
		Modules: []TemplateModule{{ID: ""}},
		Phases:  []TemplatePhase{{ID: "p1", Name: "P1"}},
	}
	err := Validate(tmpl)
	if err == nil {
		t.Fatal("expected error for empty module id")
	}
}

func TestValidate_EmptyPhaseID(t *testing.T) {
	tmpl := &Template{
		ID: "test", Genre: "g", Version: "1.0.0",
		Modules: []TemplateModule{{ID: "connection"}},
		Phases:  []TemplatePhase{{ID: "", Name: "P1"}},
	}
	err := Validate(tmpl)
	if err == nil {
		t.Fatal("expected error for empty phase id")
	}
}

func TestValidationError_Error(t *testing.T) {
	ve := &ValidationError{Issues: []string{"a", "b"}}
	msg := ve.Error()
	if msg == "" {
		t.Error("expected non-empty error message")
	}
}
