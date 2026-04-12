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
	engine.Register("room_exploration", func() engine.Module { return NewRoomBasedExplorationModule() })
}

// roomBasedExplorationConfig holds the parsed configuration.
type roomBasedExplorationConfig struct {
	MaxPlayersPerRoom   int  `json:"maxPlayersPerRoom"`
	MoveCooldown        int  `json:"moveCooldown"` // seconds
	ShowPlayerLocations bool `json:"showPlayerLocations"`
}

var defaultRoomBasedExplorationConfig = roomBasedExplorationConfig{
	MaxPlayersPerRoom:   3,
	MoveCooldown:        5,
	ShowPlayerLocations: true,
}

// RoomBasedExplorationModule manages room-based exploration.
// Conflicts: [floor_exploration, timed_exploration]
type RoomBasedExplorationModule struct {
	mu              sync.RWMutex
	deps            engine.ModuleDeps
	config          roomBasedExplorationConfig
	playerLocations map[uuid.UUID]string     // playerID → locationID
	roomOccupancy   map[string][]uuid.UUID   // locationID → playerIDs
	lastMove        map[uuid.UUID]time.Time  // playerID → last move time
	nowFunc         func() time.Time         // for testing
}

// NewRoomBasedExplorationModule creates a new RoomBasedExplorationModule instance.
func NewRoomBasedExplorationModule() *RoomBasedExplorationModule {
	return &RoomBasedExplorationModule{
		nowFunc: time.Now,
	}
}

func (m *RoomBasedExplorationModule) Name() string { return "room_exploration" }

func (m *RoomBasedExplorationModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.config = defaultRoomBasedExplorationConfig
	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("room_exploration: invalid config: %w", err)
		}
	}
	m.playerLocations = make(map[uuid.UUID]string)
	m.roomOccupancy = make(map[string][]uuid.UUID)
	m.lastMove = make(map[uuid.UUID]time.Time)
	return nil
}

type roomMovePayload struct {
	LocationID string `json:"locationId"`
}

func (m *RoomBasedExplorationModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "room:move":
		return m.handleRoomMove(ctx, playerID, payload)
	default:
		return fmt.Errorf("room_exploration: unknown message type %q", msgType)
	}
}

func (m *RoomBasedExplorationModule) handleRoomMove(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p roomMovePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("room_exploration: invalid room:move payload: %w", err)
	}
	if p.LocationID == "" {
		return fmt.Errorf("room_exploration: locationId is required")
	}

	m.mu.Lock()
	// Return early if the player is already in the target room.
	if currentRoom, exists := m.playerLocations[playerID]; exists && currentRoom == p.LocationID {
		m.mu.Unlock()
		return nil
	}

	// Check cooldown.
	now := m.nowFunc()
	if lastTime, exists := m.lastMove[playerID]; exists {
		cooldown := time.Duration(m.config.MoveCooldown) * time.Second
		if now.Sub(lastTime) < cooldown {
			m.mu.Unlock()
			return fmt.Errorf("room_exploration: move cooldown active (wait %v)", cooldown-now.Sub(lastTime))
		}
	}

	// Check max occupancy of target room.
	occupants := m.roomOccupancy[p.LocationID]
	if len(occupants) >= m.config.MaxPlayersPerRoom {
		m.mu.Unlock()
		return fmt.Errorf("room_exploration: room %q is full (%d/%d)", p.LocationID, len(occupants), m.config.MaxPlayersPerRoom)
	}

	// Remove from old room.
	if oldRoom, exists := m.playerLocations[playerID]; exists {
		m.removeFromRoom(playerID, oldRoom)
	}

	// Add to new room.
	m.playerLocations[playerID] = p.LocationID
	m.roomOccupancy[p.LocationID] = append(m.roomOccupancy[p.LocationID], playerID)
	m.lastMove[playerID] = now
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "room.player_moved",
		Payload: map[string]any{
			"playerId":   playerID.String(),
			"locationId": p.LocationID,
		},
	})
	return nil
}

// removeFromRoom removes a player from a room's occupancy list. Must be called under m.mu.Lock().
func (m *RoomBasedExplorationModule) removeFromRoom(playerID uuid.UUID, roomID string) {
	occupants := m.roomOccupancy[roomID]
	for i, pid := range occupants {
		if pid == playerID {
			m.roomOccupancy[roomID] = append(occupants[:i], occupants[i+1:]...)
			break
		}
	}
	if len(m.roomOccupancy[roomID]) == 0 {
		delete(m.roomOccupancy, roomID)
	}
}

type roomBasedExplorationState struct {
	PlayerLocations map[uuid.UUID]string   `json:"playerLocations"`
	RoomOccupancy   map[string][]uuid.UUID `json:"roomOccupancy"`
}

func (m *RoomBasedExplorationModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(roomBasedExplorationState{
		PlayerLocations: m.playerLocations,
		RoomOccupancy:   m.roomOccupancy,
	})
}

func (m *RoomBasedExplorationModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.playerLocations = nil
	m.roomOccupancy = nil
	m.lastMove = nil
	return nil
}

// Schema implements ConfigSchema.
func (m *RoomBasedExplorationModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"maxPlayersPerRoom":   map[string]any{"type": "integer", "default": 3, "minimum": 1, "description": "Maximum players allowed in a single room"},
			"moveCooldown":        map[string]any{"type": "integer", "default": 5, "minimum": 0, "description": "Cooldown between moves in seconds"},
			"showPlayerLocations": map[string]any{"type": "boolean", "default": true, "description": "Whether to show other players' locations"},
		},
	}
	data, _ := json.Marshal(schema)
	return data
}

// --- GameEventHandler ---

func (m *RoomBasedExplorationModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "room:move", "room:examine":
		return nil
	default:
		return fmt.Errorf("room_exploration: unsupported event type %q", event.Type)
	}
}

func (m *RoomBasedExplorationModule) Apply(_ context.Context, _ engine.GameEvent, state *engine.GameState) error {
	data, err := m.BuildState()
	if err != nil {
		return fmt.Errorf("room_exploration: apply: %w", err)
	}
	if state.Modules == nil {
		state.Modules = make(map[string]json.RawMessage)
	}
	state.Modules[m.Name()] = data
	return nil
}

// Compile-time interface assertions.
var (
	_ engine.Module           = (*RoomBasedExplorationModule)(nil)
	_ engine.ConfigSchema     = (*RoomBasedExplorationModule)(nil)
	_ engine.GameEventHandler = (*RoomBasedExplorationModule)(nil)
)
