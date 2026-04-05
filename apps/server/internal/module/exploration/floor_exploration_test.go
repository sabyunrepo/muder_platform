package exploration

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func newTestDeps() engine.ModuleDeps {
	return engine.ModuleDeps{
		SessionID: uuid.New(),
		EventBus:  engine.NewEventBus(nil),
		Logger:    nil,
	}
}

func TestFloorExplorationModule_Name(t *testing.T) {
	m := NewFloorExplorationModule()
	if m.Name() != "floor_exploration" {
		t.Fatalf("expected %q, got %q", "floor_exploration", m.Name())
	}
}

func TestFloorExplorationModule_Init(t *testing.T) {
	tests := []struct {
		name    string
		config  json.RawMessage
		wantErr bool
		check   func(t *testing.T, m *FloorExplorationModule)
	}{
		{
			name:    "default config",
			config:  nil,
			wantErr: false,
			check: func(t *testing.T, m *FloorExplorationModule) {
				if m.config.AllowChangeFloor {
					t.Fatal("expected AllowChangeFloor false")
				}
				if !m.config.ShowOccupancy {
					t.Fatal("expected ShowOccupancy true")
				}
				if m.config.DefaultFloor != "1층" {
					t.Fatalf("expected DefaultFloor %q, got %q", "1층", m.config.DefaultFloor)
				}
			},
		},
		{
			name:    "custom config",
			config:  json.RawMessage(`{"allowChangeFloor":true,"showOccupancy":false,"defaultFloor":"2층"}`),
			wantErr: false,
			check: func(t *testing.T, m *FloorExplorationModule) {
				if !m.config.AllowChangeFloor {
					t.Fatal("expected AllowChangeFloor true")
				}
				if m.config.ShowOccupancy {
					t.Fatal("expected ShowOccupancy false")
				}
				if m.config.DefaultFloor != "2층" {
					t.Fatalf("expected DefaultFloor %q, got %q", "2층", m.config.DefaultFloor)
				}
			},
		},
		{
			name:    "invalid config",
			config:  json.RawMessage(`{invalid`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewFloorExplorationModule()
			err := m.Init(context.Background(), newTestDeps(), tt.config)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.check != nil && err == nil {
				tt.check(t, m)
			}
		})
	}
}

func TestFloorExplorationModule_FloorSelect(t *testing.T) {
	player1 := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	tests := []struct {
		name    string
		config  json.RawMessage
		setup   func(m *FloorExplorationModule)
		player  uuid.UUID
		payload floorSelectPayload
		wantErr bool
	}{
		{
			name:    "select floor success",
			player:  player1,
			payload: floorSelectPayload{MapID: "floor_1"},
			wantErr: false,
		},
		{
			name: "change floor not allowed",
			setup: func(m *FloorExplorationModule) {
				m.playerFloors[player1] = "floor_1"
				m.floorOccupancy["floor_1"] = 1
			},
			player:  player1,
			payload: floorSelectPayload{MapID: "floor_2"},
			wantErr: true,
		},
		{
			name:   "change floor allowed",
			config: json.RawMessage(`{"allowChangeFloor":true}`),
			setup: func(m *FloorExplorationModule) {
				m.playerFloors[player1] = "floor_1"
				m.floorOccupancy["floor_1"] = 1
			},
			player:  player1,
			payload: floorSelectPayload{MapID: "floor_2"},
			wantErr: false,
		},
		{
			name:    "empty mapId",
			player:  player1,
			payload: floorSelectPayload{MapID: ""},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewFloorExplorationModule()
			_ = m.Init(context.Background(), newTestDeps(), tt.config)
			if tt.setup != nil {
				tt.setup(m)
			}

			payload, _ := json.Marshal(tt.payload)
			err := m.HandleMessage(context.Background(), tt.player, "floor:select", payload)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestFloorExplorationModule_FloorSelect_UpdatesOccupancy(t *testing.T) {
	m := NewFloorExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), json.RawMessage(`{"allowChangeFloor":true}`))

	player1 := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	player2 := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	payload1, _ := json.Marshal(floorSelectPayload{MapID: "floor_1"})
	payload2, _ := json.Marshal(floorSelectPayload{MapID: "floor_1"})
	_ = m.HandleMessage(context.Background(), player1, "floor:select", payload1)
	_ = m.HandleMessage(context.Background(), player2, "floor:select", payload2)

	m.mu.RLock()
	if m.floorOccupancy["floor_1"] != 2 {
		t.Fatalf("expected occupancy 2, got %d", m.floorOccupancy["floor_1"])
	}
	m.mu.RUnlock()

	// Move player1 to floor_2.
	payload3, _ := json.Marshal(floorSelectPayload{MapID: "floor_2"})
	_ = m.HandleMessage(context.Background(), player1, "floor:select", payload3)

	m.mu.RLock()
	if m.floorOccupancy["floor_1"] != 1 {
		t.Fatalf("expected occupancy 1, got %d", m.floorOccupancy["floor_1"])
	}
	if m.floorOccupancy["floor_2"] != 1 {
		t.Fatalf("expected occupancy 1, got %d", m.floorOccupancy["floor_2"])
	}
	m.mu.RUnlock()
}

func TestFloorExplorationModule_FloorSelect_PublishesEvent(t *testing.T) {
	deps := newTestDeps()
	m := NewFloorExplorationModule()
	_ = m.Init(context.Background(), deps, nil)

	var published bool
	deps.EventBus.Subscribe("floor.selected", func(e engine.Event) { published = true })

	payload, _ := json.Marshal(floorSelectPayload{MapID: "floor_1"})
	_ = m.HandleMessage(context.Background(), uuid.New(), "floor:select", payload)
	if !published {
		t.Fatal("floor.selected event not published")
	}
}

func TestFloorExplorationModule_ReactTo_ResetFloorSelection(t *testing.T) {
	deps := newTestDeps()
	m := NewFloorExplorationModule()
	_ = m.Init(context.Background(), deps, nil)

	// Add some state.
	player := uuid.New()
	payload, _ := json.Marshal(floorSelectPayload{MapID: "floor_1"})
	_ = m.HandleMessage(context.Background(), player, "floor:select", payload)

	var resetPublished bool
	deps.EventBus.Subscribe("floor.reset", func(e engine.Event) { resetPublished = true })

	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionResetFloorSelection,
	})
	if err != nil {
		t.Fatalf("ReactTo failed: %v", err)
	}

	m.mu.RLock()
	if len(m.playerFloors) != 0 {
		t.Fatalf("expected 0 playerFloors, got %d", len(m.playerFloors))
	}
	if len(m.floorOccupancy) != 0 {
		t.Fatalf("expected 0 floorOccupancy, got %d", len(m.floorOccupancy))
	}
	m.mu.RUnlock()

	if !resetPublished {
		t.Fatal("floor.reset event not published")
	}
}

func TestFloorExplorationModule_ReactTo_UnsupportedAction(t *testing.T) {
	m := NewFloorExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionOpenVoting,
	})
	if err == nil {
		t.Fatal("expected error for unsupported action")
	}
}

func TestFloorExplorationModule_SupportedActions(t *testing.T) {
	m := NewFloorExplorationModule()
	actions := m.SupportedActions()
	if len(actions) != 1 || actions[0] != engine.ActionResetFloorSelection {
		t.Fatalf("expected [RESET_FLOOR_SELECTION], got %v", actions)
	}
}

func TestFloorExplorationModule_BuildState(t *testing.T) {
	m := NewFloorExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state floorExplorationState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if state.PlayerFloors == nil {
		t.Fatal("expected playerFloors to be non-nil")
	}
}

func TestFloorExplorationModule_UnknownMessage(t *testing.T) {
	m := NewFloorExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "floor:unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestFloorExplorationModule_Cleanup(t *testing.T) {
	m := NewFloorExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.playerFloors != nil {
		t.Fatal("expected playerFloors nil after cleanup")
	}
}

func TestFloorExplorationModule_Schema(t *testing.T) {
	m := NewFloorExplorationModule()
	schema := m.Schema()
	if len(schema) == 0 {
		t.Fatal("expected non-empty schema")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("schema is not valid JSON: %v", err)
	}
}
