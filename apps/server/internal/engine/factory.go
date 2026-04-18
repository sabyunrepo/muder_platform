package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mmp-platform/server/internal/apperror"
)

// maxModulesPerGame is the maximum number of modules allowed per game config.
// Enforced at parse time to bound DoS surface from host-submitted config.
const maxModulesPerGame = 50

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

// HostSubmittable is an optional interface for modules that can be submitted
// by a host when starting a game. Modules that are admin-only should return false.
// By default (interface not implemented), all registered modules are submittable.
type HostSubmittable interface {
	IsHostSubmittable() bool
}

// ParseGameConfig unmarshals a configJson blob into a GameConfig.
// Rejects unknown fields and enforces maxModulesPerGame.
func ParseGameConfig(raw json.RawMessage) (*GameConfig, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("engine: configJson is empty")
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()

	var cfg GameConfig
	if err := dec.Decode(&cfg); err != nil {
		return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "invalid game config: "+err.Error())
	}
	if len(cfg.Phases) == 0 {
		return nil, fmt.Errorf("engine: configJson has no phases")
	}
	if len(cfg.Modules) > maxModulesPerGame {
		return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "too many modules")
	}
	return &cfg, nil
}

// BuildModules instantiates and initialises modules declared in cfg.
// Modules are created in the order listed in cfg.Modules (the editor is
// responsible for dependency-sorted ordering). Enforces HostSubmittable blocklist.
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
			return nil, nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "unknown module: "+mc.Name)
		}
		// PR-2a / Phase 19.1 PR-A runtime gate: reject modules that slipped
		// past Register() (e.g. tests that inject factories into
		// globalRegistry directly). Always enforced — the env-driven fallback
		// was retired once all modules achieved compliance.
		if err := assertModuleContract(mc.Name, mod); err != nil {
			return nil, nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, err.Error())
		}
		if hs, ok := mod.(HostSubmittable); ok && !hs.IsHostSubmittable() {
			return nil, nil, apperror.New(apperror.ErrForbidden, http.StatusForbidden, "module not host-submittable: "+mc.Name)
		}
		modules = append(modules, mod)
		configs[mc.Name] = mc.Config
	}
	return modules, configs, nil
}
