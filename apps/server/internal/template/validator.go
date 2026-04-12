package template

import (
	"fmt"
	"strings"

	"github.com/mmp-platform/server/internal/engine"
)

// ValidationError collects multiple validation issues.
type ValidationError struct {
	Issues []string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("template validation failed: %s", strings.Join(e.Issues, "; "))
}

// Validate checks that a template's modules exist in the registry
// and its phases reference valid actions.
func Validate(tmpl *Template) error {
	var issues []string

	if tmpl.ID == "" {
		issues = append(issues, "id is required")
	}
	if tmpl.Genre == "" {
		issues = append(issues, "genre is required")
	}
	if tmpl.Version == "" {
		issues = append(issues, "version is required")
	}
	if len(tmpl.Modules) == 0 {
		issues = append(issues, "at least one module is required")
	}
	if len(tmpl.Phases) == 0 {
		issues = append(issues, "at least one phase is required")
	}

	// Check each module exists in the registry.
	moduleIDs := make(map[string]bool, len(tmpl.Modules))
	for _, mod := range tmpl.Modules {
		if mod.ID == "" {
			issues = append(issues, "module with empty id")
			continue
		}
		if moduleIDs[mod.ID] {
			issues = append(issues, fmt.Sprintf("duplicate module %q", mod.ID))
			continue
		}
		moduleIDs[mod.ID] = true

		if !engine.HasModule(mod.ID) {
			issues = append(issues, fmt.Sprintf("unknown module %q", mod.ID))
		}
	}

	// Check phase actions reference enabled modules.
	for _, phase := range tmpl.Phases {
		if phase.ID == "" {
			issues = append(issues, "phase with empty id")
		}
		for _, action := range phase.Actions {
			if action.Target != "" && !moduleIDs[action.Target] {
				issues = append(issues, fmt.Sprintf(
					"phase %q action %q targets module %q not in template",
					phase.ID, action.Action, action.Target,
				))
			}
		}
	}

	if len(issues) > 0 {
		return &ValidationError{Issues: issues}
	}
	return nil
}
