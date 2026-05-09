package communication

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"
	"time"

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

type fakeGroupChatTimers struct {
	timers []*fakeGroupChatTimer
}

func (f *fakeGroupChatTimers) AfterFunc(d time.Duration, fn func()) groupChatTimer {
	timer := &fakeGroupChatTimer{duration: d, fn: fn}
	f.timers = append(f.timers, timer)
	return timer
}

func (f *fakeGroupChatTimers) Count() int {
	return len(f.timers)
}

func (f *fakeGroupChatTimers) Fire(index int) {
	f.timers[index].fn()
}

type fakeGroupChatTimer struct {
	duration time.Duration
	fn       func()
	stopped  bool
}

func (t *fakeGroupChatTimer) Stop() bool {
	t.stopped = true
	return true
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
	if len(actions) != 5 {
		t.Fatalf("expected 5 supported actions, got %d", len(actions))
	}
}

func TestGroupChatModule_ApplyDiscussionRoomPolicyOpensPhaseRooms(t *testing.T) {
	m, deps := initGroupChat(t)
	var applied bool
	deps.EventBus.Subscribe("groupchat.policy_applied", func(_ engine.Event) {
		applied = true
	})

	payload := json.RawMessage(`{
		"enabled": true,
		"mainRoomName": "추리 회의",
		"privateRoomsEnabled": true,
		"privateRoomName": "2인 밀담",
		"availability": "phase_active"
	}`)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionApplyDiscussionRoom,
		Params: payload,
	}); err != nil {
		t.Fatalf("apply policy: %v", err)
	}

	if !applied {
		t.Fatal("expected groupchat.policy_applied event")
	}

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var s groupChatState
	if err := json.Unmarshal(state, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !s.IsOpen {
		t.Fatal("expected room policy to open phase-active discussion rooms")
	}
	if len(s.Rooms) != 2 {
		t.Fatalf("rooms = %d, want 2: %+v", len(s.Rooms), s.Rooms)
	}
	if s.Rooms[0].ID != "main" || s.Rooms[0].Name != "추리 회의" {
		t.Fatalf("main room not normalized: %+v", s.Rooms[0])
	}
	if s.Rooms[1].ID != "private" || s.Rooms[1].Name != "2인 밀담" {
		t.Fatalf("private room not normalized: %+v", s.Rooms[1])
	}
}

func TestGroupChatModule_ApplyDiscussionRoomPolicyCreatesMultiplePrivateRooms(t *testing.T) {
	m, _ := initGroupChat(t)

	payload := json.RawMessage(`{
		"enabled": true,
		"mainRoomName": "",
		"availability": "phase_active",
		"privateRooms": [
			{"id":"room-alpha","name":"알파 밀담","maxMembers":3},
			{"id":"","name":"","maxMembers":1}
		]
	}`)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionApplyDiscussionRoom,
		Params: payload,
	}); err != nil {
		t.Fatalf("apply policy: %v", err)
	}

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var s groupChatState
	if err := json.Unmarshal(state, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(s.Rooms) != 3 {
		t.Fatalf("rooms = %d, want main + 2 private: %+v", len(s.Rooms), s.Rooms)
	}
	if s.Rooms[0].ID != "main" || s.Rooms[0].Name != "전체토론방" {
		t.Fatalf("main fallback not normalized: %+v", s.Rooms[0])
	}
	if s.Rooms[1].ID != "room-alpha" || s.Rooms[1].Name != "알파 밀담" || s.Rooms[1].MaxMembers != 3 {
		t.Fatalf("first private room not normalized: %+v", s.Rooms[1])
	}
	if s.Rooms[2].ID != "private-2" || s.Rooms[2].Name != "밀담방 2" || s.Rooms[2].MaxMembers != 2 {
		t.Fatalf("fallback private room not normalized with min capacity: %+v", s.Rooms[2])
	}

	for i := 0; i < 2; i++ {
		if err := m.HandleMessage(context.Background(), uuid.New(), "groupchat:join",
			json.RawMessage(`{"roomId":"private-2"}`)); err != nil {
			t.Fatalf("join fallback private %d: %v", i, err)
		}
	}
	if err := m.HandleMessage(context.Background(), uuid.New(), "groupchat:join",
		json.RawMessage(`{"roomId":"private-2"}`)); err == nil {
		t.Fatal("expected fallback private room capacity to be enforced at min 2")
	}
}

func TestGroupChatModule_ApplyDiscussionRoomPolicyNormalizesReservedAndDuplicatePrivateRoomIDs(t *testing.T) {
	m, _ := initGroupChat(t)

	payload := json.RawMessage(`{
		"enabled": true,
		"availability": "phase_active",
		"privateRooms": [
			{"id":"main","name":"메인 충돌","maxMembers":2},
			{"id":"conditional","name":"조건부 충돌","maxMembers":2},
			{"id":"main","name":"중복 충돌","maxMembers":2},
			{"id":"","name":"빈 ID","maxMembers":2}
		]
	}`)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionApplyDiscussionRoom,
		Params: payload,
	}); err != nil {
		t.Fatalf("apply policy: %v", err)
	}

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var s groupChatState
	if err := json.Unmarshal(state, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(s.Rooms) != 5 {
		t.Fatalf("rooms = %d, want main + 4 private: %+v", len(s.Rooms), s.Rooms)
	}
	seen := make(map[string]struct{})
	for _, room := range s.Rooms {
		if _, exists := seen[room.ID]; exists {
			t.Fatalf("duplicate room id %q in %+v", room.ID, s.Rooms)
		}
		seen[room.ID] = struct{}{}
	}
	if s.Rooms[0].ID != "main" || s.Rooms[0].Name != "전체토론방" {
		t.Fatalf("main room was overwritten: %+v", s.Rooms[0])
	}
	if _, exists := seen["conditional"]; exists {
		t.Fatalf("private room reused reserved conditional id: %+v", s.Rooms)
	}
	for _, roomID := range []string{"private-1", "private-2", "private-3", "private-4"} {
		if _, exists := seen[roomID]; !exists {
			t.Fatalf("missing normalized private room id %q in %+v", roomID, s.Rooms)
		}
	}
}

func TestGroupChatModule_ApplyDiscussionRoomPolicyLegacyPrivateRoomStillWorks(t *testing.T) {
	m, _ := initGroupChat(t)

	payload := json.RawMessage(`{
		"enabled": true,
		"mainRoomName": "추리 회의",
		"privateRoomsEnabled": true,
		"privateRoomName": "기존 밀담",
		"availability": "phase_active"
	}`)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionApplyDiscussionRoom,
		Params: payload,
	}); err != nil {
		t.Fatalf("apply policy: %v", err)
	}

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var s groupChatState
	if err := json.Unmarshal(state, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(s.Rooms) != 2 {
		t.Fatalf("rooms = %d, want main + legacy private: %+v", len(s.Rooms), s.Rooms)
	}
	if s.Rooms[1].ID != "private" || s.Rooms[1].Name != "기존 밀담" {
		t.Fatalf("legacy private room changed: %+v", s.Rooms[1])
	}
}

func TestGroupChatModule_DiscussionPrivateRoomNonPositiveTimeLimitsAreUnlimited(t *testing.T) {
	m, _ := initGroupChat(t)
	fakeTimers := &fakeGroupChatTimers{}
	m.timerFactory = fakeTimers.AfterFunc

	payload := json.RawMessage(`{
		"enabled": true,
		"availability": "phase_active",
		"privateRooms": [
			{"id":"nil-limit","name":"Nil","maxMembers":2},
			{"id":"zero-limit","name":"Zero","maxMembers":2,"timeLimitSeconds":0},
			{"id":"negative-limit","name":"Negative","maxMembers":2,"timeLimitSeconds":-5}
		]
	}`)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionApplyDiscussionRoom,
		Params: payload,
	}); err != nil {
		t.Fatalf("apply policy: %v", err)
	}

	for _, roomID := range []string{"nil-limit", "zero-limit", "negative-limit"} {
		if err := m.HandleMessage(context.Background(), uuid.New(), "groupchat:join",
			json.RawMessage(`{"roomId":"`+roomID+`"}`)); err != nil {
			t.Fatalf("join %s: %v", roomID, err)
		}
	}
	if fakeTimers.Count() != 0 {
		t.Fatalf("non-positive limits should not schedule timers, got %d", fakeTimers.Count())
	}
}

func TestGroupChatModule_TimedDiscussionPrivateRoomReturnsMembersToMain(t *testing.T) {
	m, deps := initGroupChat(t)
	fakeTimers := &fakeGroupChatTimers{}
	m.timerFactory = fakeTimers.AfterFunc
	var expired bool
	deps.EventBus.Subscribe("groupchat.room_expired", func(e engine.Event) {
		expired = true
		payload, ok := e.Payload.(map[string]any)
		if !ok || payload["roomId"] != "timer-room" || payload["targetRoomId"] != "main" {
			t.Fatalf("unexpected expiration event payload: %#v", e.Payload)
		}
	})

	payload := json.RawMessage(`{
		"enabled": true,
		"availability": "phase_active",
		"privateRooms": [
			{"id":"timer-room","name":"3초 밀담","maxMembers":2,"timeLimitSeconds":3}
		]
	}`)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionApplyDiscussionRoom,
		Params: payload,
	}); err != nil {
		t.Fatalf("apply policy: %v", err)
	}

	alice := uuid.New()
	if err := m.HandleMessage(context.Background(), alice, "groupchat:join",
		json.RawMessage(`{"roomId":"timer-room"}`)); err != nil {
		t.Fatalf("join timed private room: %v", err)
	}
	if got := fakeTimers.Count(); got != 1 {
		t.Fatalf("scheduled timers = %d, want 1", got)
	}
	if fakeTimers.timers[0].duration != 3*time.Second {
		t.Fatalf("timer duration = %v, want 3s", fakeTimers.timers[0].duration)
	}

	fakeTimers.Fire(0)

	m.mu.RLock()
	if m.playerRoom[alice] != "main" {
		t.Fatalf("player room after expiration = %q, want main", m.playerRoom[alice])
	}
	if len(m.rooms["timer-room"].Members) != 0 {
		t.Fatalf("timer room members after expiration = %+v", m.rooms["timer-room"].Members)
	}
	if len(m.rooms["main"].Members) != 1 || m.rooms["main"].Members[0] != alice {
		t.Fatalf("main room members after expiration = %+v", m.rooms["main"].Members)
	}
	m.mu.RUnlock()
	if !expired {
		t.Fatal("expected groupchat.room_expired event")
	}
}

func TestGroupChatModule_StaleDiscussionRoomTimerCannotExpireRecreatedRoom(t *testing.T) {
	m, deps := initGroupChat(t)
	fakeTimers := &fakeGroupChatTimers{}
	m.timerFactory = fakeTimers.AfterFunc
	expiredEvents := 0
	deps.EventBus.Subscribe("groupchat.room_expired", func(_ engine.Event) {
		expiredEvents++
	})

	payload := json.RawMessage(`{
		"enabled": true,
		"availability": "phase_active",
		"privateRooms": [
			{"id":"timer-room","name":"타이머 밀담","maxMembers":2,"timeLimitSeconds":1}
		]
	}`)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionApplyDiscussionRoom,
		Params: payload,
	}); err != nil {
		t.Fatalf("apply first policy: %v", err)
	}
	alice := uuid.New()
	if err := m.HandleMessage(context.Background(), alice, "groupchat:join",
		json.RawMessage(`{"roomId":"timer-room"}`)); err != nil {
		t.Fatalf("alice join timed room: %v", err)
	}
	if got := fakeTimers.Count(); got != 1 {
		t.Fatalf("scheduled timers after first join = %d, want 1", got)
	}

	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionApplyDiscussionRoom,
		Params: payload,
	}); err != nil {
		t.Fatalf("apply recreated policy: %v", err)
	}
	bob := uuid.New()
	if err := m.HandleMessage(context.Background(), bob, "groupchat:join",
		json.RawMessage(`{"roomId":"timer-room"}`)); err != nil {
		t.Fatalf("bob join recreated timed room: %v", err)
	}
	if got := fakeTimers.Count(); got != 2 {
		t.Fatalf("scheduled timers after recreated join = %d, want 2", got)
	}

	fakeTimers.Fire(0)
	m.mu.RLock()
	if m.playerRoom[bob] != "timer-room" {
		t.Fatalf("stale timer moved recreated room member to %q", m.playerRoom[bob])
	}
	if len(m.rooms["timer-room"].Members) != 1 || m.rooms["timer-room"].Members[0] != bob {
		t.Fatalf("stale timer mutated recreated room members: %+v", m.rooms["timer-room"].Members)
	}
	m.mu.RUnlock()
	if expiredEvents != 0 {
		t.Fatalf("stale timer published %d expiration events", expiredEvents)
	}

	fakeTimers.Fire(1)
	m.mu.RLock()
	if m.playerRoom[bob] != "main" {
		t.Fatalf("current timer left recreated room member in %q", m.playerRoom[bob])
	}
	m.mu.RUnlock()
	if expiredEvents != 1 {
		t.Fatalf("current timer expiration events = %d, want 1", expiredEvents)
	}
}

func TestGroupChatModule_ApplyDiscussionRoomPolicyConditionKeepsRoomsClosed(t *testing.T) {
	m, _ := initGroupChat(t)

	payload := json.RawMessage(`{
		"enabled": true,
		"mainRoomName": "전체 토론",
		"availability": "condition",
		"conditionalRoomName": "비밀 토론"
	}`)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionApplyDiscussionRoom,
		Params: payload,
	}); err != nil {
		t.Fatalf("apply policy: %v", err)
	}

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var s groupChatState
	if err := json.Unmarshal(state, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if s.IsOpen {
		t.Fatal("condition-gated discussion rooms must remain closed until runtime trigger opens them")
	}
	if len(s.Rooms) != 2 {
		t.Fatalf("rooms = %d, want main + conditional: %+v", len(s.Rooms), s.Rooms)
	}
	if s.Rooms[1].ID != "conditional" || s.Rooms[1].Name != "비밀 토론" {
		t.Fatalf("conditional room not exposed as metadata: %+v", s.Rooms[1])
	}

	err = m.HandleMessage(context.Background(), uuid.New(), "groupchat:join", json.RawMessage(`{"roomId":"main"}`))
	if err == nil {
		t.Fatal("expected backend to reject room join while condition-gated room is closed")
	}
}

func TestGroupChatModule_BuildStateFor_PolicyGeneratedPrivateRoomRedactsMessages(t *testing.T) {
	m, _ := initGroupChat(t)
	payload := json.RawMessage(`{
		"enabled": true,
		"mainRoomName": "추리 회의",
		"privateRoomsEnabled": true,
		"privateRoomName": "밀담",
		"availability": "phase_active"
	}`)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionApplyDiscussionRoom,
		Params: payload,
	}); err != nil {
		t.Fatalf("apply policy: %v", err)
	}

	alice := uuid.New()
	bob := uuid.New()
	if err := m.HandleMessage(context.Background(), alice, "groupchat:join",
		json.RawMessage(`{"roomId":"private"}`)); err != nil {
		t.Fatalf("alice join private: %v", err)
	}
	if err := m.HandleMessage(context.Background(), bob, "groupchat:join",
		json.RawMessage(`{"roomId":"main"}`)); err != nil {
		t.Fatalf("bob join main: %v", err)
	}
	if err := m.HandleMessage(context.Background(), alice, "groupchat:send",
		json.RawMessage(`{"roomId":"private","message":"밀담 내용","characterCode":"A"}`)); err != nil {
		t.Fatalf("alice send private: %v", err)
	}

	bobData, err := m.BuildStateFor(bob)
	if err != nil {
		t.Fatalf("BuildStateFor bob: %v", err)
	}
	if bytes.Contains(bobData, []byte("밀담 내용")) {
		t.Fatalf("policy-generated private room leaked message: %s", bobData)
	}
	if bytes.Contains(bobData, []byte(alice.String())) {
		t.Fatalf("policy-generated private room leaked member uuid: %s", bobData)
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
