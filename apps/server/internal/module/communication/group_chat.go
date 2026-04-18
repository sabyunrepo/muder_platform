package communication

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
	playerRoom map[uuid.UUID]string
}

type groupChatConfig struct {
	Rooms        []GroupRoom `json:"rooms"`
	MaxPerRoom   int         `json:"maxPerRoom"`
	TimeLimit    int         `json:"timeLimit"`
	VoiceEnabled bool        `json:"voiceEnabled"`
}

// GroupRoom defines a chat room from config.
type GroupRoom struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	MaxMembers int    `json:"maxMembers"`
}

// RoomState holds runtime state for a single group chat room.
type RoomState struct {
	Members  []uuid.UUID   `json:"members"`
	Messages []ChatMessage `json:"messages"`
}

// NewGroupChatModule creates a new GroupChatModule instance.
func NewGroupChatModule() *GroupChatModule {
	return &GroupChatModule{}
}

func (m *GroupChatModule) Name() string { return "group_chat" }

func (m *GroupChatModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.rooms = make(map[string]*RoomState)
	m.playerRoom = make(map[uuid.UUID]string)

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
	default:
		m.mu.Unlock()
		return fmt.Errorf("group_chat: unsupported action %q", action.Action)
	}
	return nil
}

// SupportedActions returns the phase actions this module handles.
func (m *GroupChatModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{
		engine.ActionOpenGroupChat,
		engine.ActionCloseGroupChat,
		engine.ActionMuteChat,
		engine.ActionUnmuteChat,
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

// BuildStateFor returns the same state as BuildState for now.
// PR-2a (F-sec-2 gate): satisfies engine.PlayerAwareModule interface.
// PR-2b will add per-player redaction (players outside a given room should
// not see that room's message history or full member list).
func (m *GroupChatModule) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	return m.BuildState()
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
