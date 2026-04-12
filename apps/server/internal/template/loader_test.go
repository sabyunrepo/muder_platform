package template

import (
	"testing"
)

func TestLoader_List(t *testing.T) {
	l := NewLoader()
	metas, err := l.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(metas) == 0 {
		t.Fatal("expected at least one template (example.json)")
	}

	found := false
	for _, m := range metas {
		if m.ID == "example" {
			found = true
			if m.Genre != "murder_mystery" {
				t.Errorf("genre = %q, want %q", m.Genre, "murder_mystery")
			}
			if m.Version != "1.0.0" {
				t.Errorf("version = %q, want %q", m.Version, "1.0.0")
			}
		}
	}
	if !found {
		t.Error("example template not found in list")
	}
}

func TestLoader_Load(t *testing.T) {
	l := NewLoader()
	tmpl, err := l.Load("example")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if tmpl.ID != "example" {
		t.Errorf("ID = %q, want %q", tmpl.ID, "example")
	}
	if len(tmpl.Modules) != 4 {
		t.Errorf("modules count = %d, want 4", len(tmpl.Modules))
	}
	if len(tmpl.Phases) != 4 {
		t.Errorf("phases count = %d, want 4", len(tmpl.Phases))
	}
}

func TestLoader_Load_NotFound(t *testing.T) {
	l := NewLoader()
	_, err := l.Load("nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent template")
	}
}

func TestLoader_Idempotent(t *testing.T) {
	l := NewLoader()
	_, _ = l.List()
	_, _ = l.List() // second call should not re-parse

	m1, _ := l.Load("example")
	m2, _ := l.Load("example")
	if m1 != m2 {
		t.Error("expected same pointer on repeated Load")
	}
}

func TestLoadFromBytes(t *testing.T) {
	data := []byte(`{"id":"test","genre":"test","name":"Test","version":"1.0.0","modules":[],"phases":[]}`)
	tmpl, err := LoadFromBytes(data)
	if err != nil {
		t.Fatalf("LoadFromBytes: %v", err)
	}
	if tmpl.ID != "test" {
		t.Errorf("ID = %q, want %q", tmpl.ID, "test")
	}
}

func TestLoadFromBytes_NoID(t *testing.T) {
	data := []byte(`{"genre":"test","name":"Test","version":"1.0.0"}`)
	_, err := LoadFromBytes(data)
	if err == nil {
		t.Error("expected error when id is missing")
	}
}

func TestLoadFromBytes_InvalidJSON(t *testing.T) {
	_, err := LoadFromBytes([]byte(`{invalid`))
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestMetaFrom(t *testing.T) {
	tmpl := &Template{
		ID:          "t1",
		Genre:       "g1",
		Name:        "Test",
		Description: "desc",
		Version:     "2.0.0",
	}
	meta := MetaFrom(tmpl)
	if meta.ID != "t1" || meta.Genre != "g1" || meta.Version != "2.0.0" {
		t.Errorf("MetaFrom mismatch: %+v", meta)
	}
}
