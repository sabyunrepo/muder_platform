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
	engine.Register("whisper", func() engine.Module { return NewWhisperModule() })
}

// WhisperModule handles private direct messages between players.
type WhisperModule struct {
	mu       sync.RWMutex
	deps     engine.ModuleDeps
	config   whisperConfig
	whispers map[uuid.UUID][]WhisperMessage
	isMuted  bool
}

type whisperConfig struct {
	MaxLength int `json:"maxLength"`
}

// WhisperMessage represents a private message between two players.
type WhisperMessage struct {
	SenderID   uuid.UUID `json:"senderId"`
	ReceiverID uuid.UUID `json:"receiverId"`
	Message    string    `json:"message"`
	Timestamp  time.Time `json:"timestamp"`
}

// NewWhisperModule creates a new WhisperModule instance.
func NewWhisperModule() *WhisperModule {
	return &WhisperModule{}
}

func (m *WhisperModule) Name() string { return "whisper" }

func (m *WhisperModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.whispers = make(map[uuid.UUID][]WhisperMessage)

	m.config = whisperConfig{
		MaxLength: 300,
	}
	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("whisper: invalid config: %w", err)
		}
	}
	return nil
}

type whisperSendPayload struct {
	TargetID uuid.UUID `json:"targetId"`
	Message  string    `json:"message"`
}

func (m *WhisperModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "whisper:send":
		return m.handleSend(playerID, payload)
	default:
		return fmt.Errorf("whisper: unknown message type %q", msgType)
	}
}

func (m *WhisperModule) handleSend(playerID uuid.UUID, payload json.RawMessage) error {
	var p whisperSendPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return fmt.Errorf("whisper: invalid whisper:send payload: %w", err)
	}

	m.mu.Lock()
	// NOTE: mutex is unlocked explicitly before EventBus.Publish below; do not use defer.

	if m.isMuted {
		m.mu.Unlock()
		return fmt.Errorf("whisper: chat is muted")
	}

	if len(p.Message) == 0 {
		m.mu.Unlock()
		return fmt.Errorf("whisper: empty message")
	}
	if len(p.Message) > m.config.MaxLength {
		m.mu.Unlock()
		return fmt.Errorf("whisper: message exceeds max length %d", m.config.MaxLength)
	}

	if p.TargetID == playerID {
		m.mu.Unlock()
		return fmt.Errorf("whisper: cannot whisper to yourself")
	}

	now := time.Now()
	msg := WhisperMessage{
		SenderID:   playerID,
		ReceiverID: p.TargetID,
		Message:    p.Message,
		Timestamp:  now,
	}

	// Store for both sender and receiver.
	m.whispers[playerID] = append(m.whispers[playerID], msg)
	m.whispers[p.TargetID] = append(m.whispers[p.TargetID], msg)

	// Capture values for event before unlocking.
	targetIDStr := p.TargetID.String()
	message := p.Message
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "whisper.received",
		Payload: map[string]any{
			"senderId":   playerID.String(),
			"receiverId": targetIDStr,
			"message":    message,
		},
	})
	return nil
}

// ReactTo handles MUTE_CHAT and UNMUTE_CHAT phase actions.
func (m *WhisperModule) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	switch action.Action {
	case engine.ActionMuteChat:
		m.isMuted = true
	case engine.ActionUnmuteChat:
		m.isMuted = false
	default:
		return fmt.Errorf("whisper: unsupported action %q", action.Action)
	}
	return nil
}

// SupportedActions returns the phase actions this module handles.
func (m *WhisperModule) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{engine.ActionMuteChat, engine.ActionUnmuteChat}
}

type whisperState struct {
	IsMuted bool `json:"isMuted"`
}

func (m *WhisperModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return json.Marshal(whisperState{
		IsMuted: m.isMuted,
	})
}

func (m *WhisperModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.whispers = nil
	return nil
}

// --- GameEventHandler ---

func (m *WhisperModule) Validate(_ context.Context, event engine.GameEvent, _ engine.GameState) error {
	switch event.Type {
	case "whisper:send":
		return nil
	default:
		return fmt.Errorf("whisper: unsupported event type %q", event.Type)
	}
}

func (m *WhisperModule) Apply(_ context.Context, _ engine.GameEvent, state *engine.GameState) error {
	data, err := m.BuildState()
	if err != nil {
		return fmt.Errorf("whisper: apply: %w", err)
	}
	if state.Modules == nil {
		state.Modules = make(map[string]json.RawMessage)
	}
	state.Modules[m.Name()] = data
	return nil
}

// --- PhaseHookModule ---

func (m *WhisperModule) OnPhaseEnter(_ context.Context, _ engine.Phase) error {
	return nil
}

func (m *WhisperModule) OnPhaseExit(_ context.Context, _ engine.Phase) error {
	return nil
}

// Compile-time interface checks.
var (
	_ engine.Module           = (*WhisperModule)(nil)
	_ engine.PhaseReactor     = (*WhisperModule)(nil)
	_ engine.GameEventHandler = (*WhisperModule)(nil)
	_ engine.PhaseHookModule  = (*WhisperModule)(nil)
)
