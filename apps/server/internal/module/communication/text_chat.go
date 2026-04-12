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
	engine.Register("text_chat", func() engine.Module { return NewTextChatModule() })
}

// TextChatModule handles public text chat with cooldown and muting.
type TextChatModule struct {
	mu       sync.RWMutex
	deps     engine.ModuleDeps
	config   textChatConfig
	messages []ChatMessage
	isMuted  bool
	lastSent map[uuid.UUID]time.Time
}

type textChatConfig struct {
	MaxLength     int  `json:"maxLength"`
	Cooldown      int  `json:"cooldown"`
	ShowTimestamp bool `json:"showTimestamp"`
	EnableEmoji   bool `json:"enableEmoji"`
}

// ChatMessage represents a single chat message.
type ChatMessage struct {
	SenderID      uuid.UUID `json:"senderId"`
	CharacterCode string    `json:"characterCode"`
	Message       string    `json:"message"`
	Timestamp     time.Time `json:"timestamp"`
}

// NewTextChatModule creates a new TextChatModule instance.
func NewTextChatModule() *TextChatModule {
	return &TextChatModule{}
}

func (m *TextChatModule) Name() string { return "text_chat" }

func (m *TextChatModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.messages = make([]ChatMessage, 0)
	m.lastSent = make(map[uuid.UUID]time.Time)

	// Apply defaults.
	m.config = textChatConfig{
		MaxLength:     500,
		Cooldown:      0,
		ShowTimestamp: true,
		EnableEmoji:   true,
	}
	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("text_chat: invalid config: %w", err)
		}
	}
	return nil
}

type chatSendPayload struct {
	Message       string `json:"message"`
	CharacterCode string `json:"characterCode"`
}

func (m *TextChatModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "chat:send":
		return m.handleSend(playerID, payload)
	default:
		return fmt.Errorf("text_chat: unknown message type %q", msgType)
	}
}

func (m *TextChatModule) handleSend(playerID uuid.UUID, payload json.RawMessage) error {
	var p chatSendPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("text_chat: invalid chat:send payload: %w", err)
	}

	m.mu.Lock()
	// NOTE: mutex is unlocked explicitly before EventBus.Publish below; do not use defer.

	if m.isMuted {
		m.mu.Unlock()
		return fmt.Errorf("text_chat: chat is muted")
	}

	if len(p.Message) == 0 {
		m.mu.Unlock()
		return fmt.Errorf("text_chat: empty message")
	}
	if len(p.Message) > m.config.MaxLength {
		m.mu.Unlock()
		return fmt.Errorf("text_chat: message exceeds max length %d", m.config.MaxLength)
	}

	// Check cooldown.
	if m.config.Cooldown > 0 {
		if last, ok := m.lastSent[playerID]; ok {
			elapsed := time.Since(last)
			if elapsed < time.Duration(m.config.Cooldown)*time.Second {
				m.mu.Unlock()
				return fmt.Errorf("text_chat: cooldown active, wait %v", time.Duration(m.config.Cooldown)*time.Second-elapsed)
			}
		}
	}

	now := time.Now()
	msg := ChatMessage{
		SenderID:      playerID,
		CharacterCode: p.CharacterCode,
		Message:       p.Message,
		Timestamp:     now,
	}
	m.messages = append(m.messages, msg)
	m.lastSent[playerID] = now

	// Capture values for event before unlocking.
	charCode := p.CharacterCode
	message := p.Message
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "chat.message",
		Payload: map[string]any{
			"senderId":      playerID.String(),
			"characterCode": charCode,
			"message":       message,
			"timestamp":     now,
		},
	})
	return nil
}

// ReactTo handles MUTE_CHAT and UNMUTE_CHAT phase actions.
func (m *TextChatModule) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	switch action.Action {
	case engine.ActionMuteChat:
		m.isMuted = true
	case engine.ActionUnmuteChat:
		m.isMuted = false
	default:
		return fmt.Errorf("text_chat: unsupported action %q", action.Action)
	}
	return nil
}

// SupportedActions returns the phase actions this module handles.
func (m *TextChatModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{engine.ActionMuteChat, engine.ActionUnmuteChat}
}

// Schema returns the JSON Schema for this module's settings.
func (m *TextChatModule) Schema() json.RawMessage {
	schema := `{
		"type": "object",
		"properties": {
			"maxLength":     { "type": "integer", "default": 500, "minimum": 1, "maximum": 2000 },
			"cooldown":      { "type": "integer", "default": 0, "minimum": 0 },
			"showTimestamp": { "type": "boolean", "default": true },
			"enableEmoji":   { "type": "boolean", "default": true }
		}
	}`
	return json.RawMessage(schema)
}

type textChatState struct {
	Messages []ChatMessage `json:"messages"`
	IsMuted  bool          `json:"isMuted"`
}

func (m *TextChatModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Return last 50 messages.
	msgs := m.messages
	if len(msgs) > 50 {
		msgs = msgs[len(msgs)-50:]
	}

	return json.Marshal(textChatState{
		Messages: msgs,
		IsMuted:  m.isMuted,
	})
}

func (m *TextChatModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.messages = nil
	m.lastSent = nil
	return nil
}

// --- GameEventHandler ---

func (m *TextChatModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "chat:send":
		return nil
	default:
		return fmt.Errorf("text_chat: unsupported event type %q", event.Type)
	}
}

func (m *TextChatModule) Apply(_ context.Context, _ engine.GameEvent, state *engine.GameState) error {
	data, err := m.BuildState()
	if err != nil {
		return fmt.Errorf("text_chat: apply: %w", err)
	}
	if state.Modules == nil {
		state.Modules = make(map[string]json.RawMessage)
	}
	state.Modules[m.Name()] = data
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module           = (*TextChatModule)(nil)
	_ engine.PhaseReactor     = (*TextChatModule)(nil)
	_ engine.ConfigSchema     = (*TextChatModule)(nil)
	_ engine.GameEventHandler = (*TextChatModule)(nil)
)
