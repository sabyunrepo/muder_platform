package communication

import (
	"bytes"
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

// --- PR-2b: per-caller room isolation ---

func openGroupChatAndJoin(t *testing.T, m *GroupChatModule, deps engine.ModuleDeps) {
	t.Helper()
	if err := m.ReactTo(context.Background(),
		engine.PhaseActionPayload{Action: engine.ActionOpenGroupChat}); err != nil {
		t.Fatalf("open: %v", err)
	}
}

func TestGroupChatModule_BuildStateFor_CallerRoomMessagesAndMembers(t *testing.T) {
	m, deps := initGroupChat(t)
	openGroupChatAndJoin(t, m, deps)

	alice := uuid.New()
	bob := uuid.New()
	if err := m.HandleMessage(context.Background(), alice, "groupchat:join",
		json.RawMessage(`{"roomId":"room-a"}`)); err != nil {
		t.Fatalf("alice join: %v", err)
	}
	if err := m.HandleMessage(context.Background(), bob, "groupchat:join",
		json.RawMessage(`{"roomId":"room-b"}`)); err != nil {
		t.Fatalf("bob join: %v", err)
	}
	if err := m.HandleMessage(context.Background(), alice, "groupchat:send",
		json.RawMessage(`{"roomId":"room-a","message":"hey A","characterCode":"A"}`)); err != nil {
		t.Fatalf("alice send: %v", err)
	}
	if err := m.HandleMessage(context.Background(), bob, "groupchat:send",
		json.RawMessage(`{"roomId":"room-b","message":"hey B secret","characterCode":"B"}`)); err != nil {
		t.Fatalf("bob send: %v", err)
	}

	data, err := m.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	var s groupChatState
	if err := json.Unmarshal(data, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	var roomA, roomB *groupChatRoomInfo
	for i := range s.Rooms {
		switch s.Rooms[i].ID {
		case "room-a":
			roomA = &s.Rooms[i]
		case "room-b":
			roomB = &s.Rooms[i]
		}
	}
	if roomA == nil || roomB == nil {
		t.Fatalf("expected both rooms in metadata, got %+v", s.Rooms)
	}

	if len(roomA.Messages) != 1 || roomA.Messages[0].Message != "hey A" {
		t.Fatalf("room-a should expose alice's message to alice, got %+v", roomA.Messages)
	}
	if len(roomA.Members) != 1 || roomA.Members[0] != alice.String() {
		t.Fatalf("room-a members should be [alice], got %+v", roomA.Members)
	}

	if len(roomB.Messages) != 0 {
		t.Fatalf("room-b messages must be empty in alice's view, got %+v", roomB.Messages)
	}
	if len(roomB.Members) != 0 {
		t.Fatalf("room-b members must be empty in alice's view, got %+v", roomB.Members)
	}
	// MemberCount is public metadata and is retained.
	if roomB.MemberCount != 1 {
		t.Fatalf("room-b memberCount should be 1 (bob), got %d", roomB.MemberCount)
	}
}

func TestGroupChatModule_BuildStateFor_NonMemberSeesMetaOnly(t *testing.T) {
	m, deps := initGroupChat(t)
	openGroupChatAndJoin(t, m, deps)

	alice := uuid.New()
	if err := m.HandleMessage(context.Background(), alice, "groupchat:join",
		json.RawMessage(`{"roomId":"room-a"}`)); err != nil {
		t.Fatalf("alice join: %v", err)
	}
	if err := m.HandleMessage(context.Background(), alice, "groupchat:send",
		json.RawMessage(`{"roomId":"room-a","message":"private","characterCode":"A"}`)); err != nil {
		t.Fatalf("alice send: %v", err)
	}

	stranger := uuid.New()
	data, err := m.BuildStateFor(stranger)
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	var s groupChatState
	_ = json.Unmarshal(data, &s)
	for _, r := range s.Rooms {
		if len(r.Messages) != 0 {
			t.Fatalf("stranger should not see any messages, got %+v", r)
		}
		if len(r.Members) != 0 {
			t.Fatalf("stranger should not see member list, got %+v", r)
		}
	}
	if bytes.Contains(data, []byte("private")) {
		t.Fatalf("stranger's snapshot leaked private message: %s", data)
	}
}

func TestGroupChatModule_BuildStateFor_NoCrossRoomLeak(t *testing.T) {
	m, deps := initGroupChat(t)
	openGroupChatAndJoin(t, m, deps)

	alice := uuid.New()
	bob := uuid.New()
	if err := m.HandleMessage(context.Background(), alice, "groupchat:join",
		json.RawMessage(`{"roomId":"room-a"}`)); err != nil {
		t.Fatalf("alice join: %v", err)
	}
	if err := m.HandleMessage(context.Background(), bob, "groupchat:join",
		json.RawMessage(`{"roomId":"room-b"}`)); err != nil {
		t.Fatalf("bob join: %v", err)
	}
	if err := m.HandleMessage(context.Background(), bob, "groupchat:send",
		json.RawMessage(`{"roomId":"room-b","message":"bob-only","characterCode":"B"}`)); err != nil {
		t.Fatalf("bob send: %v", err)
	}

	aliceData, err := m.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor alice: %v", err)
	}
	if bytes.Contains(aliceData, []byte("bob-only")) {
		t.Fatalf("alice's snapshot leaked bob's room-b message: %s", aliceData)
	}
	if bytes.Contains(aliceData, []byte(bob.String())) {
		t.Fatalf("alice's snapshot leaked bob's uuid (cross-room member list): %s", aliceData)
	}
}
