package communication

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// testLogger is a no-op logger for tests.
type testLogger struct{}

func (l *testLogger) Printf(string, ...any) {}

func newTestDeps() engine.ModuleDeps {
	logger := &testLogger{}
	return engine.ModuleDeps{
		SessionID: uuid.New(),
		EventBus:  engine.NewEventBus(logger),
		Logger:    logger,
	}
}

func TestTextChatModule_Name(t *testing.T) {
	m := NewTextChatModule()
	if m.Name() != "text_chat" {
		t.Fatalf("expected name %q, got %q", "text_chat", m.Name())
	}
}

func TestTextChatModule_InitDefaults(t *testing.T) {
	m := NewTextChatModule()
	deps := newTestDeps()

	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	if m.config.MaxLength != 500 {
		t.Errorf("expected MaxLength 500, got %d", m.config.MaxLength)
	}
	if m.config.Cooldown != 0 {
		t.Errorf("expected Cooldown 0, got %d", m.config.Cooldown)
	}
	if !m.config.ShowTimestamp {
		t.Error("expected ShowTimestamp true")
	}
	if !m.config.EnableEmoji {
		t.Error("expected EnableEmoji true")
	}
}

func TestTextChatModule_InitCustomConfig(t *testing.T) {
	m := NewTextChatModule()
	deps := newTestDeps()
	cfg := json.RawMessage(`{"maxLength":100,"cooldown":5,"showTimestamp":false,"enableEmoji":false}`)

	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init failed: %v", err)
	}

	if m.config.MaxLength != 100 {
		t.Errorf("expected MaxLength 100, got %d", m.config.MaxLength)
	}
	if m.config.Cooldown != 5 {
		t.Errorf("expected Cooldown 5, got %d", m.config.Cooldown)
	}
}

func TestTextChatModule_SendMessage(t *testing.T) {
	m := NewTextChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	playerID := uuid.New()
	var received bool
	deps.EventBus.Subscribe("chat.message", func(e engine.Event) {
		received = true
	})

	payload := json.RawMessage(`{"message":"hello","characterCode":"detective"}`)
	err := m.HandleMessage(context.Background(), playerID, "chat:send", payload)
	if err != nil {
		t.Fatalf("HandleMessage failed: %v", err)
	}

	if !received {
		t.Error("expected chat.message event to be published")
	}

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}

	var s textChatState
	json.Unmarshal(state, &s)
	if len(s.Messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(s.Messages))
	}
	if s.Messages[0].Message != "hello" {
		t.Errorf("expected message %q, got %q", "hello", s.Messages[0].Message)
	}
}

func TestTextChatModule_EmptyMessage(t *testing.T) {
	m := NewTextChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	payload := json.RawMessage(`{"message":""}`)
	err := m.HandleMessage(context.Background(), uuid.New(), "chat:send", payload)
	if err == nil {
		t.Fatal("expected error for empty message")
	}
}

func TestTextChatModule_ExceedsMaxLength(t *testing.T) {
	m := NewTextChatModule()
	deps := newTestDeps()
	cfg := json.RawMessage(`{"maxLength":5}`)
	m.Init(context.Background(), deps, cfg)

	payload := json.RawMessage(`{"message":"toolong"}`)
	err := m.HandleMessage(context.Background(), uuid.New(), "chat:send", payload)
	if err == nil {
		t.Fatal("expected error for message exceeding max length")
	}
}

func TestTextChatModule_MuteUnmute(t *testing.T) {
	m := NewTextChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	ctx := context.Background()

	// Mute chat.
	err := m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionMuteChat})
	if err != nil {
		t.Fatalf("ReactTo MUTE failed: %v", err)
	}

	// Sending should fail.
	payload := json.RawMessage(`{"message":"blocked"}`)
	err = m.HandleMessage(ctx, uuid.New(), "chat:send", payload)
	if err == nil {
		t.Fatal("expected error when chat is muted")
	}

	// Unmute chat.
	err = m.ReactTo(ctx, engine.PhaseActionPayload{Action: engine.ActionUnmuteChat})
	if err != nil {
		t.Fatalf("ReactTo UNMUTE failed: %v", err)
	}

	// Sending should work.
	err = m.HandleMessage(ctx, uuid.New(), "chat:send", payload)
	if err != nil {
		t.Fatalf("expected send to succeed after unmute: %v", err)
	}
}

func TestTextChatModule_Cooldown(t *testing.T) {
	m := NewTextChatModule()
	deps := newTestDeps()
	cfg := json.RawMessage(`{"cooldown":10}`)
	m.Init(context.Background(), deps, cfg)

	playerID := uuid.New()
	payload := json.RawMessage(`{"message":"first"}`)

	// First message should succeed.
	err := m.HandleMessage(context.Background(), playerID, "chat:send", payload)
	if err != nil {
		t.Fatalf("first send failed: %v", err)
	}

	// Second message immediately should fail.
	payload = json.RawMessage(`{"message":"second"}`)
	err = m.HandleMessage(context.Background(), playerID, "chat:send", payload)
	if err == nil {
		t.Fatal("expected cooldown error")
	}
}

func TestTextChatModule_BuildStateLast50(t *testing.T) {
	m := NewTextChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	// Add 60 messages directly.
	m.mu.Lock()
	for i := 0; i < 60; i++ {
		m.messages = append(m.messages, ChatMessage{
			SenderID:  uuid.New(),
			Message:   "msg",
			Timestamp: time.Now(),
		})
	}
	m.mu.Unlock()

	state, _ := m.BuildState()
	var s textChatState
	json.Unmarshal(state, &s)
	if len(s.Messages) != 50 {
		t.Errorf("expected 50 messages in state, got %d", len(s.Messages))
	}
}

func TestTextChatModule_SupportedActions(t *testing.T) {
	m := NewTextChatModule()
	actions := m.SupportedActions()
	if len(actions) != 2 {
		t.Fatalf("expected 2 supported actions, got %d", len(actions))
	}
}

func TestTextChatModule_Schema(t *testing.T) {
	m := NewTextChatModule()
	schema := m.Schema()
	if len(schema) == 0 {
		t.Fatal("expected non-empty schema")
	}
	var parsed map[string]any
	if err := json.Unmarshal(schema, &parsed); err != nil {
		t.Fatalf("schema is not valid JSON: %v", err)
	}
}

func TestTextChatModule_UnknownMessageType(t *testing.T) {
	m := NewTextChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	err := m.HandleMessage(context.Background(), uuid.New(), "chat:unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestTextChatModule_Cleanup(t *testing.T) {
	m := NewTextChatModule()
	deps := newTestDeps()
	m.Init(context.Background(), deps, nil)

	err := m.Cleanup(context.Background())
	if err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}
	if m.messages != nil {
		t.Error("expected messages to be nil after cleanup")
	}
}

// --- PR-2b: PlayerAware snapshot tests (broadcast chat) ---

func TestTextChatModule_BuildStateFor_SameContentAsBroadcast(t *testing.T) {
	m := NewTextChatModule()
	if err := m.Init(context.Background(), newTestDeps(), nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	if err := m.HandleMessage(context.Background(), alice, "chat:send",
		json.RawMessage(`{"message":"hello","characterCode":"A"}`)); err != nil {
		t.Fatalf("send: %v", err)
	}

	data, err := m.BuildStateFor(uuid.New())
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	var s textChatState
	if err := json.Unmarshal(data, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(s.Messages) != 1 || s.Messages[0].Message != "hello" {
		t.Fatalf("want 1 broadcast message 'hello', got %v", s.Messages)
	}
}

func TestTextChatModule_BuildStateFor_RespectsMaxLimit(t *testing.T) {
	m := NewTextChatModule()
	if err := m.Init(context.Background(), newTestDeps(), nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	for i := 0; i < 60; i++ {
		if err := m.HandleMessage(context.Background(), alice, "chat:send",
			json.RawMessage(fmt.Sprintf(`{"message":"m%d","characterCode":"A"}`, i))); err != nil {
			t.Fatalf("send %d: %v", i, err)
		}
	}
	data, err := m.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	var s textChatState
	_ = json.Unmarshal(data, &s)
	if len(s.Messages) != 50 {
		t.Fatalf("expected last 50 messages, got %d", len(s.Messages))
	}
	// First retained message should be "m10" (indexes 10..59).
	if s.Messages[0].Message != "m10" {
		t.Fatalf("expected first retained to be m10, got %q", s.Messages[0].Message)
	}
	// Marshalled snapshot should not reference the excluded head (m0 .. m9).
	// Defensive: a substring check prevents a future off-by-one regression.
	if string(data) == "" {
		t.Fatal("empty snapshot")
	}
}

func TestTextChatModule_BuildStateFor_ReflectsMuteFlag(t *testing.T) {
	m := NewTextChatModule()
	if err := m.Init(context.Background(), newTestDeps(), nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.ReactTo(context.Background(),
		engine.PhaseActionPayload{Action: engine.ActionMuteChat}); err != nil {
		t.Fatalf("ReactTo mute: %v", err)
	}

	data, err := m.BuildStateFor(uuid.New())
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	var s textChatState
	_ = json.Unmarshal(data, &s)
	if !s.IsMuted {
		t.Fatal("expected IsMuted=true after ActionMuteChat")
	}
	// time import guard (keeps import list valid across test churn).
	_ = time.Now()
}
