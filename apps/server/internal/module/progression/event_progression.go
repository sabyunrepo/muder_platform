package progression

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// EventProgressionModule manages non-linear phase progression driven by triggers.
type EventProgressionModule struct {
	mu   sync.RWMutex
	deps engine.ModuleDeps

	// config
	initialPhase   string
	allowBacktrack bool

	// state
	currentPhaseID string
	visitedPhases  []string
	graph          map[string][]string // phaseID -> list of reachable phase IDs via triggers
}

type eventProgressionConfig struct {
	InitialPhase   string              `json:"InitialPhase"`
	AllowBacktrack bool                `json:"AllowBacktrack"`
	Graph          map[string][]string `json:"Graph"`
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

	return nil
}

func (m *EventProgressionModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	m.mu.Lock()

	switch msgType {
	case "event:trigger":
		var p struct {
			TriggerID string `json:"TriggerID"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("event_progression: invalid payload: %w", err)
		}

		// Check if trigger leads to a valid edge from current phase
		targets, ok := m.graph[m.currentPhaseID]
		if !ok {
			m.mu.Unlock()
			return fmt.Errorf("event_progression: no edges from phase %q", m.currentPhaseID)
		}

		validTarget := ""
		for _, t := range targets {
			if t == p.TriggerID {
				validTarget = t
				break
			}
		}
		if validTarget == "" {
			m.mu.Unlock()
			return fmt.Errorf("event_progression: invalid trigger %q from phase %q", p.TriggerID, m.currentPhaseID)
		}

		// Check backtrack
		if !m.allowBacktrack {
			for _, v := range m.visitedPhases {
				if v == validTarget {
					m.mu.Unlock()
					return fmt.Errorf("event_progression: backtracking to %q not allowed", validTarget)
				}
			}
		}

		oldPhase := m.currentPhaseID
		m.currentPhaseID = validTarget
		m.visitedPhases = append(m.visitedPhases, validTarget)
		m.mu.Unlock()

		m.deps.EventBus.Publish(engine.Event{
			Type: "event.phase_transition",
			Payload: map[string]any{
				"fromPhase": oldPhase,
				"toPhase":   validTarget,
				"triggerID": p.TriggerID,
			},
		})
		return nil

	default:
		m.mu.Unlock()
		return fmt.Errorf("event_progression: unknown message type %q", msgType)
	}
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
	return nil
}

// Schema returns the JSON Schema for EventProgressionModule settings.
func (m *EventProgressionModule) Schema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"InitialPhase": {"type": "string"},
			"AllowBacktrack": {"type": "boolean", "default": false},
			"Graph": {"type": "object", "additionalProperties": {"type": "array", "items": {"type": "string"}}}
		}
	}`)
}

func init() {
	engine.Register("event_progression", func() engine.Module { return NewEventProgressionModule() })
}
