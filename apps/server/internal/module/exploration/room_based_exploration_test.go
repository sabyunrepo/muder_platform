package exploration

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestRoomBasedExplorationModule_Name(t *testing.T) {
	m := NewRoomBasedExplorationModule()
	if m.Name() != "room_exploration" {
		t.Fatalf("expected %q, got %q", "room_exploration", m.Name())
	}
}

func TestRoomBasedExplorationModule_Init(t *testing.T) {
	tests := []struct {
		name    string
		config  json.RawMessage
		wantErr bool
		check   func(t *testing.T, m *RoomBasedExplorationModule)
	}{
		{
			name:    "default config",
			config:  nil,
			wantErr: false,
			check: func(t *testing.T, m *RoomBasedExplorationModule) {
				if m.config.MaxPlayersPerRoom != 3 {
					t.Fatalf("expected MaxPlayersPerRoom 3, got %d", m.config.MaxPlayersPerRoom)
				}
				if m.config.MoveCooldown != 5 {
					t.Fatalf("expected MoveCooldown 5, got %d", m.config.MoveCooldown)
				}
			},
		},
		{
			name:    "custom config",
			config:  json.RawMessage(`{"maxPlayersPerRoom":5,"moveCooldown":10,"showPlayerLocations":false}`),
			wantErr: false,
			check: func(t *testing.T, m *RoomBasedExplorationModule) {
				if m.config.MaxPlayersPerRoom != 5 {
					t.Fatalf("expected MaxPlayersPerRoom 5, got %d", m.config.MaxPlayersPerRoom)
				}
				if m.config.MoveCooldown != 10 {
					t.Fatalf("expected MoveCooldown 10, got %d", m.config.MoveCooldown)
				}
			},
		},
		{
			name:    "invalid config",
			config:  json.RawMessage(`{bad`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewRoomBasedExplorationModule()
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

func TestRoomBasedExplorationModule_RoomMove(t *testing.T) {
	player1 := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	player2 := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	player3 := uuid.MustParse("00000000-0000-0000-0000-000000000003")
	player4 := uuid.MustParse("00000000-0000-0000-0000-000000000004")
	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name    string
		config  json.RawMessage
		setup   func(m *RoomBasedExplorationModule)
		player  uuid.UUID
		payload roomMovePayload
		nowFunc func() time.Time
		wantErr bool
	}{
		{
			name:    "move success",
			player:  player1,
			payload: roomMovePayload{LocationID: "room_a"},
			nowFunc: func() time.Time { return baseTime },
			wantErr: false,
		},
		{
			name:    "empty locationId",
			player:  player1,
			payload: roomMovePayload{LocationID: ""},
			nowFunc: func() time.Time { return baseTime },
			wantErr: true,
		},
		{
			name: "cooldown active",
			setup: func(m *RoomBasedExplorationModule) {
				m.lastMove[player1] = baseTime
			},
			player:  player1,
			payload: roomMovePayload{LocationID: "room_b"},
			nowFunc: func() time.Time { return baseTime.Add(2 * time.Second) }, // 2s < 5s cooldown
			wantErr: true,
		},
		{
			name: "cooldown expired",
			setup: func(m *RoomBasedExplorationModule) {
				m.lastMove[player1] = baseTime
			},
			player:  player1,
			payload: roomMovePayload{LocationID: "room_b"},
			nowFunc: func() time.Time { return baseTime.Add(6 * time.Second) }, // 6s > 5s cooldown
			wantErr: false,
		},
		{
			name:   "room full",
			config: json.RawMessage(`{"maxPlayersPerRoom":3,"moveCooldown":0}`),
			setup: func(m *RoomBasedExplorationModule) {
				m.roomOccupancy["room_a"] = []uuid.UUID{player1, player2, player3}
				m.playerLocations[player1] = "room_a"
				m.playerLocations[player2] = "room_a"
				m.playerLocations[player3] = "room_a"
			},
			player:  player4,
			payload: roomMovePayload{LocationID: "room_a"},
			nowFunc: func() time.Time { return baseTime },
			wantErr: true,
		},
		{
			name:   "same player re-enter same room",
			config: json.RawMessage(`{"maxPlayersPerRoom":1,"moveCooldown":0}`),
			setup: func(m *RoomBasedExplorationModule) {
				m.roomOccupancy["room_a"] = []uuid.UUID{player1}
				m.playerLocations[player1] = "room_a"
			},
			player:  player1,
			payload: roomMovePayload{LocationID: "room_a"},
			nowFunc: func() time.Time { return baseTime },
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewRoomBasedExplorationModule()
			_ = m.Init(context.Background(), newTestDeps(), tt.config)
			if tt.nowFunc != nil {
				m.nowFunc = tt.nowFunc
			}
			if tt.setup != nil {
				tt.setup(m)
			}

			payload, _ := json.Marshal(tt.payload)
			err := m.HandleMessage(context.Background(), tt.player, "room:move", payload)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestRoomBasedExplorationModule_RoomMove_UpdatesOccupancy(t *testing.T) {
	m := NewRoomBasedExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), json.RawMessage(`{"moveCooldown":0}`))
	m.nowFunc = func() time.Time { return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) }

	player1 := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	// Move to room_a.
	payload, _ := json.Marshal(roomMovePayload{LocationID: "room_a"})
	_ = m.HandleMessage(context.Background(), player1, "room:move", payload)

	m.mu.RLock()
	if len(m.roomOccupancy["room_a"]) != 1 {
		t.Fatalf("expected 1 occupant in room_a, got %d", len(m.roomOccupancy["room_a"]))
	}
	m.mu.RUnlock()

	// Move to room_b.
	payload2, _ := json.Marshal(roomMovePayload{LocationID: "room_b"})
	_ = m.HandleMessage(context.Background(), player1, "room:move", payload2)

	m.mu.RLock()
	if len(m.roomOccupancy["room_a"]) != 0 {
		t.Fatalf("expected 0 occupants in room_a after move, got %d", len(m.roomOccupancy["room_a"]))
	}
	if len(m.roomOccupancy["room_b"]) != 1 {
		t.Fatalf("expected 1 occupant in room_b, got %d", len(m.roomOccupancy["room_b"]))
	}
	m.mu.RUnlock()
}

func TestRoomBasedExplorationModule_RoomMove_PublishesEvent(t *testing.T) {
	deps := newTestDeps()
	m := NewRoomBasedExplorationModule()
	_ = m.Init(context.Background(), deps, json.RawMessage(`{"moveCooldown":0}`))
	m.nowFunc = func() time.Time { return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) }

	var published bool
	deps.EventBus.Subscribe("room.player_moved", func(e engine.Event) { published = true })

	payload, _ := json.Marshal(roomMovePayload{LocationID: "room_a"})
	_ = m.HandleMessage(context.Background(), uuid.New(), "room:move", payload)
	if !published {
		t.Fatal("room.player_moved event not published")
	}
}

func TestRoomBasedExplorationModule_BuildState(t *testing.T) {
	m := NewRoomBasedExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state roomBasedExplorationState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
}

func TestRoomBasedExplorationModule_UnknownMessage(t *testing.T) {
	m := NewRoomBasedExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "room:unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestRoomBasedExplorationModule_Cleanup(t *testing.T) {
	m := NewRoomBasedExplorationModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.playerLocations != nil {
		t.Fatal("expected playerLocations nil after cleanup")
	}
}

func TestRoomBasedExplorationModule_Schema(t *testing.T) {
	m := NewRoomBasedExplorationModule()
	schema := m.Schema()
	if len(schema) == 0 {
		t.Fatal("expected non-empty schema")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("schema is not valid JSON: %v", err)
	}
}
