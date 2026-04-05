package core

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestRoomModule_Name(t *testing.T) {
	m := NewRoomModule()
	if m.Name() != "room" {
		t.Fatalf("expected %q, got %q", "room", m.Name())
	}
}

func TestRoomModule_Init(t *testing.T) {
	m := NewRoomModule()
	err := m.Init(context.Background(), newTestDeps(), nil)
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	if m.phase != "waiting" {
		t.Fatalf("expected phase %q, got %q", "waiting", m.phase)
	}
}

func TestRoomModule_SelectCharacter(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(m *RoomModule) // pre-populate state
		player  uuid.UUID
		payload selectCharacterPayload
		wantErr bool
	}{
		{
			name:    "select character success",
			player:  uuid.MustParse("00000000-0000-0000-0000-000000000001"),
			payload: selectCharacterPayload{CharacterCode: "detective"},
			wantErr: false,
		},
		{
			name: "duplicate character by different player",
			setup: func(m *RoomModule) {
				m.characters["detective"] = uuid.MustParse("00000000-0000-0000-0000-000000000002")
			},
			player:  uuid.MustParse("00000000-0000-0000-0000-000000000001"),
			payload: selectCharacterPayload{CharacterCode: "detective"},
			wantErr: true,
		},
		{
			name: "same player re-selects same character",
			setup: func(m *RoomModule) {
				m.characters["detective"] = uuid.MustParse("00000000-0000-0000-0000-000000000001")
			},
			player:  uuid.MustParse("00000000-0000-0000-0000-000000000001"),
			payload: selectCharacterPayload{CharacterCode: "detective"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewRoomModule()
			_ = m.Init(context.Background(), newTestDeps(), nil)
			if tt.setup != nil {
				tt.setup(m)
			}

			payload, _ := json.Marshal(tt.payload)
			err := m.HandleMessage(context.Background(), tt.player, "room:select_character", payload)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestRoomModule_DeselectCharacter(t *testing.T) {
	m := NewRoomModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	playerID := uuid.New()

	// Deselect without selection should fail.
	err := m.HandleMessage(context.Background(), playerID, "room:deselect_character", nil)
	if err == nil {
		t.Fatal("expected error when deselecting without selection")
	}

	// Select then deselect.
	payload, _ := json.Marshal(selectCharacterPayload{CharacterCode: "nurse"})
	_ = m.HandleMessage(context.Background(), playerID, "room:select_character", payload)

	err = m.HandleMessage(context.Background(), playerID, "room:deselect_character", nil)
	if err != nil {
		t.Fatalf("deselect failed: %v", err)
	}

	m.mu.RLock()
	if len(m.characters) != 0 {
		t.Fatalf("expected 0 characters, got %d", len(m.characters))
	}
	m.mu.RUnlock()
}

func TestRoomModule_SelectCharacter_PublishesEvent(t *testing.T) {
	deps := newTestDeps()
	m := NewRoomModule()
	_ = m.Init(context.Background(), deps, nil)

	var selectedEvent, deselectedEvent bool
	deps.EventBus.Subscribe("room.character_selected", func(e engine.Event) { selectedEvent = true })
	deps.EventBus.Subscribe("room.character_deselected", func(e engine.Event) { deselectedEvent = true })

	playerID := uuid.New()
	payload, _ := json.Marshal(selectCharacterPayload{CharacterCode: "butler"})
	_ = m.HandleMessage(context.Background(), playerID, "room:select_character", payload)
	if !selectedEvent {
		t.Fatal("room.character_selected event not published")
	}

	_ = m.HandleMessage(context.Background(), playerID, "room:deselect_character", nil)
	if !deselectedEvent {
		t.Fatal("room.character_deselected event not published")
	}
}

func TestRoomModule_BuildState(t *testing.T) {
	m := NewRoomModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var state roomState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if state.Phase != "waiting" {
		t.Fatalf("expected phase %q, got %q", "waiting", state.Phase)
	}
}

func TestRoomModule_UnknownMessage(t *testing.T) {
	m := NewRoomModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "room:unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestRoomModule_Cleanup(t *testing.T) {
	m := NewRoomModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.characters != nil {
		t.Fatal("expected characters to be nil after cleanup")
	}
}
