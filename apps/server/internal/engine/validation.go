package engine

import (
	"encoding/json"
	"fmt"
	"strings"
)

// ValidateConfig checks that configJson modules and phases are consistent:
// 1. PhaseActions reference modules that are enabled.
// 2. Mutually exclusive modules aren't both enabled.
// 3. Module dependencies are satisfied.
func ValidateConfig(config GameConfig) error {
	enabled := enabledSet(config.Modules)
	var errs []string

	// 1. Validate PhaseAction → module dependencies
	for _, phase := range config.Phases {
		for _, action := range phase.OnEnter {
			if err := validateAction(action, enabled); err != nil {
				errs = append(errs, fmt.Sprintf("phase %q onEnter: %s", phase.ID, err))
			}
		}
		for _, action := range phase.OnExit {
			if err := validateAction(action, enabled); err != nil {
				errs = append(errs, fmt.Sprintf("phase %q onExit: %s", phase.ID, err))
			}
		}
	}

	// 2. Mutually exclusive groups
	exclusiveGroups := [][]string{
		{"script_progression", "hybrid_progression", "event_progression"},
		{"floor_exploration", "room_based_exploration", "timed_exploration"},
	}
	for _, group := range exclusiveGroups {
		active := activeInGroup(group, enabled)
		if len(active) > 1 {
			errs = append(errs, fmt.Sprintf("mutually exclusive modules enabled: %s", strings.Join(active, ", ")))
		}
	}

	// 3. Module dependencies
	dependencies := map[string][]string{
		"skip_consensus": {"script_progression"},
		"spatial_voice":  {"voice_chat"},
	}
	for mod, deps := range dependencies {
		if !enabled[mod] {
			continue
		}
		for _, dep := range deps {
			if !enabled[dep] {
				errs = append(errs, fmt.Sprintf("module %q requires %q", mod, dep))
			}
		}
	}

	// spatial_voice also requires one exploration module
	if enabled["spatial_voice"] {
		if !enabled["floor_exploration"] && !enabled["room_based_exploration"] {
			errs = append(errs, "module \"spatial_voice\" requires \"floor_exploration\" or \"room_based_exploration\"")
		}
	}

	// 4. gmMode consistency
	switch config.GmMode {
	case "REQUIRED":
		if !enabled["gm_control"] {
			errs = append(errs, "gmMode REQUIRED but gm_control module not enabled")
		}
	case "NONE":
		if enabled["gm_control"] {
			errs = append(errs, "gmMode NONE but gm_control module is enabled")
		}
		if !enabled["consensus_control"] {
			errs = append(errs, "gmMode NONE but consensus_control module not enabled")
		}
	case "OPTIONAL":
		// Both are allowed.
	case "":
		errs = append(errs, "gmMode is required (REQUIRED, NONE, or OPTIONAL)")
	default:
		errs = append(errs, fmt.Sprintf("unknown gmMode %q", config.GmMode))
	}

	// 5. Strategy consistency
	strategyModule := map[string]string{
		"script":  "script_progression",
		"hybrid":  "hybrid_progression",
		"event":   "event_progression",
	}
	if requiredMod, ok := strategyModule[config.Strategy]; ok {
		if !enabled[requiredMod] {
			errs = append(errs, fmt.Sprintf("strategy %q requires module %q", config.Strategy, requiredMod))
		}
	}

	// 6. Media asset reference validation
	if len(config.MediaAssets) > 0 || hasMediaReferences(config) {
		mediaSet := make(map[string]bool, len(config.MediaAssets))
		for _, asset := range config.MediaAssets {
			mediaSet[asset.ID] = true
		}
		for _, phase := range config.Phases {
			if phase.BGMId != "" && !mediaSet[phase.BGMId] {
				errs = append(errs, fmt.Sprintf("phase %q references unknown media %q", phase.ID, phase.BGMId))
			}
			if phase.ReadingSection != nil && phase.ReadingSection.BGMId != "" && !mediaSet[phase.ReadingSection.BGMId] {
				errs = append(errs, fmt.Sprintf("phase %q readingSection references unknown media %q", phase.ID, phase.ReadingSection.BGMId))
			}
			for _, action := range append(append([]PhaseActionPayload{}, phase.OnEnter...), phase.OnExit...) {
				if action.Action != ActionPlayMedia && action.Action != ActionSetBGM {
					continue
				}
				var p struct {
					MediaID string `json:"mediaId"`
				}
				if len(action.Params) == 0 {
					continue
				}
				if err := json.Unmarshal(action.Params, &p); err != nil || p.MediaID == "" {
					continue
				}
				if !mediaSet[p.MediaID] {
					errs = append(errs, fmt.Sprintf("phase %q action %s references unknown media %q", phase.ID, action.Action, p.MediaID))
				}
			}
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("config validation:\n  - %s", strings.Join(errs, "\n  - "))
	}
	return nil
}

// hasMediaReferences reports whether the config contains any media references that
// would require the mediaAssets catalog to be populated.
func hasMediaReferences(config GameConfig) bool {
	for _, phase := range config.Phases {
		if phase.BGMId != "" {
			return true
		}
		if phase.ReadingSection != nil && phase.ReadingSection.BGMId != "" {
			return true
		}
		for _, action := range phase.OnEnter {
			if action.Action == ActionPlayMedia || action.Action == ActionSetBGM {
				return true
			}
		}
		for _, action := range phase.OnExit {
			if action.Action == ActionPlayMedia || action.Action == ActionSetBGM {
				return true
			}
		}
	}
	return false
}

func validateAction(action PhaseActionPayload, enabled map[string]bool) error {
	// LOCK/UNLOCK target a specific module.
	if action.Action == ActionLockModule || action.Action == ActionUnlockModule {
		if action.Target == "" {
			return fmt.Errorf("%s requires a target module", action.Action)
		}
		if !enabled[action.Target] {
			return fmt.Errorf("%s targets disabled module %q", action.Action, action.Target)
		}
		return nil
	}

	requiredModule, ok := ActionRequiresModule[action.Action]
	if !ok {
		return nil // module-independent action
	}
	if !enabled[requiredModule] {
		return fmt.Errorf("action %s requires module %q which is not enabled", action.Action, requiredModule)
	}
	return nil
}

func enabledSet(modules []ModuleConfig) map[string]bool {
	m := make(map[string]bool, len(modules))
	for _, mc := range modules {
		if mc.Enabled {
			m[mc.Name] = true
		}
	}
	return m
}

func activeInGroup(group []string, enabled map[string]bool) []string {
	var active []string
	for _, name := range group {
		if enabled[name] {
			active = append(active, name)
		}
	}
	return active
}
