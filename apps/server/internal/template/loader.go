package template

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"strings"
	"sync"
)

//go:embed all:presets
var presetsFS embed.FS

// Loader loads and caches templates from the embedded presets directory.
type Loader struct {
	mu        sync.RWMutex
	templates map[string]*Template
	metas     []TemplateMeta
	loaded    bool
}

// NewLoader creates a new template loader.
func NewLoader() *Loader {
	return &Loader{
		templates: make(map[string]*Template),
	}
}

// loadAll parses all embedded JSON files recursively. Called lazily on first access.
func (l *Loader) loadAll() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.loaded {
		return nil
	}

	err := fs.WalkDir(presetsFS, "presets", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(d.Name(), ".json") {
			return err
		}

		data, err := presetsFS.ReadFile(path)
		if err != nil {
			return fmt.Errorf("template: read %s: %w", path, err)
		}

		var tmpl Template
		if err := json.Unmarshal(data, &tmpl); err != nil {
			return fmt.Errorf("template: parse %s: %w", path, err)
		}

		if tmpl.ID == "" {
			tmpl.ID = strings.TrimSuffix(d.Name(), ".json")
		}

		l.templates[tmpl.ID] = &tmpl
		l.metas = append(l.metas, MetaFrom(&tmpl))
		return nil
	})
	if err != nil {
		l.loaded = true
		return err
	}

	l.loaded = true
	return nil
}

// Load returns a template by ID.
func (l *Loader) Load(id string) (*Template, error) {
	if err := l.loadAll(); err != nil {
		return nil, err
	}

	l.mu.RLock()
	defer l.mu.RUnlock()

	tmpl, ok := l.templates[id]
	if !ok {
		return nil, fmt.Errorf("template: %q not found", id)
	}
	return tmpl, nil
}

// List returns metadata for all available templates.
func (l *Loader) List() ([]TemplateMeta, error) {
	if err := l.loadAll(); err != nil {
		return nil, err
	}

	l.mu.RLock()
	defer l.mu.RUnlock()

	result := make([]TemplateMeta, len(l.metas))
	copy(result, l.metas)
	return result, nil
}

// LoadFromBytes parses a template from raw JSON (for testing / dynamic templates).
func LoadFromBytes(data []byte) (*Template, error) {
	var tmpl Template
	if err := json.Unmarshal(data, &tmpl); err != nil {
		return nil, fmt.Errorf("template: parse: %w", err)
	}
	if tmpl.ID == "" {
		return nil, fmt.Errorf("template: id is required")
	}
	return &tmpl, nil
}
