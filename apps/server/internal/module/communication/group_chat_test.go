package communication

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

var groupChatTestConfig = json.RawMessage(`{
	"rooms": [
		{"id": "room-a", "name": "Room A", "maxMembers": 2},
		{"id": "room-b", "name": "Room B"}
	],
	"maxPerRoom": 3
}`)

func initGroupChat(t *testing.T) (*GroupChatModule, engine.ModuleDeps) {
	t.Helper()
	m := NewGroupChatModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, groupChatTestConfig); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	return m, deps
}

func TestGroupChatModule_Name(t *testing.T) {
	m := NewGroupChatModule()
	if m.Name() != "group_chat" {
		t.Fatalf("expected name %q, got %q", "group_chat", m.Name())
	}
}

func TestGroupChatModule_InitDefaults(t *testing.T) {
	m := NewGroupChatModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	if m.config.MaxPerRoom != 3 {
		t.Errorf("expected MaxPerRoom 3, got %d", m.config.MaxPerRoom)
	}
	if m.config.TimeLimit != 180 {
		t.Errorf("expected TimeLimit 180, got %d", m.config.TimeLimit)
	}
	if !m.config.VoiceEnabled {
		t.Error("expected VoiceEnabled true")
	}
}

func TestGroupChatModule_JoinRoom(t *testing.T) {
	m, deps := initGroupChat(t)
	ctx := context.Background()

	// Must open first.
	m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionOpenGroupChat})

	playerID := uuid.New()
	var joined bool
	deps.EventBus.Subscribe("groupchat.joined", func(e engine.Event) {
		joined = true
	})

	payload := json.RawMessage(`{"roomId":"room-a"}`)
	err := m.HandleMessage(ctx, playerID, "groupchat:join", payload)
	if err != nil {
		t.Fatalf("join failed: %v", err)
	}
	if !joined {
		t.Error("expected groupchat.joined event")
	}

	// Verify membership.
	m.mu.RLock()
	room := m.rooms["room-a"]
	if len(room.Members) != 1 || room.Members[0] != playerID {
		t.Error("player not in room-a")
	}
	m.mu.RUnlock()
}

func TestGroupChatModule_JoinWhenClosed(t *testing.T) {
	m, _ := initGroupChat(t)

	payload := json.RawMessage(`{"roomId":"room-a"}`)
	err := m.HandleMessage(context.Background(), uuid.New(), "groupchat:join", payload)
	if err == nil {
		t.Fatal("expected error when group chat is closed")
	}
}

func TestGroupChatModule_JoinRoomFull(t *testing.T) {
	m, _ := initGroupChat(t)
	ctx := context.Background()
	m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionOpenGroupChat})

	// room-a has maxMembers=2.
	for i := 0; i < 2; i++ {
		payload := json.RawMessage(`{"roomId":"room-a"}`)
		if err := m.HandleMessage(ctx, uuid.New(), "groupchat:join", payload); err != nil {
			t.Fatalf("join %d failed: %v", i, err)
		}
	}

	// Third player should be rejected.
	payload := json.RawMessage(`{"roomId":"room-a"}`)
	err := m.HandleMessage(ctx, uuid.New(), "groupchat:join", payload)
	if err == nil {
		t.Fatal("expected error when room is full")
	}
}

func TestGroupChatModule_JoinSwitchesRoom(t *testing.T) {
	m, _ := initGroupChat(t)
	ctx := context.Background()
	m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionOpenGroupChat})

	playerID := uuid.New()

	// Join room-a.
	m.HandleMessage(ctx, playerID, "groupchat:join", json.RawMessage(`{"roomId":"room-a"}`))

	// Join room-b — should auto-leave room-a.
	m.HandleMessage(ctx, playerID, "groupchat:join", json.RawMessage(`{"roomId":"room-b"}`))

	m.mu.RLock()
	if len(m.rooms["room-a"].Members) != 0 {
		t.Error("expected player removed from room-a")
	}
	if len(m.rooms["room-b"].Members) != 1 {
		t.Error("expected player in room-b")
	}
	m.mu.RUnlock()
}

func TestGroupChatModule_LeaveRoom(t *testing.T) {
	m, deps := initGroupChat(t)
	ctx := context.Background()
	m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionOpenGroupChat})

	playerID := uuid.New()
	m.HandleMessage(ctx, playerID, "groupchat:join", json.RawMessage(`{"roomId":"room-a"}`))

	var left bool
	deps.EventBus.Subscribe("groupchat.left", func(e engine.Event) {
		left = true
	})

	err := m.HandleMessage(ctx, playerID, "groupchat:leave", nil)
	if err != nil {
		t.Fatalf("leave failed: %v", err)
	}
	if !left {
		t.Error("expected groupchat.left event")
	}
}

func TestGroupChatModule_LeaveNotInRoom(t *testing.T) {
	m, _ := initGroupChat(t)
	ctx := context.Background()

	err := m.HandleMessage(ctx, uuid.New(), "groupchat:leave", nil)
	if err == nil {
		t.Fatal("expected error when player is not in any room")
	}
}

func TestGroupChatModule_SendMessage(t *testing.T) {
	m, deps := initGroupChat(t)
	ctx := context.Background()
	m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionOpenGroupChat})

	playerID := uuid.New()
	m.HandleMessage(ctx, playerID, "groupchat:join", json.RawMessage(`{"roomId":"room-a"}`))

	var msgReceived bool
	deps.EventBus.Subscribe("groupchat.message", func(e engine.Event) {
		msgReceived = true
	})

	payload, _ := json.Marshal(map[string]any{
		"roomId":  "room-a",
		"message": "hello group",
	})
	err := m.HandleMessage(ctx, playerID, "groupchat:send", payload)
	if err != nil {
		t.Fatalf("send failed: %v", err)
	}
	if !msgReceived {
		t.Error("expected groupchat.message event")
	}
}

func TestGroupChatModule_SendNotInRoom(t *testing.T) {
	m, _ := initGroupChat(t)
	ctx := context.Background()
	m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionOpenGroupChat})

	payload, _ := json.Marshal(map[string]any{
		"roomId":  "room-a",
		"message": "hello",
	})
	err := m.HandleMessage(ctx, uuid.New(), "groupchat:send", payload)
	if err == nil {
		t.Fatal("expected error when player is not in the room")
	}
}

func TestGroupChatModule_SendMuted(t *testing.T) {
	m, _ := initGroupChat(t)
	ctx := context.Background()
	m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionOpenGroupChat})

	playerID := uuid.New()
	m.HandleMessage(ctx, playerID, "groupchat:join", json.RawMessage(`{"roomId":"room-a"}`))
	m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionMuteChat})

	payload, _ := json.Marshal(map[string]any{
		"roomId":  "room-a",
		"message": "muted",
	})
	err := m.HandleMessage(ctx, playerID, "groupchat:send", payload)
	if err == nil {
		t.Fatal("expected error when chat is muted")
	}
}

func TestGroupChatModule_CloseGroupChat(t *testing.T) {
	m, _ := initGroupChat(t)
	ctx := context.Background()
	m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionOpenGroupChat})

	playerID := uuid.New()
	m.HandleMessage(ctx, playerID, "groupchat:join", json.RawMessage(`{"roomId":"room-a"}`))

	// Close clears all rooms.
	m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionCloseGroupChat})

	m.mu.RLock()
	if m.isOpen {
		t.Error("expected isOpen false after close")
	}
	if len(m.rooms["room-a"].Members) != 0 {
		t.Error("expected room-a to be cleared")
	}
	m.mu.RUnlock()
}

func TestGroupChatModule_BuildState(t *testing.T) {
	m, _ := initGroupChat(t)
	ctx := context.Background()
	m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionOpenGroupChat})

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var s groupChatState
	json.Unmarshal(state, &s)
	if !s.IsOpen {
		t.Error("expected isOpen true")
	}
	if len(s.Rooms) != 2 {
		t.Errorf("expected 2 rooms, got %d", len(s.Rooms))
	}
}

func TestGroupChatModule_SupportedActions(t *testing.T) {
	m := NewGroupChatModule()
	actions := m.SupportedActions()
	if len(actions) != 4 {
		t.Fatalf("expected 4 supported actions, got %d", len(actions))
	}
}

func TestGroupChatModule_Schema(t *testing.T) {
	m := NewGroupChatModule()
	schema := m.Schema()
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("schema is not valid JSON: %v", err)
	}
}

func TestGroupChatModule_UnknownMessageType(t *testing.T) {
	m, _ := initGroupChat(t)
	err := m.HandleMessage(context.Background(), uuid.New(), "groupchat:unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestGroupChatModule_Cleanup(t *testing.T) {
	m, _ := initGroupChat(t)
	err := m.Cleanup(context.Background())
	if err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}
	if m.rooms != nil {
		t.Error("expected rooms to be nil after cleanup")
	}
}
