package template

import (
	"embed"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
)

//go:embed presets/*.json
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

// loadAll parses all embedded JSON files. Called lazily on first access.
func (l *Loader) loadAll() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.loaded {
		return nil
	}

	entries, err := presetsFS.ReadDir("presets")
	if err != nil {
		l.loaded = true
		return nil // empty presets dir is valid
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		data, err := presetsFS.ReadFile(filepath.Join("presets", entry.Name()))
		if err != nil {
			return fmt.Errorf("template: read %s: %w", entry.Name(), err)
		}

		var tmpl Template
		if err := json.Unmarshal(data, &tmpl); err != nil {
			return fmt.Errorf("template: parse %s: %w", entry.Name(), err)
		}

		if tmpl.ID == "" {
			tmpl.ID = strings.TrimSuffix(entry.Name(), ".json")
		}

		l.templates[tmpl.ID] = &tmpl
		l.metas = append(l.metas, MetaFrom(&tmpl))
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
