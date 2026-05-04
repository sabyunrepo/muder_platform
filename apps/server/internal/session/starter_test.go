package session

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/rs/zerolog"
)

// mockBroadcaster records BroadcastToSession calls for assertion.
// All fields are protected by mu so the test goroutine can read concurrently
// with the session actor goroutine that calls BroadcastToSession.
type mockBroadcaster struct {
	mu    sync.Mutex
	calls []broadcastCall
}

type broadcastCall struct {
	sessionID uuid.UUID
	env       BroadcastEnvelope
}

func (m *mockBroadcaster) BroadcastToSession(sessionID uuid.UUID, env BroadcastEnvelope) {
	m.mu.Lock()
	m.calls = append(m.calls, broadcastCall{sessionID: sessionID, env: env})
	m.mu.Unlock()
}

// snapshot returns a point-in-time copy of calls under the lock.
func (m *mockBroadcaster) snapshot() []broadcastCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := make([]broadcastCall, len(m.calls))
	copy(cp, m.calls)
	return cp
}

func minimalConfigJSON(t *testing.T) json.RawMessage {
	t.Helper()
	raw, err := json.Marshal(map[string]any{
		"phases": []map[string]any{
			{"id": "intro", "name": "Introduction"},
			{"id": "voting", "name": "Voting"},
		},
		"modules": []any{},
	})
	if err != nil {
		t.Fatalf("marshal config: %v", err)
	}
	return raw
}

func sceneTransitionConfigJSON(t *testing.T) json.RawMessage {
	t.Helper()
	raw, err := json.Marshal(map[string]any{
		"phases": []map[string]any{
			{"id": "intro", "name": "Introduction"},
			{"id": "discussion", "name": "Discussion"},
			{"id": "voting", "name": "Voting"},
		},
		"sceneTransitions": []map[string]any{
			{"id": "intro-to-voting", "from": "intro", "to": "voting", "sortOrder": 0},
		},
		"modules": []any{},
	})
	if err != nil {
		t.Fatalf("marshal scene transition config: %v", err)
	}
	return raw
}

func newTestManager(t *testing.T) *SessionManager {
	t.Helper()
	logger := zerolog.Nop()
	return NewSessionManager(logger)
}

// TestStartModularGame_FlagOff verifies that startModularGame returns
// errGameRuntimeDisabled when the feature flag is false.
func TestStartModularGame_FlagOff(t *testing.T) {
	m := newTestManager(t)
	cfg := StartConfig{
		SessionID:   uuid.New(),
		ThemeID:     uuid.New(),
		FeatureFlag: false,
		ConfigJSON:  minimalConfigJSON(t),
	}
	_, err := startModularGame(context.Background(), m, cfg, zerolog.Nop())
	if err != errGameRuntimeDisabled {
		t.Fatalf("want errGameRuntimeDisabled, got %v", err)
	}
}

// TestStartModularGame_InvalidConfig verifies that a malformed configJson
// returns an error and leaves no session in the manager.
func TestStartModularGame_InvalidConfig(t *testing.T) {
	m := newTestManager(t)
	cfg := StartConfig{
		SessionID:   uuid.New(),
		ThemeID:     uuid.New(),
		FeatureFlag: true,
		ConfigJSON:  json.RawMessage(`{invalid json`),
	}
	_, err := startModularGame(context.Background(), m, cfg, zerolog.Nop())
	if err == nil {
		t.Fatal("expected error for invalid configJson, got nil")
	}
	if m.Get(cfg.SessionID) != nil {
		t.Fatal("session must not be registered on parse failure")
	}
}

// TestStartModularGame_NoPhases verifies that a configJson with no phases
// is rejected.
func TestStartModularGame_NoPhases(t *testing.T) {
	m := newTestManager(t)
	raw, _ := json.Marshal(map[string]any{
		"phases":  []any{},
		"modules": []any{},
	})
	cfg := StartConfig{
		SessionID:   uuid.New(),
		ThemeID:     uuid.New(),
		FeatureFlag: true,
		ConfigJSON:  raw,
	}
	_, err := startModularGame(context.Background(), m, cfg, zerolog.Nop())
	if err == nil {
		t.Fatal("expected error for empty phases, got nil")
	}
}

// TestStartModularGame_Success verifies happy-path: session is registered,
// engine is started (phase:entered broadcast received), and Stop cleans up.
func TestStartModularGame_Success(t *testing.T) {
	m := newTestManager(t)
	bc := &mockBroadcaster{}
	sessionID := uuid.New()

	cfg := StartConfig{
		SessionID:   sessionID,
		ThemeID:     uuid.New(),
		Players:     []PlayerState{{PlayerID: uuid.New(), Connected: true}},
		FeatureFlag: true,
		ConfigJSON:  minimalConfigJSON(t),
		Broadcaster: bc,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	s, err := startModularGame(ctx, m, cfg, zerolog.Nop())
	if err != nil {
		t.Fatalf("startModularGame failed: %v", err)
	}
	if s == nil {
		t.Fatal("expected non-nil session")
	}

	// Wait briefly for the engine start to propagate through the actor.
	time.Sleep(50 * time.Millisecond)

	if m.Get(sessionID) == nil {
		t.Error("session not registered in manager")
	}

	// The actor should have published phase:entered → broadcast.
	calls := bc.snapshot()
	found := false
	for _, call := range calls {
		if call.sessionID == sessionID && call.env.Type == "phase:entered" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected phase:entered broadcast, got calls: %+v", calls)
	}

	// Clean stop.
	if err := m.Stop(sessionID); err != nil {
		t.Fatalf("Stop failed: %v", err)
	}
}

// TestStartModularGame_DuplicateSession verifies that starting a second session
// with the same ID is rejected.
func TestStartModularGame_DuplicateSession(t *testing.T) {
	m := newTestManager(t)
	sessionID := uuid.New()

	cfg := StartConfig{
		SessionID:   sessionID,
		ThemeID:     uuid.New(),
		FeatureFlag: true,
		ConfigJSON:  minimalConfigJSON(t),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	s, err := startModularGame(ctx, m, cfg, zerolog.Nop())
	if err != nil {
		t.Fatalf("first start failed: %v", err)
	}

	time.Sleep(20 * time.Millisecond)

	_, err = startModularGame(ctx, m, cfg, zerolog.Nop())
	if err == nil {
		t.Fatal("expected duplicate session error, got nil")
	}

	m.Stop(sessionID)
	s.Done() // wait for goroutine
	<-s.Done()
}

// TestStartModularGame_PhaseAdvance verifies that KindAdvance transitions the
// engine to the next phase and the broadcast is relayed.
func TestStartModularGame_PhaseAdvance(t *testing.T) {
	m := newTestManager(t)
	bc := &mockBroadcaster{}
	sessionID := uuid.New()

	cfg := StartConfig{
		SessionID:   sessionID,
		ThemeID:     uuid.New(),
		FeatureFlag: true,
		ConfigJSON:  minimalConfigJSON(t),
		Broadcaster: bc,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	s, err := startModularGame(ctx, m, cfg, zerolog.Nop())
	if err != nil {
		t.Fatalf("startModularGame failed: %v", err)
	}

	// Wait for engine start.
	time.Sleep(50 * time.Millisecond)

	// Send advance.
	if err := s.Send(SessionMessage{
		Kind: KindAdvance,
		Ctx:  ctx,
	}); err != nil {
		t.Fatalf("Send KindAdvance failed: %v", err)
	}

	// Wait for advance to propagate.
	time.Sleep(50 * time.Millisecond)

	// Expect phase:exiting + phase:entered.
	advanceCalls := bc.snapshot()
	exiting, entered := false, false
	for _, call := range advanceCalls {
		if call.sessionID != sessionID {
			continue
		}
		switch call.env.Type {
		case "phase:exiting":
			exiting = true
		case "phase:entered":
			entered = true
		}
	}

	if !exiting {
		t.Error("expected phase:exiting broadcast")
	}
	if !entered {
		t.Error("expected phase:entered broadcast after advance")
	}

	m.Stop(sessionID)
}

func TestStartModularGame_PhaseAdvanceUsesSceneTransitions(t *testing.T) {
	m := newTestManager(t)
	bc := &mockBroadcaster{}
	sessionID := uuid.New()

	cfg := StartConfig{
		SessionID:   sessionID,
		ThemeID:     uuid.New(),
		FeatureFlag: true,
		ConfigJSON:  sceneTransitionConfigJSON(t),
		Broadcaster: bc,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	s, err := startModularGame(ctx, m, cfg, zerolog.Nop())
	if err != nil {
		t.Fatalf("startModularGame failed: %v", err)
	}
	defer m.Stop(sessionID)

	time.Sleep(50 * time.Millisecond)

	if err := s.Send(SessionMessage{
		Kind: KindAdvance,
		Ctx:  ctx,
	}); err != nil {
		t.Fatalf("Send KindAdvance failed: %v", err)
	}

	time.Sleep(50 * time.Millisecond)

	var enteredVoting bool
	for _, call := range bc.snapshot() {
		if call.sessionID != sessionID || call.env.Type != "phase:entered" {
			continue
		}
		var payload struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(call.env.Payload, &payload); err != nil {
			t.Fatalf("unmarshal phase:entered payload: %v", err)
		}
		if payload.ID == "voting" {
			enteredVoting = true
		}
	}
	if !enteredVoting {
		t.Fatal("expected scene transition to enter voting phase")
	}
}

func TestStartModularGame_InvalidSceneTransitionConfig(t *testing.T) {
	m := newTestManager(t)
	raw, _ := json.Marshal(map[string]any{
		"phases": []map[string]any{
			{"id": "intro", "name": "Introduction"},
		},
		"sceneTransitions": []map[string]any{
			{"id": "bad-edge", "from": "intro", "to": "missing"},
		},
		"modules": []any{},
	})
	cfg := StartConfig{
		SessionID:   uuid.New(),
		ThemeID:     uuid.New(),
		FeatureFlag: true,
		ConfigJSON:  raw,
	}

	_, err := startModularGame(context.Background(), m, cfg, zerolog.Nop())
	if err == nil {
		t.Fatal("expected invalid scene transition config error")
	}
	if m.Get(cfg.SessionID) != nil {
		t.Fatal("session must not be registered on invalid scene transitions")
	}
}

func TestStaticPlayerInfoProvider_ResolvesTargetCodeAndRuntimeInfo(t *testing.T) {
	alive := true
	dead := false
	withTargetID := uuid.New()
	withoutTargetID := uuid.New()
	deadID := uuid.New()

	provider := newStaticPlayerInfoProvider([]PlayerState{
		{
			PlayerID:   withTargetID,
			TargetCode: "char_target",
			Role:       "detective",
			IsAlive:    &alive,
		},
		{
			PlayerID:  withoutTargetID,
			Role:      "civilian",
			Connected: true,
		},
		{
			PlayerID: deadID,
			Role:     "civilian",
			IsAlive:  &dead,
		},
	})
	if provider == nil {
		t.Fatal("expected provider")
	}

	playerID, ok := provider.ResolvePlayerID(context.Background(), "char_target")
	if !ok || playerID != withTargetID {
		t.Fatalf("ResolvePlayerID(targetCode) = (%s, %v), want (%s, true)", playerID, ok, withTargetID)
	}
	playerID, ok = provider.ResolvePlayerID(context.Background(), withoutTargetID.String())
	if !ok || playerID != withoutTargetID {
		t.Fatalf("ResolvePlayerID(uuid) = (%s, %v), want (%s, true)", playerID, ok, withoutTargetID)
	}
	if _, ok := provider.ResolvePlayerID(context.Background(), "missing_target"); ok {
		t.Fatal("ResolvePlayerID(missing) ok = true, want false")
	}

	info, ok := provider.PlayerRuntimeInfo(context.Background(), withTargetID)
	if !ok {
		t.Fatal("PlayerRuntimeInfo(withTargetID) ok = false, want true")
	}
	if info != (engine.PlayerRuntimeInfo{
		PlayerID:   withTargetID,
		TargetCode: "char_target",
		Role:       "detective",
		IsAlive:    true,
	}) {
		t.Fatalf("PlayerRuntimeInfo(withTargetID) = %+v", info)
	}
	info, ok = provider.PlayerRuntimeInfo(context.Background(), deadID)
	if !ok || info.IsAlive {
		t.Fatalf("PlayerRuntimeInfo(deadID) = (%+v, %v), want IsAlive=false", info, ok)
	}
}

func TestStaticPlayerInfoProvider_EmptyPlayersReturnsNil(t *testing.T) {
	if got := newStaticPlayerInfoProvider(nil); got != nil {
		t.Fatalf("newStaticPlayerInfoProvider(nil) = %T, want nil", got)
	}
}
