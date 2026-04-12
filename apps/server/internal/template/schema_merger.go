package template

import (
	"encoding/json"
	"fmt"

	"github.com/mmp-platform/server/internal/engine"
)

// MergedSchema is the combined JSON Schema for all modules in a template.
type MergedSchema struct {
	TemplateID string                     `json:"templateId"`
	Modules    map[string]json.RawMessage `json:"modules"`
}

// MergeSchemas collects the ConfigSchema from each module in the template
// and returns a single object keyed by module ID.
func MergeSchemas(tmpl *Template) (*MergedSchema, error) {
	result := &MergedSchema{
		TemplateID: tmpl.ID,
		Modules:    make(map[string]json.RawMessage, len(tmpl.Modules)),
	}

	for _, mod := range tmpl.Modules {
		m, err := engine.CreateModule(mod.ID)
		if err != nil {
			return nil, fmt.Errorf("schema_merger: create module %q: %w", mod.ID, err)
		}

		if cs, ok := m.(engine.ConfigSchema); ok {
			schema := cs.Schema()
			if len(schema) > 0 {
				result.Modules[mod.ID] = schema
			}
		}
		// Modules without ConfigSchema are valid — they have no user-facing config.
	}

	return result, nil
}

// MergeSchemasJSON returns the merged schema as raw JSON.
func MergeSchemasJSON(tmpl *Template) (json.RawMessage, error) {
	merged, err := MergeSchemas(tmpl)
	if err != nil {
		return nil, err
	}
	data, err := json.Marshal(merged)
	if err != nil {
		return nil, fmt.Errorf("schema_merger: marshal: %w", err)
	}
	return data, nil
}
