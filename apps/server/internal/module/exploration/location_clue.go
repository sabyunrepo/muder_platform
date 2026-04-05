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
	engine.Register("location_clue", func() engine.Module { return NewLocationClueModule() })
}

// locationClueConfig holds the parsed configuration.
type locationClueConfig struct {
	ShowClueCount    bool `json:"showClueCount"`
	AllowRepeatSearch bool `json:"allowRepeatSearch"`
}

var defaultLocationClueConfig = locationClueConfig{
	ShowClueCount:    false,
	AllowRepeatSearch: true,
}

// LocationClueModule manages location-based clue searching.
// No conflicts (overlays on any exploration module).
type LocationClueModule struct {
	mu                sync.RWMutex
	deps              engine.ModuleDeps
	config            locationClueConfig
	searchedLocations map[uuid.UUID]map[string]bool // playerID → locationID → searched
	foundClues        map[uuid.UUID][]string         // playerID → clue IDs
}

// NewLocationClueModule creates a new LocationClueModule instance.
func NewLocationClueModule() *LocationClueModule {
	return &LocationClueModule{}
}

func (m *LocationClueModule) Name() string { return "location_clue" }

func (m *LocationClueModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.config = defaultLocationClueConfig
	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("location_clue: invalid config: %w", err)
		}
	}
	m.searchedLocations = make(map[uuid.UUID]map[string]bool)
	m.foundClues = make(map[uuid.UUID][]string)
	return nil
}

type locationSearchPayload struct {
	LocationID string `json:"locationId"`
}

func (m *LocationClueModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "location:search":
		return m.handleLocationSearch(ctx, playerID, payload)
	default:
		return fmt.Errorf("location_clue: unknown message type %q", msgType)
	}
}

func (m *LocationClueModule) handleLocationSearch(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p locationSearchPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("location_clue: invalid location:search payload: %w", err)
	}
	if p.LocationID == "" {
		return fmt.Errorf("location_clue: locationId is required")
	}

	m.mu.Lock()
	// Check repeat search restriction.
	if !m.config.AllowRepeatSearch {
		if locations, exists := m.searchedLocations[playerID]; exists {
			if locations[p.LocationID] {
				m.mu.Unlock()
				return fmt.Errorf("location_clue: location %q already searched", p.LocationID)
			}
		}
	}

	// Record the search.
	if m.searchedLocations[playerID] == nil {
		m.searchedLocations[playerID] = make(map[string]bool)
	}
	m.searchedLocations[playerID][p.LocationID] = true
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "location.searched",
		Payload: map[string]any{
			"playerId":   playerID.String(),
			"locationId": p.LocationID,
		},
	})
	return nil
}

// AddFoundClue records a clue found by a player. Called by event handlers
// when the clue system confirms a clue was acquired.
func (m *LocationClueModule) AddFoundClue(playerID uuid.UUID, clueID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.foundClues[playerID] = append(m.foundClues[playerID], clueID)
}

type locationClueState struct {
	SearchedLocations map[uuid.UUID]map[string]bool `json:"searchedLocations"`
	FoundClues        map[uuid.UUID][]string        `json:"foundClues"`
	Config            locationClueConfig             `json:"config"`
}

func (m *LocationClueModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(locationClueState{
		SearchedLocations: m.searchedLocations,
		FoundClues:        m.foundClues,
		Config:            m.config,
	})
}

func (m *LocationClueModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.searchedLocations = nil
	m.foundClues = nil
	return nil
}

// Schema implements ConfigSchema.
func (m *LocationClueModule) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"showClueCount":     map[string]any{"type": "boolean", "default": false, "description": "Whether to show the number of clues at a location"},
			"allowRepeatSearch": map[string]any{"type": "boolean", "default": true, "description": "Whether players can search the same location multiple times"},
		},
	}
	data, _ := json.Marshal(schema)
	return data
}

// Compile-time interface assertions.
var (
	_ engine.Module       = (*LocationClueModule)(nil)
	_ engine.ConfigSchema = (*LocationClueModule)(nil)
)
