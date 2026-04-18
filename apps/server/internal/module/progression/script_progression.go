package progression

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// ScriptProgressionModule manages linear phase progression through a predefined script.
//
// PR-2a: declares public state — phase index, total count, skip/progress flags
// are identical for every player (no per-role redaction).
type ScriptProgressionModule struct {
	engine.PublicStateMarker

	mu   sync.RWMutex
	deps engine.ModuleDeps

	// config
	allowSkip      bool
	showProgress   bool
	autoStartFirst bool

	// state
	currentPhaseIndex int
	phases            []string
	paused            bool
}

type scriptProgressionConfig struct {
	AllowSkip      bool `json:"AllowSkip"`
	ShowProgress   bool `json:"ShowProgress"`
	AutoStartFirst bool `json:"AutoStartFirst"`
}

// NewScriptProgressionModule creates a new ScriptProgressionModule instance.
func NewScriptProgressionModule() *ScriptProgressionModule {
	return &ScriptProgressionModule{}
}

func (m *ScriptProgressionModule) Name() string { return "script_progression" }

func (m *ScriptProgressionModule) Init(ctx context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps

	var cfg scriptProgressionConfig
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("script_progression: invalid config: %w", err)
		}
	}

	m.allowSkip = cfg.AllowSkip
	m.showProgress = cfg.ShowProgress
	m.autoStartFirst = cfg.AutoStartFirst

	// Extract phase IDs from config phases array
	var raw struct {
		Phases []string `json:"phases"`
	}
	if config != nil && len(config) > 0 {
		_ = json.Unmarshal(config, &raw)
	}
	m.phases = raw.Phases
	m.currentPhaseIndex = 0
	m.paused = false

	return nil
}

func (m *ScriptProgressionModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	m.mu.Lock()

	switch msgType {
	case "script:skip":
		if !m.allowSkip {
			m.mu.Unlock()
			return fmt.Errorf("script_progression: skip not allowed")
		}
		m.mu.Unlock()

		m.deps.EventBus.Publish(engine.Event{
			Type:    "progression.skip_requested",
			Payload: map[string]any{"playerID": playerID.String()},
		})
		return nil
	default:
		m.mu.Unlock()
		return fmt.Errorf("script_progression: unknown message type %q", msgType)
	}
}

func (m *ScriptProgressionModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := map[string]any{
		"currentIndex": m.currentPhaseIndex,
		"totalPhases":  len(m.phases),
		"showProgress": m.showProgress,
		"allowSkip":    m.allowSkip,
	}
	return json.Marshal(state)
}

func (m *ScriptProgressionModule) Cleanup(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.phases = nil
	return nil
}

// Schema returns the JSON Schema for ScriptProgressionModule settings.
func (m *ScriptProgressionModule) Schema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"AllowSkip": {"type": "boolean", "default": false},
			"ShowProgress": {"type": "boolean", "default": false},
			"AutoStartFirst": {"type": "boolean", "default": false},
			"phases": {"type": "array", "items": {"type": "string"}}
		}
	}`)
}

// --- PhaseHookModule ---

func (m *ScriptProgressionModule) OnPhaseEnter(_ context.Context, _ engine.Phase) error {
	return nil
}

func (m *ScriptProgressionModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module            = (*ScriptProgressionModule)(nil)
	_ engine.ConfigSchema      = (*ScriptProgressionModule)(nil)
	_ engine.PhaseHookModule   = (*ScriptProgressionModule)(nil)
	_ engine.PublicStateModule = (*ScriptProgressionModule)(nil)
)

func init() {
	engine.Register("script_progression", func() engine.Module { return NewScriptProgressionModule() })
}
