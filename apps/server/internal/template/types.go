package template

import "encoding/json"

// Template defines a complete game template (genre preset).
// Templates are JSON files embedded at compile time via go:embed.
type Template struct {
	ID          string           `json:"id"`
	Genre       string           `json:"genre"`
	Name        string           `json:"name"`
	Description string           `json:"description,omitempty"`
	Version     string           `json:"version"`
	Modules     []TemplateModule `json:"modules"`
	Phases      []TemplatePhase  `json:"phases"`
}

// TemplateModule declares a module used by the template with its config.
type TemplateModule struct {
	ID     string          `json:"id"`
	Config json.RawMessage `json:"config,omitempty"`
}

// TemplatePhase defines a phase in the game flow.
type TemplatePhase struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"description,omitempty"`
	Duration    int              `json:"duration,omitempty"`
	Actions     []TemplateAction `json:"actions,omitempty"`
}

// TemplateAction is a PhaseAction triggered during a phase transition.
type TemplateAction struct {
	Action string          `json:"action"`
	Target string          `json:"target,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
}

// TemplateMeta is a lightweight summary returned by List().
type TemplateMeta struct {
	ID          string `json:"id"`
	Genre       string `json:"genre"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Version     string `json:"version"`
}

// MetaFrom extracts metadata from a full template.
func MetaFrom(t *Template) TemplateMeta {
	return TemplateMeta{
		ID:          t.ID,
		Genre:       t.Genre,
		Name:        t.Name,
		Description: t.Description,
		Version:     t.Version,
	}
}
