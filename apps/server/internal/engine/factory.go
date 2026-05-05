package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"

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
	Phases           []PhaseDefinition `json:"phases"`
	SceneTransitions []SceneTransition `json:"sceneTransitions,omitempty"`
	Modules          []ModuleConfig    `json:"modules"`
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
		return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "engine: configJson is empty")
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()

	var wire struct {
		Phases           []PhaseDefinition `json:"phases"`
		SceneTransitions []SceneTransition `json:"sceneTransitions,omitempty"`
		Modules          json.RawMessage   `json:"modules"`
	}
	if err := dec.Decode(&wire); err != nil {
		return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "invalid game config: "+err.Error())
	}
	if err := rejectTrailingJSON(dec); err != nil {
		return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "invalid game config: "+err.Error())
	}
	cfg := GameConfig{
		Phases:           wire.Phases,
		SceneTransitions: wire.SceneTransitions,
	}
	modules, err := parseModuleConfigs(wire.Modules)
	if err != nil {
		return nil, err
	}
	cfg.Modules = modules
	if err := ensureImplicitPhaseActionModules(&cfg); err != nil {
		return nil, apperror.BadRequest("invalid phase action config").Wrap(err)
	}
	if len(cfg.Phases) == 0 {
		return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "engine: configJson has no phases")
	}
	if len(cfg.Modules) > maxModulesPerGame {
		return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "too many modules")
	}
	return &cfg, nil
}

func parseModuleConfigs(raw json.RawMessage) ([]ModuleConfig, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var legacy []ModuleConfig
	if err := decodeStrict(raw, &legacy); err == nil {
		seen := make(map[string]struct{}, len(legacy))
		for _, mc := range legacy {
			if mc.Name == "" {
				return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "invalid game modules config: empty module name")
			}
			if _, dup := seen[mc.Name]; dup {
				return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "invalid game modules config: duplicate module name: "+mc.Name)
			}
			seen[mc.Name] = struct{}{}
		}
		return legacy, nil
	}

	type normalizedModuleConfig struct {
		Enabled bool            `json:"enabled"`
		Config  json.RawMessage `json:"config,omitempty"`
	}
	var normalized map[string]normalizedModuleConfig
	if err := decodeStrict(raw, &normalized); err != nil {
		return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "invalid game modules config: "+err.Error())
	}
	names := make([]string, 0, len(normalized))
	for name := range normalized {
		names = append(names, name)
	}
	sort.Strings(names)
	modules := make([]ModuleConfig, 0, len(normalized))
	for _, name := range names {
		if name == "" {
			return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "invalid game modules config: empty module name")
		}
		entry := normalized[name]
		if !entry.Enabled {
			continue
		}
		modules = append(modules, ModuleConfig{Name: name, Config: entry.Config})
	}
	return modules, nil
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

func decodeStrict(raw json.RawMessage, target any) error {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(target); err != nil {
		return err
	}
	return rejectTrailingJSON(dec)
}

func rejectTrailingJSON(dec *json.Decoder) error {
	var trailing any
	if err := dec.Decode(&trailing); err != io.EOF {
		if err == nil {
			return fmt.Errorf("multiple JSON values")
		}
		return err
	}
	return nil
}

func ensureImplicitPhaseActionModules(cfg *GameConfig) error {
	if cfg == nil {
		return nil
	}
	implicitActions := []PhaseAction{
		ActionDeliverInformation,
		ActionEvaluateEnding,
		ActionPlaySound,
		ActionPlayMedia,
		ActionSetBGM,
		ActionStopAudio,
	}
	for _, action := range implicitActions {
		moduleName, ok := ActionRequiresModule[action]
		if !ok || moduleName == "" {
			continue
		}
		usesAction, err := phasesUseAction(cfg.Phases, action)
		if err != nil {
			return err
		}
		if usesAction && !hasModuleConfig(cfg.Modules, moduleName) {
			cfg.Modules = append(cfg.Modules, ModuleConfig{Name: moduleName})
		}
	}
	return nil
}

func phasesUseAction(phases []PhaseDefinition, action PhaseAction) (bool, error) {
	for _, phase := range phases {
		onEnter, err := rawUsesAction(phase.OnEnter, action)
		if err != nil {
			return false, err
		}
		onExit, err := rawUsesAction(phase.OnExit, action)
		if err != nil {
			return false, err
		}
		if onEnter || onExit {
			return true, nil
		}
	}
	return false, nil
}

func rawUsesAction(raw json.RawMessage, action PhaseAction) (bool, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return false, nil
	}
	actions, err := parseConfiguredPhaseActions(raw)
	if err != nil {
		return false, err
	}
	for _, candidate := range actions {
		if candidate.Action == action {
			return true, nil
		}
	}
	return false, nil
}

func hasModuleConfig(modules []ModuleConfig, name string) bool {
	for _, module := range modules {
		if module.Name == name {
			return true
		}
	}
	return false
}
