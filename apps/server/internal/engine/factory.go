package engine

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/mmp-platform/server/internal/apperror"
)

// maxModulesPerGame is the maximum number of modules allowed per game config.
const maxModulesPerGame = 50

// GameConfig is the top-level structure parsed from theme config_json.
// It describes which modules are enabled and their per-module settings.
type GameConfig struct {
	Modules []ModuleConfig `json:"modules"`
}

// ModuleConfig describes a single module entry in the game config.
type ModuleConfig struct {
	Name   string          `json:"name"`
	Config json.RawMessage `json:"config,omitempty"`
}

// HostSubmittable is an optional interface for modules that can be submitted
// by a host when starting a game. Modules that are admin-only should return false.
// By default (interface not implemented), all registered modules are submittable.
type HostSubmittable interface {
	IsHostSubmittable() bool
}

// ParseGameConfig decodes config_json from a theme into a GameConfig.
// It rejects unknown fields and enforces the module count limit.
func ParseGameConfig(data []byte) (*GameConfig, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()

	var cfg GameConfig
	if err := dec.Decode(&cfg); err != nil {
		return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "invalid game config: "+err.Error())
	}

	if len(cfg.Modules) > maxModulesPerGame {
		return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "too many modules")
	}

	return &cfg, nil
}

// BuildModules instantiates modules from a GameConfig, applying the
// HostSubmittable blocklist check. Unknown or blocked modules return an error.
func BuildModules(cfg *GameConfig) ([]Module, error) {
	modules := make([]Module, 0, len(cfg.Modules))
	for _, mc := range cfg.Modules {
		mod, err := CreateModule(mc.Name)
		if err != nil {
			return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "unknown module: "+mc.Name)
		}
		if hs, ok := mod.(HostSubmittable); ok && !hs.IsHostSubmittable() {
			return nil, apperror.New(apperror.ErrForbidden, http.StatusForbidden, "module not host-submittable: "+mc.Name)
		}
		modules = append(modules, mod)
	}
	return modules, nil
}
