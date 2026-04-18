package exploration

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("floor_exploration", func() engine.Module { return NewFloorExplorationModule() })
}

// floorExplorationConfig holds the parsed configuration.
type floorExplorationConfig struct {
	AllowChangeFloor bool   `json:"allowChangeFloor"`
	ShowOccupancy    bool   `json:"showOccupancy"`
	DefaultFloor     string `json:"defaultFloor"`
}

var defaultFloorExplorationConfig = floorExplorationConfig{
	AllowChangeFloor: false,
	ShowOccupancy:    true,
	DefaultFloor:     "1층",
}

// FloorExplorationModule manages floor-based exploration.
// Conflicts: [room_exploration, timed_exploration]
type FloorExplorationModule struct {
	mu             sync.RWMutex
	deps           engine.ModuleDeps
	config         floorExplorationConfig
	playerFloors   map[uuid.UUID]string // playerID → floor mapID
	floorOccupancy map[string]int       // mapID → player count
}

// NewFloorExplorationModule creates a new FloorExplorationModule instance.
func NewFloorExplorationModule() *FloorExplorationModule {
	return &FloorExplorationModule{}
}

func (m *FloorExplorationModule) Name() string { return "floor_exploration" }

func (m *FloorExplorationModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.config = defaultFloorExplorationConfig
	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("floor_exploration: invalid config: %w", err)
		}
	}
	m.playerFloors = make(map[uuid.UUID]string)
	m.floorOccupancy = make(map[string]int)
	return nil
}

type floorSelectPayload struct {
	MapID string `json:"mapId"`
}

func (m *FloorExplorationModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "floor:select":
		return m.handleFloorSelect(ctx, playerID, payload)
	default:
		return fmt.Errorf("floor_exploration: unknown message type %q", msgType)
	}
}

func (m *FloorExplorationModule) handleFloorSelect(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p floorSelectPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("floor_exploration: invalid floor:select payload: %w", err)
	}
	if p.MapID == "" {
		return fmt.Errorf("floor_exploration: mapId is required")
	}

	m.mu.Lock()
	if currentFloor, exists := m.playerFloors[playerID]; exists {
		if !m.config.AllowChangeFloor {
			m.mu.Unlock()
			return fmt.Errorf("floor_exploration: floor change not allowed")
		}
		// Remove from old floor occupancy.
		m.floorOccupancy[currentFloor]--
		if m.floorOccupancy[currentFloor] <= 0 {
			delete(m.floorOccupancy, currentFloor)
		}
	}
	m.playerFloors[playerID] = p.MapID
	m.floorOccupancy[p.MapID]++
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "floor.selected",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"mapId":    p.MapID,
		},
	})
	return nil
}

// ReactTo implements PhaseReactor.
func (m *FloorExplorationModule) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	switch action.Action {
	case engine.ActionResetFloorSelection:
		m.mu.Lock()
		m.playerFloors = make(map[uuid.UUID]string)
		m.floorOccupancy = make(map[string]int)
		m.mu.Unlock()

		m.deps.EventBus.Publish(engine.Event{
			Type:    "floor.reset",
			Payload: nil,
		})
		return nil
	default:
		return fmt.Errorf("floor_exploration: unsupported action %q", action.Action)
	}
}

// SupportedActions implements PhaseReactor.
func (m *FloorExplorationModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{engine.ActionResetFloorSelection}
}

type floorExplorationState struct {
	PlayerFloors   map[uuid.UUID]string   `json:"playerFloors"`
	FloorOccupancy map[string]int         `json:"floorOccupancy"`
	Config         floorExplorationConfig `json:"config"`
}

func (m *FloorExplorationModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(floorExplorationState{
		PlayerFloors:   m.playerFloors,
		FloorOccupancy: m.floorOccupancy,
		Config:         m.config,
	})
}

func (m *FloorExplorationModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.playerFloors = nil
	m.floorOccupancy = nil
	return nil
}

// Schema implements ConfigSchema.
func (m *FloorExplorationModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"allowChangeFloor": map[string]any{"type": "boolean", "default": false, "description": "Whether players can change their floor after initial selection"},
			"showOccupancy":    map[string]any{"type": "boolean", "default": true, "description": "Whether to show floor occupancy counts"},
			"defaultFloor":     map[string]any{"type": "string", "default": "1층", "description": "Default floor for new players"},
		},
	}
	data, _ := json.Marshal(schema)
	return data
}

// --- GameEventHandler ---

func (m *FloorExplorationModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "floor:select", "floor:change":
		return nil
	default:
		return fmt.Errorf("floor_exploration: unsupported event type %q", event.Type)
	}
}

func (m *FloorExplorationModule) Apply(_ context.Context, _ engine.GameEvent, state *engine.GameState) error {
	data, err := m.BuildState()
	if err != nil {
		return fmt.Errorf("floor_exploration: apply: %w", err)
	}
	if state.Modules == nil {
		state.Modules = make(map[string]json.RawMessage)
	}
	state.Modules[m.Name()] = data
	return nil
}

// BuildStateFor returns floor-exploration state redacted to the caller.
// PlayerFloors is filtered to the caller's own assignment only.
// FloorOccupancy (aggregate counts) is retained — it is public by design
// when config.ShowOccupancy is true (the editor opts in to the reveal).
func (m *FloorExplorationModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	occupancy := m.floorOccupancy
	if !m.config.ShowOccupancy {
		occupancy = map[string]int{}
	}
	return json.Marshal(floorExplorationState{
		PlayerFloors:   engine.FilterByPlayer(m.playerFloors, playerID),
		FloorOccupancy: occupancy,
		Config:         m.config,
	})
}

// Compile-time interface assertions.
var (
	_ engine.Module            = (*FloorExplorationModule)(nil)
	_ engine.PhaseReactor      = (*FloorExplorationModule)(nil)
	_ engine.ConfigSchema      = (*FloorExplorationModule)(nil)
	_ engine.GameEventHandler  = (*FloorExplorationModule)(nil)
	_ engine.PlayerAwareModule = (*FloorExplorationModule)(nil)
)
