package progression

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// EventProgressionModule validates non-linear progression requests driven by
// triggers. PhaseEngine remains the source of truth for the final phase.
//
// PR-2a: declares public state — current phase, visited phase list, and
// backtrack flag are shared by all players.
type EventProgressionModule struct {
	engine.PublicStateMarker

	mu   sync.RWMutex
	deps engine.ModuleDeps

	// config
	initialPhase   string
	allowBacktrack bool

	// state
	currentPhaseID string
	visitedPhases  []string
	graph          map[string][]string // phaseID -> list of reachable phase IDs via triggers
	triggers       map[string]eventProgressionTrigger
	triggerCounts  map[string]int
	triggerRuns    map[string]bool
}

type eventProgressionConfig struct {
	InitialPhase   string                    `json:"InitialPhase"`
	AllowBacktrack bool                      `json:"AllowBacktrack"`
	Graph          map[string][]string       `json:"Graph"`
	Triggers       []eventProgressionTrigger `json:"Triggers,omitempty"`
}

type eventProgressionTrigger struct {
	ID       string          `json:"id"`
	From     string          `json:"from,omitempty"`
	To       string          `json:"to,omitempty"`
	Password string          `json:"password,omitempty"`
	Actions  json.RawMessage `json:"actions,omitempty"`
}

// NewEventProgressionModule creates a new EventProgressionModule instance.
func NewEventProgressionModule() *EventProgressionModule {
	return &EventProgressionModule{}
}

func (m *EventProgressionModule) Name() string { return "event_progression" }

func (m *EventProgressionModule) Init(ctx context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps

	var cfg eventProgressionConfig
	if config != nil && len(config) > 0 {
		if err := json.Unmarshal(config, &cfg); err != nil {
			return fmt.Errorf("event_progression: invalid config: %w", err)
		}
	}

	m.initialPhase = cfg.InitialPhase
	m.allowBacktrack = cfg.AllowBacktrack
	m.currentPhaseID = cfg.InitialPhase
	m.visitedPhases = []string{}
	if cfg.InitialPhase != "" {
		m.visitedPhases = append(m.visitedPhases, cfg.InitialPhase)
	}

	m.graph = cfg.Graph
	if m.graph == nil {
		m.graph = make(map[string][]string)
	}
	m.triggers = make(map[string]eventProgressionTrigger, len(cfg.Triggers))
	for _, trigger := range cfg.Triggers {
		if trigger.ID == "" {
			return fmt.Errorf("event_progression: trigger id is required")
		}
		if trigger.From == "" && trigger.To == "" && len(trigger.Actions) == 0 {
			return fmt.Errorf("event_progression: trigger %q has no runtime result", trigger.ID)
		}
		if _, exists := m.triggers[trigger.ID]; exists {
			return fmt.Errorf("event_progression: duplicate trigger %q", trigger.ID)
		}
		if len(trigger.Actions) > 0 {
			actions, err := engine.ParsePhaseActionConfig(trigger.Actions)
			if err != nil {
				return fmt.Errorf("event_progression: trigger %q actions invalid: %w", trigger.ID, err)
			}
			if len(actions) == 0 {
				return fmt.Errorf("event_progression: trigger %q actions invalid: empty/unsupported action config", trigger.ID)
			}
		}
		m.triggers[trigger.ID] = trigger
	}
	m.triggerCounts = make(map[string]int, len(cfg.Triggers))
	m.triggerRuns = make(map[string]bool, len(cfg.Triggers))

	return nil
}

func (m *EventProgressionModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	m.mu.Lock()

	switch msgType {
	case "event:trigger":
		var p struct {
			TriggerID string `json:"TriggerID"`
			Password  string `json:"Password,omitempty"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("event_progression: invalid payload: %w", err)
		}
		if m.isConfiguredTriggerAppliedLocked(p.TriggerID) {
			m.mu.Unlock()
			return nil
		}
		if m.isConfiguredTriggerInProgressLocked(p.TriggerID) {
			m.mu.Unlock()
			return nil
		}
		trigger, hasTriggerConfig := m.resolveConfiguredTriggerRouteLocked(p.TriggerID)
		oldPhase, validTarget, actions, err := m.resolveTriggerLocked(p.TriggerID, p.Password, trigger, hasTriggerConfig)
		if err != nil {
			m.mu.Unlock()
			return err
		}
		reserved := false
		if hasTriggerConfig {
			m.reserveConfiguredTriggerLocked(p.TriggerID)
			reserved = true
		}
		m.mu.Unlock()

		if err := m.validateTriggerRuntimeDeps(actions, validTarget); err != nil {
			if reserved {
				m.rollbackTriggerExecution(p.TriggerID)
			}
			return err
		}
		if err := m.dispatchTriggerActions(ctx, actions); err != nil {
			if reserved {
				m.rollbackTriggerExecution(p.TriggerID)
			}
			return err
		}
		if validTarget != "" {
			if err := m.moveToPhase(ctx, validTarget); err != nil {
				if reserved {
					m.rollbackTriggerExecution(p.TriggerID)
				}
				return err
			}
		}
		if reserved {
			m.commitTriggerExecution(p.TriggerID)
		}
		if validTarget != "" {
			m.publishSceneTransition(oldPhase, validTarget, p.TriggerID)
		}
		return nil

	default:
		m.mu.Unlock()
		return fmt.Errorf("event_progression: unknown message type %q", msgType)
	}
}

func (m *EventProgressionModule) isConfiguredTriggerAppliedLocked(triggerID string) bool {
	if _, ok := m.triggers[triggerID]; !ok {
		return false
	}
	return m.triggerCounts[triggerID] > 0
}

func (m *EventProgressionModule) isConfiguredTriggerInProgressLocked(triggerID string) bool {
	if _, ok := m.triggers[triggerID]; !ok {
		return false
	}
	return m.triggerRuns[triggerID]
}

func (m *EventProgressionModule) reserveConfiguredTriggerLocked(triggerID string) {
	m.triggerRuns[triggerID] = true
}

func (m *EventProgressionModule) resolveConfiguredTriggerRouteLocked(triggerID string) (eventProgressionTrigger, bool) {
	trigger, ok := m.triggers[triggerID]
	if !ok {
		return eventProgressionTrigger{}, false
	}
	if trigger.From != "" && trigger.From != m.currentPhaseID {
		return eventProgressionTrigger{}, false
	}
	return trigger, true
}

func (m *EventProgressionModule) resolveTriggerLocked(
	triggerID string,
	password string,
	trigger eventProgressionTrigger,
	hasTriggerConfig bool,
) (string, string, []engine.PhaseActionPayload, error) {
	if triggerID == "" {
		return "", "", nil, fmt.Errorf("event_progression: trigger id is required")
	}
	if hasTriggerConfig {
		return m.resolveConfiguredTriggerLocked(triggerID, password, trigger)
	}
	return m.resolveLegacyGraphTriggerLocked(triggerID)
}

func (m *EventProgressionModule) resolveConfiguredTriggerLocked(
	triggerID string,
	password string,
	trigger eventProgressionTrigger,
) (string, string, []engine.PhaseActionPayload, error) {
	if trigger.From != "" && trigger.From != m.currentPhaseID {
		return "", "", nil, fmt.Errorf("event_progression: trigger %q is not available from phase %q", triggerID, m.currentPhaseID)
	}
	if trigger.Password != "" && subtle.ConstantTimeCompare([]byte(password), []byte(trigger.Password)) != 1 {
		return "", "", nil, fmt.Errorf("event_progression: trigger %q password mismatch", triggerID)
	}
	if trigger.To != "" {
		if err := m.validateBacktrackLocked(trigger.To); err != nil {
			return "", "", nil, err
		}
	}
	actions, err := engine.ParsePhaseActionConfig(trigger.Actions)
	if err != nil {
		return "", "", nil, fmt.Errorf("event_progression: trigger %q actions invalid: %w", triggerID, err)
	}
	return m.currentPhaseID, trigger.To, actions, nil
}

func (m *EventProgressionModule) resolveLegacyGraphTriggerLocked(triggerID string) (string, string, []engine.PhaseActionPayload, error) {
	targets, ok := m.graph[m.currentPhaseID]
	if !ok {
		return "", "", nil, fmt.Errorf("event_progression: no edges from phase %q", m.currentPhaseID)
	}
	validTarget := ""
	for _, target := range targets {
		if target == triggerID {
			validTarget = target
			break
		}
	}
	if validTarget == "" {
		return "", "", nil, fmt.Errorf("event_progression: invalid trigger %q from phase %q", triggerID, m.currentPhaseID)
	}
	if err := m.validateBacktrackLocked(validTarget); err != nil {
		return "", "", nil, err
	}
	return m.currentPhaseID, validTarget, nil, nil
}

func (m *EventProgressionModule) validateBacktrackLocked(target string) error {
	if m.allowBacktrack {
		return nil
	}
	for _, visited := range m.visitedPhases {
		if visited == target {
			return fmt.Errorf("event_progression: backtracking to %q not allowed", target)
		}
	}
	return nil
}

func (m *EventProgressionModule) validateTriggerRuntimeDeps(actions []engine.PhaseActionPayload, target string) error {
	if len(actions) > 0 && m.deps.ActionDispatcher == nil {
		return fmt.Errorf("event_progression: action dispatcher is not configured")
	}
	if target != "" && m.deps.SceneController == nil {
		return fmt.Errorf("event_progression: scene controller is not configured")
	}
	return nil
}

func (m *EventProgressionModule) dispatchTriggerActions(ctx context.Context, actions []engine.PhaseActionPayload) error {
	if len(actions) == 0 {
		return nil
	}
	for _, action := range actions {
		if action.Action == "" {
			continue
		}
		if err := m.deps.ActionDispatcher.DispatchAction(ctx, action); err != nil {
			return fmt.Errorf("event_progression: trigger action %q failed: %w", action.Action, err)
		}
	}
	return nil
}

func (m *EventProgressionModule) moveToPhase(ctx context.Context, target string) error {
	return m.deps.SceneController.SkipToPhase(ctx, target)
}

func (m *EventProgressionModule) publishSceneTransition(from string, to string, triggerID string) {
	if m.deps.EventBus == nil {
		return
	}
	m.deps.EventBus.Publish(engine.Event{
		Type: "event.scene_transition_requested",
		Payload: map[string]any{
			"fromPhase": from,
			"toPhase":   to,
			"triggerID": triggerID,
		},
	})
}

func (m *EventProgressionModule) commitTriggerExecution(triggerID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.triggerCounts[triggerID]++
	delete(m.triggerRuns, triggerID)
}

func (m *EventProgressionModule) rollbackTriggerExecution(triggerID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.triggerRuns, triggerID)
}

func (m *EventProgressionModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state := map[string]any{
		"currentPhase":   m.currentPhaseID,
		"visitedPhases":  m.visitedPhases,
		"allowBacktrack": m.allowBacktrack,
	}
	return json.Marshal(state)
}

func (m *EventProgressionModule) Cleanup(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.visitedPhases = nil
	m.graph = nil
	m.triggers = nil
	m.triggerCounts = nil
	m.triggerRuns = nil
	return nil
}

// Schema returns the JSON Schema for EventProgressionModule settings.
func (m *EventProgressionModule) Schema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"InitialPhase": {"type": "string"},
			"AllowBacktrack": {"type": "boolean", "default": false},
			"Graph": {"type": "object", "additionalProperties": {"type": "array", "items": {"type": "string"}}},
			"Triggers": {
				"type": "array",
				"items": {
					"type": "object",
					"required": ["id"],
					"properties": {
						"id": {"type": "string"},
						"from": {"type": "string"},
						"to": {"type": "string"},
						"password": {"type": "string"},
						"actions": {"type": "array"}
					}
				}
			}
		}
	}`)
}

// --- PhaseHookModule ---

func (m *EventProgressionModule) OnPhaseEnter(_ context.Context, phase engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	phaseID := string(phase)
	if phaseID == "" {
		return nil
	}
	m.currentPhaseID = phaseID
	if len(m.visitedPhases) == 0 || m.visitedPhases[len(m.visitedPhases)-1] != phaseID {
		m.visitedPhases = append(m.visitedPhases, phaseID)
	}
	return nil
}

func (m *EventProgressionModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module            = (*EventProgressionModule)(nil)
	_ engine.ConfigSchema      = (*EventProgressionModule)(nil)
	_ engine.PhaseHookModule   = (*EventProgressionModule)(nil)
	_ engine.PublicStateModule = (*EventProgressionModule)(nil)
)

func init() {
	engine.Register("event_progression", func() engine.Module { return NewEventProgressionModule() })
}
