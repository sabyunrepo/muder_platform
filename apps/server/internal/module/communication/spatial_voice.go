package communication

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("spatial_voice", func() engine.Module { return NewSpatialVoiceModule() })
}

// SpatialVoiceModule manages location-based voice room assignments.
// Requires: voice_chat, and one of floor_exploration or room_exploration.
//
// PR-2a: declares public state — player location → voice-room membership is
// a shared map used by every client to render spatial audio UI. Client-side
// filtering (distance/LOS) is enforced by the LiveKit room topology, not by
// per-player state redaction.
type SpatialVoiceModule struct {
	engine.PublicStateMarker

	mu              sync.RWMutex
	deps            engine.ModuleDeps
	config          spatialVoiceConfig
	playerLocations map[uuid.UUID]string   // playerID → locationID
	voiceRooms      map[string][]uuid.UUID // locationID → playerIDs
	subIDs          []int                  // EventBus subscription IDs for cleanup
}

type spatialVoiceConfig struct {
	AutoJoin          bool `json:"autoJoin"`
	MuteOnPhaseChange bool `json:"muteOnPhaseChange"`
}

// NewSpatialVoiceModule creates a new SpatialVoiceModule instance.
func NewSpatialVoiceModule() *SpatialVoiceModule {
	return &SpatialVoiceModule{}
}

func (m *SpatialVoiceModule) Name() string { return "spatial_voice" }

func (m *SpatialVoiceModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.playerLocations = make(map[uuid.UUID]string)
	m.voiceRooms = make(map[string][]uuid.UUID)

	m.config = spatialVoiceConfig{
		AutoJoin:          true,
		MuteOnPhaseChange: false,
	}
	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("spatial_voice: invalid config: %w", err)
		}
	}

	// Subscribe to exploration events for auto-update.
	m.subIDs = make([]int, 0, 2)

	subID := deps.EventBus.Subscribe("floor.selected", func(event engine.Event) {
		m.handleExplorationEvent(event)
	})
	m.subIDs = append(m.subIDs, subID)

	subID = deps.EventBus.Subscribe("room.player_moved", func(event engine.Event) {
		m.handleExplorationEvent(event)
	})
	m.subIDs = append(m.subIDs, subID)

	return nil
}

// handleExplorationEvent processes floor/room exploration events to update spatial assignments.
func (m *SpatialVoiceModule) handleExplorationEvent(event engine.Event) {
	payload, ok := event.Payload.(map[string]any)
	if !ok {
		return
	}

	playerIDStr, _ := payload["playerId"].(string)
	locationID, _ := payload["locationId"].(string)
	if playerIDStr == "" || locationID == "" {
		return
	}

	playerID, err := uuid.Parse(playerIDStr)
	if err != nil {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.updatePlayerLocation(playerID, locationID)
}

type spatialMovePayload struct {
	LocationID string `json:"locationId"`
}

func (m *SpatialVoiceModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "spatial:move":
		return m.handleMove(playerID, payload)
	default:
		return fmt.Errorf("spatial_voice: unknown message type %q", msgType)
	}
}

func (m *SpatialVoiceModule) handleMove(playerID uuid.UUID, payload json.RawMessage) error {
	var p spatialMovePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("spatial_voice: invalid spatial:move payload: %w", err)
	}

	if p.LocationID == "" {
		return fmt.Errorf("spatial_voice: locationId is required")
	}

	m.mu.Lock()
	m.updatePlayerLocation(playerID, p.LocationID)
	locationID := p.LocationID
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "spatial.moved",
		Payload: map[string]any{
			"playerId":   playerID.String(),
			"locationId": locationID,
		},
	})
	return nil
}

// updatePlayerLocation moves a player to a new location and updates voice rooms. Caller must hold m.mu.
func (m *SpatialVoiceModule) updatePlayerLocation(playerID uuid.UUID, locationID string) {
	// Remove from old location.
	if oldLoc, ok := m.playerLocations[playerID]; ok {
		if players, exists := m.voiceRooms[oldLoc]; exists {
			for i, pid := range players {
				if pid == playerID {
					m.voiceRooms[oldLoc] = append(players[:i], players[i+1:]...)
					break
				}
			}
			// Clean up empty rooms.
			if len(m.voiceRooms[oldLoc]) == 0 {
				delete(m.voiceRooms, oldLoc)
			}
		}
	}

	// Add to new location.
	m.playerLocations[playerID] = locationID
	m.voiceRooms[locationID] = append(m.voiceRooms[locationID], playerID)
}

type spatialVoiceState struct {
	PlayerLocations map[uuid.UUID]string   `json:"playerLocations"`
	VoiceRooms      map[string][]uuid.UUID `json:"voiceRooms"`
}

func (m *SpatialVoiceModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Copy maps for safe serialization.
	locations := make(map[uuid.UUID]string, len(m.playerLocations))
	for k, v := range m.playerLocations {
		locations[k] = v
	}
	rooms := make(map[string][]uuid.UUID, len(m.voiceRooms))
	for k, v := range m.voiceRooms {
		cp := make([]uuid.UUID, len(v))
		copy(cp, v)
		rooms[k] = cp
	}

	return json.Marshal(spatialVoiceState{
		PlayerLocations: locations,
		VoiceRooms:      rooms,
	})
}

func (m *SpatialVoiceModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Unsubscribe from EventBus.
	for _, subID := range m.subIDs {
		m.deps.EventBus.Unsubscribe(subID)
	}
	m.subIDs = nil
	m.playerLocations = nil
	m.voiceRooms = nil
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module            = (*SpatialVoiceModule)(nil)
	_ engine.PublicStateModule = (*SpatialVoiceModule)(nil)
)
