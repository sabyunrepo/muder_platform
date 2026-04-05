package communication

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func init() {
	engine.Register("voice_chat", func() engine.Module { return NewVoiceChatModule() })
}

// VoiceChatModule manages voice chat participation and mute state.
type VoiceChatModule struct {
	mu           sync.RWMutex
	deps         engine.ModuleDeps
	config       voiceChatConfig
	participants map[uuid.UUID]bool // playerID → isMuted
}

type voiceChatConfig struct {
	AutoJoin        bool `json:"autoJoin"`
	PushToTalk      bool `json:"pushToTalk"`
	MaxParticipants int  `json:"maxParticipants"`
}

// NewVoiceChatModule creates a new VoiceChatModule instance.
func NewVoiceChatModule() *VoiceChatModule {
	return &VoiceChatModule{}
}

func (m *VoiceChatModule) Name() string { return "voice_chat" }

func (m *VoiceChatModule) Init(_ context.Context, deps engine.ModuleDeps, config json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.deps = deps
	m.participants = make(map[uuid.UUID]bool)

	m.config = voiceChatConfig{
		AutoJoin:        true,
		PushToTalk:      false,
		MaxParticipants: 12,
	}
	if len(config) > 0 {
		if err := json.Unmarshal(config, &m.config); err != nil {
			return fmt.Errorf("voice_chat: invalid config: %w", err)
		}
	}
	return nil
}

func (m *VoiceChatModule) HandleMessage(_ context.Context, playerID uuid.UUID, msgType string, payload json.RawMessage) error {
	switch msgType {
	case "voice:join":
		return m.handleJoin(playerID)
	case "voice:leave":
		return m.handleLeave(playerID)
	case "voice:mute":
		return m.handleMuteChange(playerID, true)
	case "voice:unmute":
		return m.handleMuteChange(playerID, false)
	default:
		return fmt.Errorf("voice_chat: unknown message type %q", msgType)
	}
}

func (m *VoiceChatModule) handleJoin(playerID uuid.UUID) error {
	m.mu.Lock()

	if _, already := m.participants[playerID]; already {
		m.mu.Unlock()
		return fmt.Errorf("voice_chat: player already in voice chat")
	}

	if len(m.participants) >= m.config.MaxParticipants {
		m.mu.Unlock()
		return fmt.Errorf("voice_chat: max participants reached (%d)", m.config.MaxParticipants)
	}

	m.participants[playerID] = false // not muted by default
	count := len(m.participants)
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "voice.joined",
		Payload: map[string]any{
			"playerId":         playerID.String(),
			"participantCount": count,
		},
	})
	return nil
}

func (m *VoiceChatModule) handleLeave(playerID uuid.UUID) error {
	m.mu.Lock()

	if _, ok := m.participants[playerID]; !ok {
		m.mu.Unlock()
		return fmt.Errorf("voice_chat: player not in voice chat")
	}

	delete(m.participants, playerID)
	count := len(m.participants)
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "voice.left",
		Payload: map[string]any{
			"playerId":         playerID.String(),
			"participantCount": count,
		},
	})
	return nil
}

func (m *VoiceChatModule) handleMuteChange(playerID uuid.UUID, muted bool) error {
	m.mu.Lock()

	if _, ok := m.participants[playerID]; !ok {
		m.mu.Unlock()
		return fmt.Errorf("voice_chat: player not in voice chat")
	}

	m.participants[playerID] = muted
	m.mu.Unlock()

	m.deps.EventBus.Publish(engine.Event{
		Type: "voice.mute_changed",
		Payload: map[string]any{
			"playerId": playerID.String(),
			"muted":    muted,
		},
	})
	return nil
}

type voiceChatParticipant struct {
	PlayerID uuid.UUID `json:"playerId"`
	IsMuted  bool      `json:"isMuted"`
}

type voiceChatState struct {
	Participants     []voiceChatParticipant `json:"participants"`
	ParticipantCount int                    `json:"participantCount"`
	Config           voiceChatConfig        `json:"config"`
}

func (m *VoiceChatModule) BuildState() (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	participants := make([]voiceChatParticipant, 0, len(m.participants))
	for pid, muted := range m.participants {
		participants = append(participants, voiceChatParticipant{
			PlayerID: pid,
			IsMuted:  muted,
		})
	}

	return json.Marshal(voiceChatState{
		Participants:     participants,
		ParticipantCount: len(participants),
		Config:           m.config,
	})
}

func (m *VoiceChatModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.participants = nil
	return nil
}

// Compile-time interface check.
var _ engine.Module = (*VoiceChatModule)(nil)
