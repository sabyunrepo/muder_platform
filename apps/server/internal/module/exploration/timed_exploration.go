package exploration

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("timed_exploration", func() engine.Module { return NewTimedExplorationModule() })
}

// timedExplorationConfig holds the parsed configuration.
type timedExplorationConfig struct {
	ExplorationTime int    `json:"explorationTime"` // seconds
	WarningTime     int    `json:"warningTime"`     // seconds before end to trigger warning
	AutoEndAction   string `json:"autoEndAction"`   // "lock" or "next_phase"
	FreeRoam        bool   `json:"freeRoam"`
}

var defaultTimedExplorationConfig = timedExplorationConfig{
	ExplorationTime: 180,
	WarningTime:     30,
	AutoEndAction:   "lock",
	FreeRoam:        true,
}

// TimedExplorationModule manages time-limited exploration sessions.
// Conflicts: [floor_exploration, room_exploration]
type TimedExplorationModule struct {
	mu              sync.RWMutex
	deps            engine.ModuleDeps
	config          timedExplorationConfig
	startTime       time.Time
	isActive        bool
	isLocked        bool
	playerLocations map[uuid.UUID]string
	nowFunc         func() time.Time // for testing
}

// NewTimedExplorationModule creates a new TimedExplorationModule instance.
func NewTimedExplorationModule() *TimedExplorationModule {
	return &TimedExplorationModule{
		nowFunc: time.Now,
	}
}

func (m *TimedExplorationModule) Name() string { return "timed_exploration" }

func (m *TimedExplorationModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.config = defaultTimedExplorationConfig
	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("timed_exploration: invalid config: %w", err)
		}
	}
	m.isActive = false
	m.isLocked = false
	m.playerLocations = make(map[uuid.UUID]string)
	return nil
}

type exploreMovePayload struct {
	LocationID string `json:"locationId"`
}

func (m *TimedExplorationModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "explore:start":
		return m.handleExploreStart(ctx, playerID)
	case "explore:move":
		return m.handleExploreMove(ctx, playerID, payload)
	default:
		return fmt.Errorf("timed_exploration: unknown message type %q", msgType)
	}
}

func (m *TimedExplorationModule) handleExploreStart(_ context.Context, _ uuid.UUID) error {
	m.mu.Lock()
	if m.isActive {
		m.mu.Unlock()
		return fmt.Errorf("timed_exploration: exploration already active")
	}
	m.startTime = m.nowFunc()
	m.isActive = true
	m.isLocked = false
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type:    "explore.started",
		Payload: nil,
	})
	return nil
}

func (m *TimedExplorationModule) handleExploreMove(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p exploreMovePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("timed_exploration: invalid explore:move payload: %w", err)
	}
	if p.LocationID == "" {
		return fmt.Errorf("timed_exploration: locationId is required")
	}

	m.mu.Lock()
	if !m.isActive {
		m.mu.Unlock()
		return fmt.Errorf("timed_exploration: exploration not active")
	}
	if !m.config.FreeRoam {
		m.mu.Unlock()
		return fmt.Errorf("timed_exploration: free roam is disabled")
	}
	if m.isLocked {
		m.mu.Unlock()
		return fmt.Errorf("timed_exploration: exploration is locked")
	}
	m.playerLocations[playerID] = p.LocationID
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "explore.player_moved",
		Payload: map[string]any{
			"playerId":   playerID.String(),
			"locationId": p.LocationID,
		},
	})
	return nil
}

// timeState holds the computed time information without side effects.
type timeState struct {
	Elapsed   int
	Remaining int
	Warning   bool
	Expired   bool
}

// checkTimeState computes elapsed/remaining/warning/expired status without mutating state.
// Must be called under m.mu.RLock() or m.mu.Lock().
func (m *TimedExplorationModule) checkTimeState() timeState {
	if !m.isActive {
		return timeState{Elapsed: 0, Remaining: m.config.ExplorationTime}
	}

	now := m.nowFunc()
	elapsedDuration := now.Sub(m.startTime)
	elapsedSec := int(elapsedDuration.Seconds())
	explorationTime := m.config.ExplorationTime

	if elapsedSec < 0 {
		elapsedSec = 0
	}

	remainingSec := explorationTime - elapsedSec
	if remainingSec < 0 {
		remainingSec = 0
	}

	warning := elapsedSec >= explorationTime-m.config.WarningTime && elapsedSec < explorationTime
	expired := elapsedSec >= explorationTime && !m.isLocked

	return timeState{
		Elapsed:   elapsedSec,
		Remaining: remainingSec,
		Warning:   warning,
		Expired:   expired,
	}
}

// CheckExpiry performs the actual state mutation and publishes events when time expires.
// Should be called from an engine tick or external trigger, not from BuildState.
func (m *TimedExplorationModule) CheckExpiry() {
	m.mu.Lock()
	ts := m.checkTimeState()
	if !ts.Expired {
		m.mu.Unlock()
		return
	}

	m.isLocked = true
	autoEndAction := m.config.AutoEndAction
	m.mu.Unlock()

	if autoEndAction == "next_phase" {
		m.deps.EventBus.Publish(engine.Event{
			Type:    "explore.time_expired",
			Payload: map[string]any{"action": "next_phase"},
		})
	}
}

type timedExplorationState struct {
	IsActive        bool                 `json:"isActive"`
	IsLocked        bool                 `json:"isLocked"`
	Elapsed         int                  `json:"elapsed"`
	Remaining       int                  `json:"remaining"`
	Warning         bool                 `json:"warning"`
	PlayerLocations map[uuid.UUID]string `json:"playerLocations"`
}

func (m *TimedExplorationModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	ts := m.checkTimeState()
	state := timedExplorationState{
		IsActive:        m.isActive,
		IsLocked:        m.isLocked,
		Elapsed:         ts.Elapsed,
		Remaining:       ts.Remaining,
		Warning:         ts.Warning,
		PlayerLocations: m.playerLocations,
	}
	m.mu.RUnlock()

	return json.Marshal(state)
}

func (m *TimedExplorationModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.isActive = false
	m.isLocked = false
	m.playerLocations = nil
	return nil
}

// Schema implements ConfigSchema.
func (m *TimedExplorationModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"explorationTime": map[string]any{"type": "integer", "default": 180, "minimum": 1, "description": "Total exploration time in seconds"},
			"warningTime":     map[string]any{"type": "integer", "default": 30, "minimum": 0, "description": "Seconds before end to show warning"},
			"autoEndAction":   map[string]any{"type": "string", "enum": []string{"lock", "next_phase"}, "default": "lock", "description": "Action when exploration time expires"},
			"freeRoam":        map[string]any{"type": "boolean", "default": true, "description": "Whether players can freely move during exploration"},
		},
	}
	data, _ := json.Marshal(schema)
	return data
}

// --- PhaseHookModule ---

func (m *TimedExplorationModule) OnPhaseEnter(_ context.Context, _ engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.isActive = true
	return nil
}

func (m *TimedExplorationModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.isActive = false
	return nil
}

// --- GameEventHandler ---

func (m *TimedExplorationModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "explore:move", "explore:examine":
		return nil
	default:
		return fmt.Errorf("timed_exploration: unsupported event type %q", event.Type)
	}
}

func (m *TimedExplorationModule) Apply(_ context.Context, _ engine.GameEvent, state *engine.GameState) error {
	data, err := m.BuildState()
	if err != nil {
		return fmt.Errorf("timed_exploration: apply: %w", err)
	}
	if state.Modules == nil {
		state.Modules = make(map[string]json.RawMessage)
	}
	state.Modules[m.Name()] = data
	return nil
}

// BuildStateFor returns timed-exploration state redacted to the caller.
// Timer fields (isActive/isLocked/elapsed/remaining/warning) are public;
// playerLocations is filtered to the caller's own position.
func (m *TimedExplorationModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	ts := m.checkTimeState()
	state := timedExplorationState{
		IsActive:        m.isActive,
		IsLocked:        m.isLocked,
		Elapsed:         ts.Elapsed,
		Remaining:       ts.Remaining,
		Warning:         ts.Warning,
		PlayerLocations: engine.FilterByPlayer(m.playerLocations, playerID),
	}
	m.mu.RUnlock()
	return json.Marshal(state)
}

// Compile-time interface assertions.
var (
	_ engine.Module            = (*TimedExplorationModule)(nil)
	_ engine.ConfigSchema      = (*TimedExplorationModule)(nil)
	_ engine.PhaseHookModule   = (*TimedExplorationModule)(nil)
	_ engine.GameEventHandler  = (*TimedExplorationModule)(nil)
	_ engine.PlayerAwareModule = (*TimedExplorationModule)(nil)
)
