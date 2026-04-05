package core

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func newTestDeps() engine.ModuleDeps {
	return engine.ModuleDeps{
		SessionID: uuid.New(),
		EventBus:  engine.NewEventBus(nil),
		Logger:    nil,
	}
}

func TestConnectionModule_Name(t *testing.T) {
	m := NewConnectionModule()
	if m.Name() != "connection" {
		t.Fatalf("expected name %q, got %q", "connection", m.Name())
	}
}

func TestConnectionModule_Init(t *testing.T) {
	m := NewConnectionModule()
	err := m.Init(context.Background(), newTestDeps(), nil)
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	if m.players == nil {
		t.Fatal("players map not initialized")
	}
}

func TestConnectionModule_HandleMessage(t *testing.T) {
	tests := []struct {
		name      string
		msgType   string
		payload   any
		wantErr   bool
		checkFunc func(t *testing.T, m *ConnectionModule)
	}{
		{
			name:    "join_game success",
			msgType: "join_game",
			payload: joinGamePayload{SessionID: "sess1", CharacterCode: "detective", SecretKey: "key1"},
			wantErr: false,
			checkFunc: func(t *testing.T, m *ConnectionModule) {
				m.mu.RLock()
				defer m.mu.RUnlock()
				if len(m.players) != 1 {
					t.Fatalf("expected 1 player, got %d", len(m.players))
				}
			},
		},
		{
			name:    "reconnect_sync success",
			msgType: "reconnect_sync",
			payload: reconnectSyncPayload{SessionID: "sess1"},
			wantErr: false,
		},
		{
			name:    "unknown message type",
			msgType: "unknown",
			payload: nil,
			wantErr: true,
		},
		{
			name:    "join_game invalid payload",
			msgType: "join_game",
			payload: "not-json-object",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewConnectionModule()
			_ = m.Init(context.Background(), newTestDeps(), nil)

			var payload json.RawMessage
			if tt.payload != nil {
				data, _ := json.Marshal(tt.payload)
				payload = data
			}

			playerID := uuid.New()
			err := m.HandleMessage(context.Background(), playerID, tt.msgType, payload)
			if (err != nil) != tt.wantErr {
				t.Fatalf("HandleMessage() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.checkFunc != nil && err == nil {
				tt.checkFunc(t, m)
			}
		})
	}
}

func TestConnectionModule_JoinGame_PublishesEvent(t *testing.T) {
	deps := newTestDeps()
	m := NewConnectionModule()
	_ = m.Init(context.Background(), deps, nil)

	var received bool
	deps.EventBus.Subscribe("player.joined", func(e engine.Event) {
		received = true
	})

	payload, _ := json.Marshal(joinGamePayload{SessionID: "s1", CharacterCode: "c1", SecretKey: "k1"})
	_ = m.HandleMessage(context.Background(), uuid.New(), "join_game", payload)

	if !received {
		t.Fatal("player.joined event not published")
	}
}

func TestConnectionModule_BuildState(t *testing.T) {
	m := NewConnectionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)

	// Empty state.
	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState failed: %v", err)
	}
	var statuses []PlayerStatus
	if err := json.Unmarshal(data, &statuses); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if len(statuses) != 0 {
		t.Fatalf("expected 0 statuses, got %d", len(statuses))
	}

	// After join.
	payload, _ := json.Marshal(joinGamePayload{SessionID: "s1", CharacterCode: "c1", SecretKey: "k1"})
	_ = m.HandleMessage(context.Background(), uuid.New(), "join_game", payload)

	data, _ = m.BuildState()
	_ = json.Unmarshal(data, &statuses)
	if len(statuses) != 1 {
		t.Fatalf("expected 1 status, got %d", len(statuses))
	}
	if !statuses[0].IsOnline {
		t.Fatal("expected player to be online")
	}
}

func TestConnectionModule_Cleanup(t *testing.T) {
	m := NewConnectionModule()
	_ = m.Init(context.Background(), newTestDeps(), nil)
	_ = m.Cleanup(context.Background())
	if m.players != nil {
		t.Fatal("expected players to be nil after cleanup")
	}
}
