package engine

import (
	"context"
	"encoding/json"
	"fmt"
)

// ModuleConfig is one entry from the configJson "modules" array.
type ModuleConfig struct {
	// Name must match a registered ModuleFactory key.
	Name string `json:"name"`
	// Config is the module-specific configuration passed to Module.Init.
	Config json.RawMessage `json:"config,omitempty"`
}

// GameConfig is the parsed representation of a scenario configJson.
// Only the fields needed for runtime wiring are declared here;
// additional editor-only fields are ignored.
type GameConfig struct {
	Phases  []PhaseDefinition `json:"phases"`
	Modules []ModuleConfig    `json:"modules"`
}

// ParseGameConfig unmarshals a configJson blob into a GameConfig.
func ParseGameConfig(raw json.RawMessage) (*GameConfig, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("engine: configJson is empty")
	}
	var cfg GameConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("engine: failed to parse configJson: %w", err)
	}
	if len(cfg.Phases) == 0 {
		return nil, fmt.Errorf("engine: configJson has no phases")
	}
	return &cfg, nil
}

// BuildModules instantiates and initialises modules declared in cfg.
// Modules are created in the order listed in cfg.Modules (the editor is
// responsible for dependency-sorted ordering).
// Returns the ordered module list and a map of name→rawConfig for PhaseEngine.Start.
func BuildModules(
	ctx context.Context,
	cfg *GameConfig,
	deps ModuleDeps,
) ([]Module, map[string]json.RawMessage, error) {
	modules := make([]Module, 0, len(cfg.Modules))
	configs := make(map[string]json.RawMessage, len(cfg.Modules))

	seen := make(map[string]struct{}, len(cfg.Modules))
	for _, mc := range cfg.Modules {
		if mc.Name == "" {
			return nil, nil, fmt.Errorf("engine: module entry has empty name")
		}
		if _, dup := seen[mc.Name]; dup {
			return nil, nil, fmt.Errorf("engine: duplicate module %q in configJson", mc.Name)
		}
		seen[mc.Name] = struct{}{}

		mod, err := CreateModule(mc.Name)
		if err != nil {
			return nil, nil, fmt.Errorf("engine: %w", err)
		}
		modules = append(modules, mod)
		configs[mc.Name] = mc.Config
	}
	return modules, configs, nil
}
