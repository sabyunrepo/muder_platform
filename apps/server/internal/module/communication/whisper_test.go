package communication

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestWhisperModule_Name(t *testing.T) {
	m := NewWhisperModule()
	if m.Name() != "whisper" {
		t.Fatalf("expected name %q, got %q", "whisper", m.Name())
	}
}

func TestWhisperModule_InitDefaults(t *testing.T) {
	m := NewWhisperModule()
	deps := newTestDeps()

	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	if m.config.MaxLength != 300 {
		t.Errorf("expected MaxLength 300, got %d", m.config.MaxLength)
	}
}

func TestWhisperModule_SendWhisper(t *testing.T) {
	m := NewWhisperModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	sender := uuid.New()
	receiver := uuid.New()

	var received bool
	deps.EventBus.Subscribe("whisper.received", func(e engine.Event) {
		received = true
		p := e.Payload.(map[string]any)
		if p["senderId"] != sender.String() {
			t.Errorf("expected senderId %q, got %q", sender.String(), p["senderId"])
		}
		if p["receiverId"] != receiver.String() {
			t.Errorf("expected receiverId %q, got %q", receiver.String(), p["receiverId"])
		}
	})

	payload, _ := json.Marshal(map[string]any{
		"targetId": receiver.String(),
		"message":  "secret",
	})

	err := m.HandleMessage(context.Background(), sender, "whisper:send", payload)
	if err != nil {
		t.Fatalf("HandleMessage failed: %v", err)
	}

	if !received {
		t.Error("expected whisper.received event")
	}

	// Both sender and receiver should have the whisper stored.
	m.mu.RLock()
	if len(m.whispers[sender]) != 1 {
		t.Errorf("expected 1 whisper for sender, got %d", len(m.whispers[sender]))
	}
	if len(m.whispers[receiver]) != 1 {
		t.Errorf("expected 1 whisper for receiver, got %d", len(m.whispers[receiver]))
	}
	m.mu.RUnlock()
}

func TestWhisperModule_EmptyMessage(t *testing.T) {
	m := NewWhisperModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	payload, _ := json.Marshal(map[string]any{
		"targetId": uuid.New().String(),
		"message":  "",
	})

	err := m.HandleMessage(context.Background(), uuid.New(), "whisper:send", payload)
	if err == nil {
		t.Fatal("expected error for empty message")
	}
}

func TestWhisperModule_ExceedsMaxLength(t *testing.T) {
	m := NewWhisperModule()
	deps := newTestDeps()
	cfg := json.RawMessage(`{"maxLength":5}`)
	m.Init(context.Background(), deps, cfg)

	payload, _ := json.Marshal(map[string]any{
		"targetId": uuid.New().String(),
		"message":  "toolong",
	})

	err := m.HandleMessage(context.Background(), uuid.New(), "whisper:send", payload)
	if err == nil {
		t.Fatal("expected error for message exceeding max length")
	}
}

func TestWhisperModule_CannotWhisperSelf(t *testing.T) {
	m := NewWhisperModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	playerID := uuid.New()
	payload, _ := json.Marshal(map[string]any{
		"targetId": playerID.String(),
		"message":  "hello self",
	})

	err := m.HandleMessage(context.Background(), playerID, "whisper:send", payload)
	if err == nil {
		t.Fatal("expected error when whispering to self")
	}
}

func TestWhisperModule_MuteUnmute(t *testing.T) {
	m := NewWhisperModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)
	ctx := context.Background()

	// Mute.
	err := m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionMuteChat})
	if err != nil {
		t.Fatalf("ReactTo MUTE failed: %v", err)
	}

	payload, _ := json.Marshal(map[string]any{
		"targetId": uuid.New().String(),
		"message":  "blocked",
	})
	err = m.HandleMessage(ctx, uuid.New(), "whisper:send", payload)
	if err == nil {
		t.Fatal("expected error when muted")
	}

	// Unmute.
	err = m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionUnmuteChat})
	if err != nil {
		t.Fatalf("ReactTo UNMUTE failed: %v", err)
	}

	err = m.HandleMessage(ctx, uuid.New(), "whisper:send", payload)
	if err != nil {
		t.Fatalf("expected send to succeed after unmute: %v", err)
	}
}

func TestWhisperModule_BuildState(t *testing.T) {
	m := NewWhisperModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var s whisperState
	json.Unmarshal(state, &s)
	if s.IsMuted {
		t.Error("expected isMuted false")
	}
}

func TestWhisperModule_SupportedActions(t *testing.T) {
	m := NewWhisperModule()
	actions := m.SupportedActions()
	if len(actions) != 2 {
		t.Fatalf("expected 2 supported actions, got %d", len(actions))
	}
}

func TestWhisperModule_UnknownMessageType(t *testing.T) {
	m := NewWhisperModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "whisper:unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestWhisperModule_Cleanup(t *testing.T) {
	m := NewWhisperModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	err := m.Cleanup(context.Background())
	if err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}
	if m.whispers != nil {
		t.Error("expected whispers to be nil after cleanup")
	}
}
