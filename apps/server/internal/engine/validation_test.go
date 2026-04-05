package engine

import (
	"strings"
	"testing"
)

func TestValidateConfig_Valid(t *testing.T) {
	config := GameConfig{
		Strategy: "script",
		GmMode:   "REQUIRED",
		Phases: []PhaseConfig{
			{
				ID: "p1", Name: "Phase 1", Type: "discussion",
				OnEnter: []PhaseActionPayload{
					{Action: ActionOpenVoting},
				},
			},
		},
		Modules: []ModuleConfig{
			{Name: "script_progression", Enabled: true},
			{Name: "voting", Enabled: true},
			{Name: "gm_control", Enabled: true},
		},
	}

	if err := ValidateConfig(config); err != nil {
		t.Fatalf("expected valid, got: %v", err)
	}
}

func TestValidateConfig_EmptyGmMode(t *testing.T) {
	config := GameConfig{
		Strategy: "script",
		GmMode:   "",
		Phases:   []PhaseConfig{{ID: "p1"}},
		Modules: []ModuleConfig{
			{Name: "script_progression", Enabled: true},
		},
	}
	err := ValidateConfig(config)
	if err == nil || !strings.Contains(err.Error(), "gmMode is required") {
		t.Fatalf("expected gmMode required error, got: %v", err)
	}
}

func TestValidateConfig_MissingActionModule(t *testing.T) {
	config := GameConfig{
		Strategy: "script",
		GmMode:   "OPTIONAL",
		Phases: []PhaseConfig{
			{
				ID: "p1", Name: "Phase 1", Type: "discussion",
				OnEnter: []PhaseActionPayload{
					{Action: ActionOpenVoting}, // voting not enabled
				},
			},
		},
		Modules: []ModuleConfig{
			{Name: "script_progression", Enabled: true},
		},
	}

	err := ValidateConfig(config)
	if err == nil {
		t.Fatal("expected error for missing voting module")
	}
	if !strings.Contains(err.Error(), "voting") {
		t.Fatalf("expected 'voting' in error, got: %v", err)
	}
}

func TestValidateConfig_MutuallyExclusive(t *testing.T) {
	config := GameConfig{
		Strategy: "script",
		GmMode:   "OPTIONAL",
		Phases:   []PhaseConfig{{ID: "p1"}},
		Modules: []ModuleConfig{
			{Name: "script_progression", Enabled: true},
			{Name: "floor_exploration", Enabled: true},
			{Name: "room_based_exploration", Enabled: true}, // conflict
		},
	}

	err := ValidateConfig(config)
	if err == nil {
		t.Fatal("expected error for mutually exclusive modules")
	}
	if !strings.Contains(err.Error(), "mutually exclusive") {
		t.Fatalf("expected 'mutually exclusive' in error, got: %v", err)
	}
}

func TestValidateConfig_DependencyMissing(t *testing.T) {
	config := GameConfig{
		Strategy: "script",
		GmMode:   "OPTIONAL",
		Phases:   []PhaseConfig{{ID: "p1"}},
		Modules: []ModuleConfig{
			{Name: "script_progression", Enabled: true},
			{Name: "skip_consensus", Enabled: true},
			// script_progression is enabled, so skip_consensus dep is met
		},
	}

	// This should pass since script_progression is enabled.
	if err := ValidateConfig(config); err != nil {
		t.Fatalf("expected valid, got: %v", err)
	}

	// Now remove the dependency.
	config.Modules = []ModuleConfig{
		{Name: "hybrid_progression", Enabled: true},
		{Name: "skip_consensus", Enabled: true}, // needs script_progression
	}
	config.Strategy = "hybrid"
	config.GmMode = "OPTIONAL"

	err := ValidateConfig(config)
	if err == nil {
		t.Fatal("expected error for missing dependency")
	}
	if !strings.Contains(err.Error(), "requires") {
		t.Fatalf("expected 'requires' in error, got: %v", err)
	}
}

func TestValidateConfig_GmModeConsistency(t *testing.T) {
	// REQUIRED but no gm_control
	config := GameConfig{
		Strategy: "script",
		GmMode:   "REQUIRED",
		Phases:   []PhaseConfig{{ID: "p1"}},
		Modules: []ModuleConfig{
			{Name: "script_progression", Enabled: true},
		},
	}
	err := ValidateConfig(config)
	if err == nil || !strings.Contains(err.Error(), "gm_control") {
		t.Fatalf("expected gm_control error, got: %v", err)
	}

	// NONE but gm_control enabled
	config.GmMode = "NONE"
	config.Modules = []ModuleConfig{
		{Name: "script_progression", Enabled: true},
		{Name: "gm_control", Enabled: true},
		{Name: "consensus_control", Enabled: true},
	}
	err = ValidateConfig(config)
	if err == nil || !strings.Contains(err.Error(), "NONE") {
		t.Fatalf("expected NONE/gm_control conflict error, got: %v", err)
	}
}

func TestValidateConfig_StrategyModuleMismatch(t *testing.T) {
	config := GameConfig{
		Strategy: "hybrid",
		GmMode:   "OPTIONAL",
		Phases:   []PhaseConfig{{ID: "p1"}},
		Modules: []ModuleConfig{
			{Name: "script_progression", Enabled: true}, // wrong strategy module
		},
	}

	err := ValidateConfig(config)
	if err == nil || !strings.Contains(err.Error(), "hybrid_progression") {
		t.Fatalf("expected strategy/module mismatch error, got: %v", err)
	}
}

func TestValidateConfig_LockModuleTargetDisabled(t *testing.T) {
	config := GameConfig{
		Strategy: "script",
		GmMode:   "OPTIONAL",
		Phases: []PhaseConfig{
			{
				ID: "p1",
				OnEnter: []PhaseActionPayload{
					{Action: ActionLockModule, Target: "voting"}, // voting not enabled
				},
			},
		},
		Modules: []ModuleConfig{
			{Name: "script_progression", Enabled: true},
		},
	}

	err := ValidateConfig(config)
	if err == nil {
		t.Fatal("expected error for LOCK_MODULE targeting disabled module")
	}
}
