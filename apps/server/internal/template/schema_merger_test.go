package template

import (
	"encoding/json"
	"testing"

	_ "github.com/mmp-platform/server/internal/module/communication"
	_ "github.com/mmp-platform/server/internal/module/core"
)

func TestMergeSchemas(t *testing.T) {
	tmpl := &Template{
		ID: "test",
		Modules: []TemplateModule{
			{ID: "text_chat"},
			{ID: "ready"},
			{ID: "connection"}, // no ConfigSchema
		},
	}

	merged, err := MergeSchemas(tmpl)
	if err != nil {
		t.Fatalf("MergeSchemas: %v", err)
	}

	if merged.TemplateID != "test" {
		t.Errorf("TemplateID = %q, want %q", merged.TemplateID, "test")
	}

	// text_chat has ConfigSchema, so it should be present.
	if _, ok := merged.Modules["text_chat"]; !ok {
		t.Error("expected text_chat schema in merged result")
	}

	// connection has no ConfigSchema, so it should be absent.
	if _, ok := merged.Modules["connection"]; ok {
		t.Error("connection should not have a schema (no ConfigSchema)")
	}
}

func TestMergeSchemas_UnknownModule(t *testing.T) {
	tmpl := &Template{
		ID:      "test",
		Modules: []TemplateModule{{ID: "nonexistent_xyz"}},
	}
	_, err := MergeSchemas(tmpl)
	if err == nil {
		t.Error("expected error for unknown module")
	}
}

func TestMergeSchemasJSON(t *testing.T) {
	tmpl := &Template{
		ID: "test",
		Modules: []TemplateModule{
			{ID: "text_chat"},
		},
	}

	data, err := MergeSchemasJSON(tmpl)
	if err != nil {
		t.Fatalf("MergeSchemasJSON: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("result is not valid JSON: %v", err)
	}

	if parsed["templateId"] != "test" {
		t.Errorf("templateId = %v, want %q", parsed["templateId"], "test")
	}

	modules, ok := parsed["modules"].(map[string]any)
	if !ok {
		t.Fatal("modules should be an object")
	}
	if _, ok := modules["text_chat"]; !ok {
		t.Error("expected text_chat in modules")
	}
}

func TestMergeSchemas_EmptyModules(t *testing.T) {
	tmpl := &Template{
		ID:      "test",
		Modules: []TemplateModule{},
	}
	merged, err := MergeSchemas(tmpl)
	if err != nil {
		t.Fatalf("MergeSchemas: %v", err)
	}
	if len(merged.Modules) != 0 {
		t.Errorf("expected 0 modules, got %d", len(merged.Modules))
	}
}
