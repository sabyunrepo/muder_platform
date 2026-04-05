package communication

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestVoiceChatModule_Name(t *testing.T) {
	m := NewVoiceChatModule()
	if m.Name() != "voice_chat" {
		t.Fatalf("expected name %q, got %q", "voice_chat", m.Name())
	}
}

func TestVoiceChatModule_InitDefaults(t *testing.T) {
	m := NewVoiceChatModule()
	deps := newTestDeps()

	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	if !m.config.AutoJoin {
		t.Error("expected AutoJoin true")
	}
	if m.config.PushToTalk {
		t.Error("expected PushToTalk false")
	}
	if m.config.MaxParticipants != 12 {
		t.Errorf("expected MaxParticipants 12, got %d", m.config.MaxParticipants)
	}
}

func TestVoiceChatModule_JoinAndLeave(t *testing.T) {
	m := NewVoiceChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)
	ctx := context.Background()

	playerID := uuid.New()

	var joinedEvent bool
	deps.EventBus.Subscribe("voice.joined", func(e engine.Event) {
		joinedEvent = true
	})

	// Join.
	err := m.HandleMessage(ctx, playerID, "voice:join", nil)
	if err != nil {
		t.Fatalf("join failed: %v", err)
	}
	if !joinedEvent {
		t.Error("expected voice.joined event")
	}

	// Verify participant.
	m.mu.RLock()
	if _, ok := m.participants[playerID]; !ok {
		t.Error("player not in participants")
	}
	m.mu.RUnlock()

	// Leave.
	var leftEvent bool
	deps.EventBus.Subscribe("voice.left", func(e engine.Event) {
		leftEvent = true
	})

	err = m.HandleMessage(ctx, playerID, "voice:leave", nil)
	if err != nil {
		t.Fatalf("leave failed: %v", err)
	}
	if !leftEvent {
		t.Error("expected voice.left event")
	}
}

func TestVoiceChatModule_JoinAlreadyJoined(t *testing.T) {
	m := NewVoiceChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)
	ctx := context.Background()

	playerID := uuid.New()
	m.HandleMessage(ctx, playerID, "voice:join", nil)

	err := m.HandleMessage(ctx, playerID, "voice:join", nil)
	if err == nil {
		t.Fatal("expected error when already joined")
	}
}

func TestVoiceChatModule_LeaveNotJoined(t *testing.T) {
	m := NewVoiceChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "voice:leave", nil)
	if err == nil {
		t.Fatal("expected error when not in voice chat")
	}
}

func TestVoiceChatModule_MaxParticipants(t *testing.T) {
	m := NewVoiceChatModule()
	deps := newTestDeps()
	cfg := json.RawMessage(`{"maxParticipants":2}`)
	m.Init(context.Background(), deps, cfg)
	ctx := context.Background()

	m.HandleMessage(ctx, uuid.New(), "voice:join", nil)
	m.HandleMessage(ctx, uuid.New(), "voice:join", nil)

	err := m.HandleMessage(ctx, uuid.New(), "voice:join", nil)
	if err == nil {
		t.Fatal("expected error when max participants reached")
	}
}

func TestVoiceChatModule_MuteUnmute(t *testing.T) {
	m := NewVoiceChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)
	ctx := context.Background()

	playerID := uuid.New()
	m.HandleMessage(ctx, playerID, "voice:join", nil)

	var muteEvents []bool
	deps.EventBus.Subscribe("voice.mute_changed", func(e engine.Event) {
		p := e.Payload.(map[string]any)
		muteEvents = append(muteEvents, p["muted"].(bool))
	})

	// Mute.
	err := m.HandleMessage(ctx, playerID, "voice:mute", nil)
	if err != nil {
		t.Fatalf("mute failed: %v", err)
	}
	if len(muteEvents) != 1 || !muteEvents[0] {
		t.Error("expected voice.mute_changed event with muted=true")
	}

	m.mu.RLock()
	if !m.participants[playerID] {
		t.Error("expected player to be muted")
	}
	m.mu.RUnlock()

	// Unmute.
	err = m.HandleMessage(ctx, playerID, "voice:unmute", nil)
	if err != nil {
		t.Fatalf("unmute failed: %v", err)
	}
	if len(muteEvents) != 2 || muteEvents[1] {
		t.Error("expected voice.mute_changed event with muted=false")
	}

	m.mu.RLock()
	if m.participants[playerID] {
		t.Error("expected player to be unmuted")
	}
	m.mu.RUnlock()
}

func TestVoiceChatModule_MuteNotJoined(t *testing.T) {
	m := NewVoiceChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "voice:mute", nil)
	if err == nil {
		t.Fatal("expected error when not in voice chat")
	}
}

func TestVoiceChatModule_BuildState(t *testing.T) {
	m := NewVoiceChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)
	ctx := context.Background()

	p1 := uuid.New()
	p2 := uuid.New()
	m.HandleMessage(ctx, p1, "voice:join", nil)
	m.HandleMessage(ctx, p2, "voice:join", nil)

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var s voiceChatState
	json.Unmarshal(state, &s)
	if s.ParticipantCount != 2 {
		t.Errorf("expected 2 participants, got %d", s.ParticipantCount)
	}
	if len(s.Participants) != 2 {
		t.Errorf("expected 2 participant entries, got %d", len(s.Participants))
	}
}

func TestVoiceChatModule_UnknownMessageType(t *testing.T) {
	m := NewVoiceChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "voice:unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestVoiceChatModule_Cleanup(t *testing.T) {
	m := NewVoiceChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	err := m.Cleanup(context.Background())
	if err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}
	if m.participants != nil {
		t.Error("expected participants to be nil after cleanup")
	}
}
