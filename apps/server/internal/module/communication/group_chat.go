package communication

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("group_chat", func() engine.Module { return NewGroupChatModule() })
}

// GroupChatModule manages room-based group chat with open/close lifecycle.
type GroupChatModule struct {
	mu      sync.RWMutex
	deps    engine.ModuleDeps
	config  groupChatConfig
	rooms   map[string]*RoomState
	isOpen  bool
	isMuted bool
	// playerRoom tracks which room each player is in for fast lookup.
	playerRoom      map[uuid.UUID]string
	roomTimers      map[string]groupChatTimer
	roomTimerTokens map[string]uint64
	nextTimerToken  uint64
	timerFactory    groupChatTimerFactory
}

type groupChatConfig struct {
	Rooms        []GroupRoom `json:"rooms"`
	MaxPerRoom   int         `json:"maxPerRoom"`
	TimeLimit    int         `json:"timeLimit"`
	VoiceEnabled bool        `json:"voiceEnabled"`
}

// GroupRoom defines a chat room from config.
type GroupRoom struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	MaxMembers       int    `json:"maxMembers"`
	TimeLimitSeconds *int   `json:"timeLimitSeconds,omitempty"`
}

type discussionRoomPolicy struct {
	Enabled             bool                          `json:"enabled"`
	MainRoomName        string                        `json:"mainRoomName"`
	PrivateRooms        []discussionPrivateRoomPolicy `json:"privateRooms"`
	CloseBehavior       string                        `json:"closeBehavior"`
	PrivateRoomsEnabled bool                          `json:"privateRoomsEnabled"`
	PrivateRoomName     string                        `json:"privateRoomName"`
	Availability        string                        `json:"availability"`
	ConditionalRoomName string                        `json:"conditionalRoomName"`
	Condition           json.RawMessage               `json:"condition,omitempty"`
}

type discussionPrivateRoomPolicy struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	MaxMembers       int    `json:"maxMembers"`
	TimeLimitSeconds *int   `json:"timeLimitSeconds"`
}

type groupChatTimer interface {
	Stop() bool
}

type groupChatTimerFactory func(time.Duration, func()) groupChatTimer

type realGroupChatTimer struct {
	timer *time.Timer
}

func (t realGroupChatTimer) Stop() bool {
	return t.timer.Stop()
}

func newGroupChatTimer(d time.Duration, fn func()) groupChatTimer {
	return realGroupChatTimer{timer: time.AfterFunc(d, fn)}
}

// RoomState holds runtime state for a single group chat room.
type RoomState struct {
	Members  []uuid.UUID   `json:"members"`
	Messages []ChatMessage `json:"messages"`
}

// NewGroupChatModule creates a new GroupChatModule instance.
func NewGroupChatModule() *GroupChatModule {
	return &GroupChatModule{timerFactory: newGroupChatTimer}
}

func (m *GroupChatModule) Name() string { return "group_chat" }

func (m *GroupChatModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.rooms = make(map[string]*RoomState)
	m.playerRoom = make(map[uuid.UUID]string)
	m.roomTimers = make(map[string]groupChatTimer)
	m.roomTimerTokens = make(map[string]uint64)
	if m.timerFactory == nil {
		m.timerFactory = newGroupChatTimer
	}

	m.config = groupChatConfig{
		MaxPerRoom:   3,
		TimeLimit:    180,
		VoiceEnabled: true,
	}
	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("group_chat: invalid config: %w", err)
		}
	}

	// Initialize rooms from config.
	for _, room := range m.config.Rooms {
		m.rooms[room.ID] = &RoomState{
			Members:  make([]uuid.UUID, 0),
			Messages: make([]ChatMessage, 0),
		}
	}
	return nil
}

type groupChatJoinPayload struct {
	RoomID string `json:"roomId"`
}

type groupChatSendPayload struct {
	RoomID        string `json:"roomId"`
	Message       string `json:"message"`
	CharacterCode string `json:"characterCode"`
}

func (m *GroupChatModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "groupchat:join":
		return m.handleJoin(playerID, payload)
	case "groupchat:leave":
		return m.handleLeave(playerID)
	case "groupchat:send":
		return m.handleSend(playerID, payload)
	default:
		return fmt.Errorf("group_chat: unknown message type %q", msgType)
	}
}

func (m *GroupChatModule) handleJoin(playerID uuid.UUID, payload json.RawMessage) error {
	var p groupChatJoinPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("group_chat: invalid groupchat:join payload: %w", err)
	}

	m.mu.Lock()

	if !m.isOpen {
		m.mu.Unlock()
		return fmt.Errorf("group_chat: group chat is not open")
	}

	room, ok := m.rooms[p.RoomID]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("group_chat: room %q not found", p.RoomID)
	}

	// Check if already in a room — leave first.
	if currentRoom, inRoom := m.playerRoom[playerID]; inRoom {
		m.removeFromRoom(playerID, currentRoom)
	}

	// Check room capacity.
	maxMembers := m.config.MaxPerRoom
	for _, r := range m.config.Rooms {
		if r.ID == p.RoomID && r.MaxMembers > 0 {
			maxMembers = r.MaxMembers
			break
		}
	}
	if len(room.Members) >= maxMembers {
		m.mu.Unlock()
		return fmt.Errorf("group_chat: room %q is full (%d/%d)", p.RoomID, len(room.Members), maxMembers)
	}

	room.Members = append(room.Members, playerID)
	m.playerRoom[playerID] = p.RoomID
	roomID := p.RoomID
	m.startRoomTimerLocked(roomID)
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "groupchat.joined",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"roomId":   roomID,
		},
	})
	return nil
}

func (m *GroupChatModule) handleLeave(playerID uuid.UUID) error {
	m.mu.Lock()

	roomID, ok := m.playerRoom[playerID]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("group_chat: player is not in any room")
	}

	m.removeFromRoom(playerID, roomID)
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "groupchat.left",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"roomId":   roomID,
		},
	})
	return nil
}

// removeFromRoom removes a player from a room. Caller must hold m.mu.
func (m *GroupChatModule) removeFromRoom(playerID uuid.UUID, roomID string) {
	room, ok := m.rooms[roomID]
	if !ok {
		return
	}
	for i, member := range room.Members {
		if member == playerID {
			room.Members = append(room.Members[:i], room.Members[i+1:]...)
			break
		}
	}
	delete(m.playerRoom, playerID)
	if len(room.Members) == 0 {
		m.stopRoomTimerLocked(roomID)
	}
}

func (m *GroupChatModule) handleSend(playerID uuid.UUID, payload json.RawMessage) error {
	var p groupChatSendPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("group_chat: invalid groupchat:send payload: %w", err)
	}

	if len(p.Message) == 0 {
		return fmt.Errorf("group_chat: empty message")
	}

	m.mu.Lock()

	if m.isMuted {
		m.mu.Unlock()
		return fmt.Errorf("group_chat: chat is muted")
	}

	// Verify player is in the specified room.
	currentRoom, ok := m.playerRoom[playerID]
	if !ok || currentRoom != p.RoomID {
		m.mu.Unlock()
		return fmt.Errorf("group_chat: player is not in room %q", p.RoomID)
	}

	room := m.rooms[p.RoomID]
	now := time.Now()
	msg := ChatMessage{
		SenderID:      playerID,
		CharacterCode: p.CharacterCode,
		Message:       p.Message,
		Timestamp:     now,
	}
	room.Messages = append(room.Messages, msg)

	// Capture values for event before unlocking.
	charCode := p.CharacterCode
	roomID := p.RoomID
	message := p.Message
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "groupchat.message",
		Payload: map[string]any{
			"senderId":      playerID.String(),
			"characterCode": charCode,
			"roomId":        roomID,
			"message":       message,
			"timestamp":     now,
		},
	})
	return nil
}

// ReactTo handles group chat phase actions.
func (m *GroupChatModule) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	m.mu.Lock()

	switch action.Action {
	case engine.ActionOpenGroupChat:
		m.isOpen = true
		m.mu.Unlock()
		m.deps.EventBus.Publish(engine.Event{
			Type:    "groupchat.opened",
			Payload: map[string]any{},
		})
	case engine.ActionCloseGroupChat:
		// Clear all rooms.
		m.stopRoomTimersLocked()
		for _, room := range m.rooms {
			room.Members = make([]uuid.UUID, 0)
			room.Messages = make([]ChatMessage, 0)
		}
		m.playerRoom = make(map[uuid.UUID]string)
		m.isOpen = false
		m.mu.Unlock()
		m.deps.EventBus.Publish(engine.Event{
			Type:    "groupchat.closed",
			Payload: map[string]any{},
		})
	case engine.ActionMuteChat:
		m.isMuted = true
		m.mu.Unlock()
	case engine.ActionUnmuteChat:
		m.isMuted = false
		m.mu.Unlock()
	case engine.ActionApplyDiscussionRoom:
		var policy discussionRoomPolicy
		if len(action.Params) > 0 {
			if err := json.Unmarshal(action.Params, &policy); err != nil {
				m.mu.Unlock()
				return fmt.Errorf("group_chat: invalid discussion room policy: %w", err)
			}
		}
		m.applyDiscussionRoomPolicy(policy)
		m.mu.Unlock()
		m.deps.EventBus.Publish(engine.Event{
			Type: "groupchat.policy_applied",
			Payload: map[string]any{
				"enabled": policy.Enabled,
				"isOpen":  policy.Enabled && policy.Availability != "condition",
			},
		})
	default:
		m.mu.Unlock()
		return fmt.Errorf("group_chat: unsupported action %q", action.Action)
	}
	return nil
}

func (m *GroupChatModule) applyDiscussionRoomPolicy(policy discussionRoomPolicy) {
	m.stopRoomTimersLocked()
	m.playerRoom = make(map[uuid.UUID]string)
	m.rooms = make(map[string]*RoomState)
	m.config.Rooms = nil
	m.isOpen = false

	if !policy.Enabled {
		return
	}

	usedRoomIDs := map[string]struct{}{
		"main":        {},
		"conditional": {},
	}
	rooms := []GroupRoom{{
		ID:   "main",
		Name: discussionRoomName(policy.MainRoomName, "전체토론방"),
	}}
	if len(policy.PrivateRooms) > 0 {
		for i, privateRoom := range policy.PrivateRooms {
			room := normalizeDiscussionPrivateRoom(privateRoom, i, usedRoomIDs)
			rooms = append(rooms, room)
			usedRoomIDs[room.ID] = struct{}{}
		}
	} else if policy.PrivateRoomsEnabled {
		roomID := uniqueDiscussionRoomID("private", 0, usedRoomIDs)
		rooms = append(rooms, GroupRoom{
			ID:   roomID,
			Name: discussionRoomName(policy.PrivateRoomName, "밀담방"),
		})
		usedRoomIDs[roomID] = struct{}{}
	}
	if policy.Availability == "condition" && strings.TrimSpace(policy.ConditionalRoomName) != "" {
		rooms = append(rooms, GroupRoom{
			ID:   "conditional",
			Name: strings.TrimSpace(policy.ConditionalRoomName),
		})
	}

	m.config.Rooms = rooms
	for _, room := range rooms {
		m.rooms[room.ID] = &RoomState{
			Members:  make([]uuid.UUID, 0),
			Messages: make([]ChatMessage, 0),
		}
	}
	m.isOpen = policy.Availability != "condition"
}

func normalizeDiscussionPrivateRoom(room discussionPrivateRoomPolicy, index int, usedRoomIDs map[string]struct{}) GroupRoom {
	id := uniqueDiscussionRoomID(strings.TrimSpace(room.ID), index, usedRoomIDs)
	name := discussionRoomName(room.Name, fmt.Sprintf("밀담방 %d", index+1))
	maxMembers := room.MaxMembers
	if maxMembers < 2 {
		maxMembers = 2
	}
	return GroupRoom{
		ID:               id,
		Name:             name,
		MaxMembers:       maxMembers,
		TimeLimitSeconds: room.TimeLimitSeconds,
	}
}

func uniqueDiscussionRoomID(preferred string, index int, usedRoomIDs map[string]struct{}) string {
	id := preferred
	if id == "" {
		id = fmt.Sprintf("private-%d", index+1)
	}
	if _, exists := usedRoomIDs[id]; !exists {
		return id
	}
	for i := index + 1; ; i++ {
		candidate := fmt.Sprintf("private-%d", i)
		if _, exists := usedRoomIDs[candidate]; !exists {
			return candidate
		}
	}
}

func discussionRoomName(value string, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

func (m *GroupChatModule) startRoomTimerLocked(roomID string) {
	if _, exists := m.roomTimers[roomID]; exists {
		return
	}
	limit := m.roomTimeLimitSecondsLocked(roomID)
	if limit <= 0 {
		return
	}
	m.nextTimerToken++
	token := m.nextTimerToken
	m.roomTimerTokens[roomID] = token
	m.roomTimers[roomID] = m.timerFactory(time.Duration(limit)*time.Second, func() {
		m.expireRoomToMain(roomID, token)
	})
}

func (m *GroupChatModule) roomTimeLimitSecondsLocked(roomID string) int {
	for _, room := range m.config.Rooms {
		if room.ID == roomID && room.TimeLimitSeconds != nil {
			return *room.TimeLimitSeconds
		}
	}
	return 0
}

func (m *GroupChatModule) stopRoomTimerLocked(roomID string) {
	timer, ok := m.roomTimers[roomID]
	if !ok {
		return
	}
	timer.Stop()
	delete(m.roomTimers, roomID)
	delete(m.roomTimerTokens, roomID)
}

func (m *GroupChatModule) stopRoomTimersLocked() {
	for roomID, timer := range m.roomTimers {
		timer.Stop()
		delete(m.roomTimers, roomID)
		delete(m.roomTimerTokens, roomID)
	}
}

func (m *GroupChatModule) expireRoomToMain(roomID string, token uint64) {
	m.mu.Lock()
	currentToken, hasToken := m.roomTimerTokens[roomID]
	if !hasToken || currentToken != token {
		m.mu.Unlock()
		return
	}
	room, ok := m.rooms[roomID]
	mainRoom, hasMain := m.rooms["main"]
	if !ok || !hasMain || roomID == "main" {
		delete(m.roomTimers, roomID)
		delete(m.roomTimerTokens, roomID)
		m.mu.Unlock()
		return
	}

	moved := append([]uuid.UUID(nil), room.Members...)
	room.Members = make([]uuid.UUID, 0)
	if len(moved) == 0 {
		delete(m.roomTimers, roomID)
		delete(m.roomTimerTokens, roomID)
		m.mu.Unlock()
		return
	}
	for _, playerID := range moved {
		m.playerRoom[playerID] = "main"
		if !uuidSliceContains(mainRoom.Members, playerID) {
			mainRoom.Members = append(mainRoom.Members, playerID)
		}
	}
	delete(m.roomTimers, roomID)
	delete(m.roomTimerTokens, roomID)
	m.mu.Unlock()

	movedPlayerIDs := make([]string, len(moved))
	for i, playerID := range moved {
		movedPlayerIDs[i] = playerID.String()
	}
	m.deps.EventBus.Publish(engine.Event{
		Type: "groupchat.room_expired",
		Payload: map[string]any{
			"roomId":         roomID,
			"targetRoomId":   "main",
			"movedPlayerIds": movedPlayerIDs,
		},
	})
}

func uuidSliceContains(values []uuid.UUID, target uuid.UUID) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

// SupportedActions returns the phase actions this module handles.
func (m *GroupChatModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{
		engine.ActionOpenGroupChat,
		engine.ActionCloseGroupChat,
		engine.ActionMuteChat,
		engine.ActionUnmuteChat,
		engine.ActionApplyDiscussionRoom,
	}
}

// Schema returns the JSON Schema for this module's settings.
func (m *GroupChatModule) Schema() json.RawMessage {
	schema := `{
		"type": "object",
		"properties": {
			"rooms": {
				"type": "array",
				"items": {
					"type": "object",
					"properties": {
						"id":         { "type": "string" },
						"name":       { "type": "string" },
						"maxMembers": { "type": "integer", "minimum": 1 }
					},
					"required": ["id", "name"]
				}
			},
			"maxPerRoom":    { "type": "integer", "default": 3, "minimum": 1 },
			"timeLimit":     { "type": "integer", "default": 180, "minimum": 0 },
			"voiceEnabled":  { "type": "boolean", "default": true }
		}
	}`
	return json.RawMessage(schema)
}

type groupChatRoomInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	MemberCount int    `json:"memberCount"`
	MaxMembers  int    `json:"maxMembers"`
	// Members and Messages are omitted from BuildState (public snapshot)
	// and populated by BuildStateFor only for the caller's own room.
	Members  []string      `json:"members,omitempty"`
	Messages []ChatMessage `json:"messages,omitempty"`
}

type groupChatState struct {
	Rooms   []groupChatRoomInfo `json:"rooms"`
	IsOpen  bool                `json:"isOpen"`
	IsMuted bool                `json:"isMuted"`
}

func (m *GroupChatModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rooms := make([]groupChatRoomInfo, 0, len(m.config.Rooms))
	for _, r := range m.config.Rooms {
		memberCount := 0
		if state, ok := m.rooms[r.ID]; ok {
			memberCount = len(state.Members)
		}
		maxMembers := m.config.MaxPerRoom
		if r.MaxMembers > 0 {
			maxMembers = r.MaxMembers
		}
		rooms = append(rooms, groupChatRoomInfo{
			ID:          r.ID,
			Name:        r.Name,
			MemberCount: memberCount,
			MaxMembers:  maxMembers,
		})
	}

	return json.Marshal(groupChatState{
		Rooms:   rooms,
		IsOpen:  m.isOpen,
		IsMuted: m.isMuted,
	})
}

func (m *GroupChatModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.rooms = nil
	m.playerRoom = nil
	m.stopRoomTimersLocked()
	return nil
}

// --- GameEventHandler ---

func (m *GroupChatModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "group:create", "group:invite", "group:send", "group:leave":
		return nil
	default:
		return fmt.Errorf("group_chat: unsupported event type %q", event.Type)
	}
}

func (m *GroupChatModule) Apply(_ context.Context, _ engine.GameEvent, state *engine.GameState) error {
	data, err := m.BuildState()
	if err != nil {
		return fmt.Errorf("group_chat: apply: %w", err)
	}
	if state.Modules == nil {
		state.Modules = make(map[string]json.RawMessage)
	}
	state.Modules[m.Name()] = data
	return nil
}

// --- SerializableModule ---

func (m *GroupChatModule) SaveState(_ context.Context) (engine.GameState, error) {
	data, err := m.BuildState()
	if err != nil {
		return engine.GameState{}, fmt.Errorf("group_chat: save state: %w", err)
	}
	return engine.GameState{Modules: map[string]json.RawMessage{m.Name(): data}}, nil
}

func (m *GroupChatModule) RestoreState(_ context.Context, _ uuid.UUID, state engine.GameState) error {
	_, ok := state.Modules[m.Name()]
	if !ok {
		return nil
	}
	// Group state is complex (rooms, players); BuildState captures it for client sync.
	// Full restore would require deserializing room structures — for now we accept
	// that group state resets on restore (groups are re-created by players).
	return nil
}

// BuildStateFor returns the group-chat snapshot redacted to the caller.
//
// Every player sees every room's metadata (id, name, member count, max
// capacity) — that is the room lobby view. The caller additionally receives
// the member list and last 50 messages only for the room they currently
// occupy. Non-members never see in-room message bodies or the full
// member-uuid list: BuildState exposes only the counts.
func (m *GroupChatModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	callerRoom := m.playerRoom[playerID] // "" if caller is in no room

	rooms := make([]groupChatRoomInfo, 0, len(m.config.Rooms))
	for _, r := range m.config.Rooms {
		info := groupChatRoomInfo{
			ID:         r.ID,
			Name:       r.Name,
			MaxMembers: m.config.MaxPerRoom,
		}
		if r.MaxMembers > 0 {
			info.MaxMembers = r.MaxMembers
		}
		if state, ok := m.rooms[r.ID]; ok {
			info.MemberCount = len(state.Members)
			if r.ID == callerRoom {
				members := make([]string, len(state.Members))
				for i, pid := range state.Members {
					members[i] = pid.String()
				}
				info.Members = members

				msgs := state.Messages
				if len(msgs) > 50 {
					msgs = msgs[len(msgs)-50:]
				}
				info.Messages = append([]ChatMessage{}, msgs...)
			}
		}
		rooms = append(rooms, info)
	}
	return json.Marshal(groupChatState{
		Rooms:   rooms,
		IsOpen:  m.isOpen,
		IsMuted: m.isMuted,
	})
}

// Compile-time interface checks.
var (
	_ engine.Module             = (*GroupChatModule)(nil)
	_ engine.PhaseReactor       = (*GroupChatModule)(nil)
	_ engine.ConfigSchema       = (*GroupChatModule)(nil)
	_ engine.GameEventHandler   = (*GroupChatModule)(nil)
	_ engine.SerializableModule = (*GroupChatModule)(nil)
	_ engine.PlayerAwareModule  = (*GroupChatModule)(nil)
)
