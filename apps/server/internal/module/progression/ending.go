package progression

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// Default reveal steps for the ending sequence.
var defaultRevealSteps = []string{
	"vote_result",
	"criminal_reveal",
	"timeline",
	"relationships",
	"mission_scores",
	"ending_content",
}

// EndingModule manages the game ending reveal sequence.
type EndingModule struct {
	mu   sync.RWMutex
	deps engine.ModuleDeps

	// config
	revealSteps        []string
	showTimeline       bool
	showRelationships  bool
	showMissionScores  bool

	// state
	currentStep  int
	totalSteps   int
	isRevealing  bool
	revealedData map[string]json.RawMessage
}

type endingConfig struct {
	RevealSteps       []string `json:"RevealSteps"`
	ShowTimeline      bool     `json:"ShowTimeline"`
	ShowRelationships bool     `json:"ShowRelationships"`
	ShowMissionScores bool     `json:"ShowMissionScores"`
}

// NewEndingModule creates a new EndingModule instance.
func NewEndingModule() *EndingModule {
	return &EndingModule{}
}

func (m *EndingModule) Name() string { return "ending" }

func (m *EndingModule) Init(ctx context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps

	var cfg endingConfig
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("ending: invalid config: %w", err)
		}
	}

	// Apply defaults
	if len(cfg.RevealSteps) == 0 {
		cfg.RevealSteps = make([]string, len(defaultRevealSteps))
		copy(cfg.RevealSteps, defaultRevealSteps)
	}

	m.revealSteps = cfg.RevealSteps
	m.showTimeline = cfg.ShowTimeline
	m.showRelationships = cfg.ShowRelationships
	m.showMissionScores = cfg.ShowMissionScores

	m.currentStep = 0
	m.totalSteps = len(m.revealSteps)
	m.isRevealing = false
	m.revealedData = make(map[string]json.RawMessage)

	return nil
}

func (m *EndingModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	m.mu.Lock()

	switch msgType {
	case "ending:next_reveal":
		if m.currentStep >= m.totalSteps {
			m.mu.Unlock()
			return fmt.Errorf("ending: all steps already revealed")
		}

		m.isRevealing = true
		stepName := m.revealSteps[m.currentStep]
		stepIndex := m.currentStep

		m.currentStep++

		// Check if all steps completed
		completed := m.currentStep >= m.totalSteps
		if completed {
			m.isRevealing = false
		}
		totalSteps := m.totalSteps
		m.mu.Unlock()

		m.deps.EventBus.Publish(engine.Event{
			Type: "ending.reveal_step",
			Payload: map[string]any{
				"Step":  stepName,
				"Index": stepIndex,
			},
		})

		if completed {
			m.deps.EventBus.Publish(engine.Event{
				Type:    "ending.completed",
				Payload: map[string]any{"totalSteps": totalSteps},
			})
		}
		return nil

	default:
		m.mu.Unlock()
		return fmt.Errorf("ending: unknown message type %q", msgType)
	}
}

func (m *EndingModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Collect revealed step names
	revealedSteps := make([]string, 0, m.currentStep)
	for i := 0; i < m.currentStep && i < len(m.revealSteps); i++ {
		revealedSteps = append(revealedSteps, m.revealSteps[i])
	}

	state := map[string]any{
		"currentStep":   m.currentStep,
		"totalSteps":    m.totalSteps,
		"isRevealing":   m.isRevealing,
		"revealedSteps": revealedSteps,
	}
	return json.Marshal(state)
}

func (m *EndingModule) Cleanup(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.isRevealing = false
	m.revealedData = nil
	return nil
}

// Schema returns the JSON Schema for EndingModule settings.
func (m *EndingModule) Schema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"RevealSteps": {"type": "array", "items": {"type": "string"}},
			"ShowTimeline": {"type": "boolean", "default": false},
			"ShowRelationships": {"type": "boolean", "default": false},
			"ShowMissionScores": {"type": "boolean", "default": false}
		}
	}`)
}

// --- PhaseHookModule ---

func (m *EndingModule) OnPhaseEnter(_ context.Context, phase engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if string(phase) == "ending" || string(phase) == "reveal" {
		m.isRevealing = true
	}
	return nil
}

func (m *EndingModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module          = (*EndingModule)(nil)
	_ engine.ConfigSchema    = (*EndingModule)(nil)
	_ engine.PhaseHookModule = (*EndingModule)(nil)
)

func init() {
	engine.Register("ending", func() engine.Module { return NewEndingModule() })
}
