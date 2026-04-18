// Package crime_scene implements the CrimeScene module group:
// Location, Evidence, and Combination modules.
package crime_scene

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
	engine.Register("location", func() engine.Module { return NewLocationModule() })
}

// LocationDef describes a single location in the crime scene.
type LocationDef struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	AccessRules []string `json:"accessRules"`
}

// LocationConfig defines settings for the location module.
type LocationConfig struct {
	Locations    []LocationDef `json:"locations"`
	StartingLoc  string        `json:"startingLocation"`
	MoveCooldown int           `json:"moveCooldownSec"` // 0 = no cooldown
}

// LocationModule tracks player positions and movement within the crime scene.
type LocationModule struct {
	mu          sync.RWMutex
	deps        engine.ModuleDeps
	config      LocationConfig
	locationSet map[string]LocationDef
	positions   map[uuid.UUID]string
	history     map[uuid.UUID][]string
	lastMove    map[uuid.UUID]time.Time
}

// NewLocationModule creates a new LocationModule instance.
func NewLocationModule() *LocationModule {
	return &LocationModule{}
}

// Name returns the module identifier.
func (m *LocationModule) Name() string { return "location" }

// Init initialises the module with session context and configuration.
func (m *LocationModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.positions = make(map[uuid.UUID]string)
	m.history = make(map[uuid.UUID][]string)
	m.lastMove = make(map[uuid.UUID]time.Time)
	m.locationSet = make(map[string]LocationDef)

	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("location: invalid config: %w", err)
		}
	}

	for _, loc := range m.config.Locations {
		if loc.ID == "" {
			return fmt.Errorf("location: location missing id")
		}
		m.locationSet[loc.ID] = loc
	}

	if m.config.StartingLoc != "" {
		if _, ok := m.locationSet[m.config.StartingLoc]; !ok {
			return fmt.Errorf("location: startingLocation %q not found", m.config.StartingLoc)
		}
	}

	return nil
}

// HandleMessage processes player actions routed to this module.
func (m *LocationModule) HandleMessage(ctx context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "move":
		return m.handleMove(ctx, playerID, payload)
	case "examine":
		return m.handleExamine(ctx, playerID, payload)
	default:
		return fmt.Errorf("location: unknown message type %q", msgType)
	}
}

type locationPayload struct {
	LocationID string `json:"location_id"`
}

func (m *LocationModule) handleMove(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p locationPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("location: invalid move payload: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.locationSet[p.LocationID]; !ok {
		return fmt.Errorf("location: invalid move: location %q not found", p.LocationID)
	}

	if m.config.MoveCooldown > 0 {
		if last, ok := m.lastMove[playerID]; ok {
			elapsed := time.Since(last)
			cooldown := time.Duration(m.config.MoveCooldown) * time.Second
			if elapsed < cooldown {
				return fmt.Errorf("location: invalid move: cooldown active, wait %v", cooldown-elapsed)
			}
		}
	}

	m.positions[playerID] = p.LocationID
	m.lastMove[playerID] = time.Now()
	m.history[playerID] = append(m.history[playerID], p.LocationID)

	m.deps.EventBus.Publish(engine.Event{
		Type: "location.moved",
		Payload: map[string]any{
			"playerID":   playerID,
			"locationID": p.LocationID,
		},
	})
	return nil
}

func (m *LocationModule) handleExamine(_ context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var p locationPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("location: invalid examine payload: %w", err)
	}

	m.mu.RLock()
	_, ok := m.locationSet[p.LocationID]
	m.mu.RUnlock()

	if !ok {
		return fmt.Errorf("location: invalid examine: location %q not found", p.LocationID)
	}

	m.deps.EventBus.Publish(engine.Event{
		Type: "location.examined",
		Payload: map[string]any{
			"playerID":   playerID,
			"locationID": p.LocationID,
		},
	})
	return nil
}

// locationState is the serialisable snapshot of location positions and history.
type locationState struct {
	Positions map[string]string   `json:"positions"`
	History   map[string][]string `json:"history"`
}

func (m *LocationModule) snapshot() locationState {
	positions := make(map[string]string, len(m.positions))
	for pid, loc := range m.positions {
		positions[pid.String()] = loc
	}
	history := make(map[string][]string, len(m.history))
	for pid, locs := range m.history {
		cp := make([]string, len(locs))
		copy(cp, locs)
		history[pid.String()] = cp
	}
	return locationState{Positions: positions, History: history}
}

// BuildState returns the module's current state for client sync.
func (m *LocationModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	s := m.snapshot()
	m.mu.RUnlock()
	return json.Marshal(s)
}

// Cleanup releases resources when the session ends.
func (m *LocationModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.positions = nil
	m.history = nil
	m.lastMove = nil
	m.locationSet = nil
	return nil
}

// --- GameEventHandler ---

// Validate checks whether a location.move game event is legal.
func (m *LocationModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	if event.Type != "location.move" {
		return nil
	}
	var p locationPayload
	if err := json.Unmarshal(event.Payload, &p); err != nil {
		return fmt.Errorf("location: invalid move payload: %w", err)
	}
	m.mu.RLock()
	_, ok := m.locationSet[p.LocationID]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("location: invalid move: location %q not found", p.LocationID)
	}
	return nil
}

// Apply updates player position in response to a validated move event.
func (m *LocationModule) Apply(_ context.Context, event engine.GameEvent, _ *engine.GameState) error {
	if event.Type != "location.move" {
		return nil
	}
	var p locationPayload
	if err := json.Unmarshal(event.Payload, &p); err != nil {
		return fmt.Errorf("location: apply: invalid payload: %w", err)
	}
	m.mu.Lock()
	m.positions[event.SessionID] = p.LocationID
	m.mu.Unlock()
	return nil
}

// --- SerializableModule ---

// SaveState serialises player positions and history for persistence.
func (m *LocationModule) SaveState(_ context.Context) (engine.GameState, error) {
	m.mu.RLock()
	s := m.snapshot()
	m.mu.RUnlock()

	data, err := json.Marshal(s)
	if err != nil {
		return engine.GameState{}, fmt.Errorf("location: save state: %w", err)
	}
	return engine.GameState{
		Modules: map[string]json.RawMessage{m.Name(): data},
	}, nil
}

// RestoreState deserialises a previously persisted state.
func (m *LocationModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	raw, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	var s locationState
	if err := json.Unmarshal(raw, &s); err != nil {
		return fmt.Errorf("location: restore state: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.positions = make(map[uuid.UUID]string, len(s.Positions))
	for pidStr, loc := range s.Positions {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			return fmt.Errorf("location: restore state: invalid playerID %q: %w", pidStr, err)
		}
		m.positions[pid] = loc
	}
	m.history = make(map[uuid.UUID][]string, len(s.History))
	for pidStr, locs := range s.History {
		pid, err := uuid.Parse(pidStr)
		if err != nil {
			return fmt.Errorf("location: restore state: invalid playerID %q: %w", pidStr, err)
		}
		cp := make([]string, len(locs))
		copy(cp, locs)
		m.history[pid] = cp
	}
	return nil
}

// --- RuleProvider ---

// GetRules returns the rules contributed by this module.
func (m *LocationModule) GetRules() []engine.Rule {
	logic, _ := json.Marshal(map[string]any{
		"in": []any{
			map[string]any{"var": "player.currentLocation"},
			map[string]any{"var": "location.allowedLocations"},
		},
	})
	return []engine.Rule{
		{
			ID:          "can_access_location",
			Description: "Player can access the target location",
			Logic:       logic,
		},
	}
}

// BuildStateFor returns location state redacted to the requesting player.
// Only the caller's current position and movement history are included;
// everyone else's positions and trails are withheld.
//
// Note: in scenarios where shared-knowledge location is the intended design
// (e.g. open-map deduction), the scenario should instead opt out of
// PlayerAware by embedding engine.PublicStateMarker. PR-2b treats positions
// as private by default (F-sec-2 + F-03 Phase 18.1 B-2).
func (m *LocationModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	positions := make(map[string]string, 1)
	if loc, ok := m.positions[playerID]; ok {
		positions[playerID.String()] = loc
	}
	history := make(map[string][]string, 1)
	if locs, ok := m.history[playerID]; ok {
		cp := make([]string, len(locs))
		copy(cp, locs)
		history[playerID.String()] = cp
	}
	return json.Marshal(locationState{Positions: positions, History: history})
}

// Compile-time interface assertions.
var (
	_ engine.Module             = (*LocationModule)(nil)
	_ engine.GameEventHandler   = (*LocationModule)(nil)
	_ engine.SerializableModule = (*LocationModule)(nil)
	_ engine.RuleProvider       = (*LocationModule)(nil)
	_ engine.PlayerAwareModule  = (*LocationModule)(nil)
)
