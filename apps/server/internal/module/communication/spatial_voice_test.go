package communication

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestSpatialVoiceModule_Name(t *testing.T) {
	m := NewSpatialVoiceModule()
	if m.Name() != "spatial_voice" {
		t.Fatalf("expected name %q, got %q", "spatial_voice", m.Name())
	}
}

func TestSpatialVoiceModule_InitDefaults(t *testing.T) {
	m := NewSpatialVoiceModule()
	deps := newTestDeps()

	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	if !m.config.AutoJoin {
		t.Error("expected AutoJoin true")
	}
	if m.config.MuteOnPhaseChange {
		t.Error("expected MuteOnPhaseChange false")
	}
}

func TestSpatialVoiceModule_Move(t *testing.T) {
	m := NewSpatialVoiceModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)
	ctx := context.Background()

	playerID := uuid.New()

	var moved bool
	deps.EventBus.Subscribe("spatial.moved", func(e engine.Event) {
		moved = true
		p := e.Payload.(map[string]any)
		if p["locationId"] != "lobby" {
			t.Errorf("expected locationId %q, got %q", "lobby", p["locationId"])
		}
	})

	payload := json.RawMessage(`{"locationId":"lobby"}`)
	err := m.HandleMessage(ctx, playerID, "spatial:move", payload)
	if err != nil {
		t.Fatalf("move failed: %v", err)
	}
	if !moved {
		t.Error("expected spatial.moved event")
	}

	// Verify location state.
	m.mu.RLock()
	if m.playerLocations[playerID] != "lobby" {
		t.Error("player not in lobby")
	}
	if len(m.voiceRooms["lobby"]) != 1 {
		t.Error("expected 1 player in lobby voice room")
	}
	m.mu.RUnlock()
}

func TestSpatialVoiceModule_MoveChangesRoom(t *testing.T) {
	m := NewSpatialVoiceModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)
	ctx := context.Background()

	playerID := uuid.New()

	// Move to lobby.
	m.HandleMessage(ctx, playerID, "spatial:move", json.RawMessage(`{"locationId":"lobby"}`))

	// Move to kitchen.
	m.HandleMessage(ctx, playerID, "spatial:move", json.RawMessage(`{"locationId":"kitchen"}`))

	m.mu.RLock()
	if m.playerLocations[playerID] != "kitchen" {
		t.Error("expected player in kitchen")
	}
	if len(m.voiceRooms["lobby"]) != 0 {
		t.Error("expected lobby to be empty")
	}
	if len(m.voiceRooms["kitchen"]) != 1 {
		t.Error("expected 1 player in kitchen")
	}
	m.mu.RUnlock()
}

func TestSpatialVoiceModule_EmptyLocationID(t *testing.T) {
	m := NewSpatialVoiceModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	payload := json.RawMessage(`{"locationId":""}`)
	err := m.HandleMessage(context.Background(), uuid.New(), "spatial:move", payload)
	if err == nil {
		t.Fatal("expected error for empty locationId")
	}
}

func TestSpatialVoiceModule_EventBusSubscription(t *testing.T) {
	m := NewSpatialVoiceModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	playerID := uuid.New()

	// Simulate a floor.selected event.
	deps.EventBus.Publish(engine.Event{
		Type: "floor.selected",
		Payload: map[string]any{
			"playerId":   playerID.String(),
			"locationId": "floor-2",
		},
	})

	// Allow async handler to complete.
	time.Sleep(10 * time.Millisecond)

	m.mu.RLock()
	if m.playerLocations[playerID] != "floor-2" {
		t.Errorf("expected player at floor-2, got %q", m.playerLocations[playerID])
	}
	if len(m.voiceRooms["floor-2"]) != 1 {
		t.Errorf("expected 1 player in floor-2 voice room, got %d", len(m.voiceRooms["floor-2"]))
	}
	m.mu.RUnlock()
}

func TestSpatialVoiceModule_EventBusRoomPlayerMoved(t *testing.T) {
	m := NewSpatialVoiceModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	playerID := uuid.New()

	// First place the player somewhere.
	deps.EventBus.Publish(engine.Event{
		Type: "room.player_moved",
		Payload: map[string]any{
			"playerId":   playerID.String(),
			"locationId": "room-a",
		},
	})
	time.Sleep(10 * time.Millisecond)

	// Move to another room.
	deps.EventBus.Publish(engine.Event{
		Type: "room.player_moved",
		Payload: map[string]any{
			"playerId":   playerID.String(),
			"locationId": "room-b",
		},
	})
	time.Sleep(10 * time.Millisecond)

	m.mu.RLock()
	if m.playerLocations[playerID] != "room-b" {
		t.Errorf("expected player at room-b, got %q", m.playerLocations[playerID])
	}
	if len(m.voiceRooms["room-a"]) != 0 {
		t.Error("expected room-a to be empty")
	}
	m.mu.RUnlock()
}

func TestSpatialVoiceModule_MultiplePlayersInRoom(t *testing.T) {
	m := NewSpatialVoiceModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)
	ctx := context.Background()

	p1 := uuid.New()
	p2 := uuid.New()

	m.HandleMessage(ctx, p1, "spatial:move", json.RawMessage(`{"locationId":"lobby"}`))
	m.HandleMessage(ctx, p2, "spatial:move", json.RawMessage(`{"locationId":"lobby"}`))

	m.mu.RLock()
	if len(m.voiceRooms["lobby"]) != 2 {
		t.Errorf("expected 2 players in lobby, got %d", len(m.voiceRooms["lobby"]))
	}
	m.mu.RUnlock()
}

func TestSpatialVoiceModule_BuildState(t *testing.T) {
	m := NewSpatialVoiceModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)
	ctx := context.Background()

	p1 := uuid.New()
	m.HandleMessage(ctx, p1, "spatial:move", json.RawMessage(`{"locationId":"lobby"}`))

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var s spatialVoiceState
	json.Unmarshal(state, &s)
	if len(s.PlayerLocations) != 1 {
		t.Errorf("expected 1 player location, got %d", len(s.PlayerLocations))
	}
	if len(s.VoiceRooms) != 1 {
		t.Errorf("expected 1 voice room, got %d", len(s.VoiceRooms))
	}
}

func TestSpatialVoiceModule_UnknownMessageType(t *testing.T) {
	m := NewSpatialVoiceModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "spatial:unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestSpatialVoiceModule_Cleanup(t *testing.T) {
	m := NewSpatialVoiceModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	err := m.Cleanup(context.Background())
	if err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}
	if m.playerLocations != nil {
		t.Error("expected playerLocations to be nil after cleanup")
	}
	if m.voiceRooms != nil {
		t.Error("expected voiceRooms to be nil after cleanup")
	}
}
