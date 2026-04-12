package template

import (
	"testing"

	// Blank imports to register all modules used in presets.
	_ "github.com/mmp-platform/server/internal/module/communication"
	_ "github.com/mmp-platform/server/internal/module/core"
	_ "github.com/mmp-platform/server/internal/module/cluedist"
	_ "github.com/mmp-platform/server/internal/module/decision"
	_ "github.com/mmp-platform/server/internal/module/exploration"
	_ "github.com/mmp-platform/server/internal/module/media"
	_ "github.com/mmp-platform/server/internal/module/progression"
)

func TestPresets_AllLoadSuccessfully(t *testing.T) {
	l := NewLoader()
	metas, err := l.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}

	// We expect at least 9 presets across 4 genres + 1 example.
	if len(metas) < 10 {
		t.Fatalf("expected at least 10 presets, got %d", len(metas))
	}

	for _, meta := range metas {
		tmpl, err := l.Load(meta.ID)
		if err != nil {
			t.Errorf("Load(%q): %v", meta.ID, err)
			continue
		}

		if tmpl.ID == "" {
			t.Errorf("preset %q: ID is empty", meta.ID)
		}
		if tmpl.Genre == "" {
			t.Errorf("preset %q: Genre is empty", meta.ID)
		}
		if tmpl.Version == "" {
			t.Errorf("preset %q: Version is empty", meta.ID)
		}
		if tmpl.Name == "" {
			t.Errorf("preset %q: Name is empty", meta.ID)
		}
		if len(tmpl.Modules) == 0 {
			t.Errorf("preset %q: no modules", meta.ID)
		}
		if len(tmpl.Phases) == 0 {
			t.Errorf("preset %q: no phases", meta.ID)
		}
	}
}

func TestPresets_AllValidate(t *testing.T) {
	l := NewLoader()
	metas, err := l.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}

	for _, meta := range metas {
		tmpl, err := l.Load(meta.ID)
		if err != nil {
			t.Errorf("Load(%q): %v", meta.ID, err)
			continue
		}

		if err := Validate(tmpl); err != nil {
			t.Errorf("Validate(%q): %v", meta.ID, err)
		}
	}
}

func TestPresets_AllSchemaMerge(t *testing.T) {
	l := NewLoader()
	metas, err := l.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}

	for _, meta := range metas {
		tmpl, err := l.Load(meta.ID)
		if err != nil {
			t.Errorf("Load(%q): %v", meta.ID, err)
			continue
		}

		merged, err := MergeSchemas(tmpl)
		if err != nil {
			t.Errorf("MergeSchemas(%q): %v", meta.ID, err)
			continue
		}

		if merged.TemplateID != tmpl.ID {
			t.Errorf("MergeSchemas(%q): templateId = %q, want %q", meta.ID, merged.TemplateID, tmpl.ID)
		}
	}
}

func TestPresets_GenreCoverage(t *testing.T) {
	l := NewLoader()
	metas, err := l.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}

	genres := make(map[string]int)
	for _, meta := range metas {
		genres[meta.Genre]++
	}

	expected := map[string]int{
		"murder_mystery": 3,
		"crime_scene":    2,
		"script_kill":    2,
		"jubensha":       2,
	}

	for genre, minCount := range expected {
		if genres[genre] < minCount {
			t.Errorf("genre %q: expected at least %d presets, got %d", genre, minCount, genres[genre])
		}
	}
}
