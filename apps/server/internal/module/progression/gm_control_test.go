package progression

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestGmControlModule_Init(t *testing.T) {
	tests := []struct {
		name    string
		config  json.RawMessage
		wantErr bool
	}{
		{
			name:   "no config",
			config: nil,
		},
		{
			name:   "with GM player ID",
			config: json.RawMessage(`{"GmPlayerID":"` + uuid.New().String() + `"}`),
		},
		{
			name:    "invalid GM player ID",
			config:  json.RawMessage(`{"GmPlayerID":"not-a-uuid"}`),
			wantErr: true,
		},
		{
			name:    "invalid json",
			config:  json.RawMessage(`{bad`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewGmControlModule()
			err := m.Init(context.Background(), newTestDeps(t), tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("Init() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestGmControlModule_HandleMessage(t *testing.T) {
	gmID := uuid.New()

	tests := []struct {
		name      string
		msgType   string
		payload   json.RawMessage
		playerID  uuid.UUID
		wantErr   bool
		wantEvent string
	}{
		{
			name:      "advance phase",
			msgType:   "gm:advance_phase",
			playerID:  gmID,
			wantEvent: "gm.advance_phase",
		},
		{
			name:      "start prologue",
			msgType:   "gm:start_prologue",
			playerID:  gmID,
			wantEvent: "gm.start_prologue",
		},
		{
			name:      "start playing",
			msgType:   "gm:start_playing",
			playerID:  gmID,
			wantEvent: "gm.start_playing",
		},
		{
			name:      "show ending",
			msgType:   "gm:show_ending",
			playerID:  gmID,
			wantEvent: "gm.show_ending",
		},
		{
			name:      "toggle voting",
			msgType:   "gm:toggle_voting",
			playerID:  gmID,
			wantEvent: "gm.toggle_voting",
		},
		{
			name:      "play media",
			msgType:   "gm:play_media",
			payload:   json.RawMessage(`{"MediaID":"media_1"}`),
			playerID:  gmID,
			wantEvent: "gm.play_media",
		},
		{
			name:      "broadcast message",
			msgType:   "gm:broadcast_message",
			payload:   json.RawMessage(`{"Message":"Hello everyone"}`),
			playerID:  gmID,
			wantEvent: "gm.broadcast_message",
		},
		{
			name:     "non-GM player rejected",
			msgType:  "gm:advance_phase",
			playerID: uuid.New(),
			wantErr:  true,
		},
		{
			name:     "unknown message",
			msgType:  "gm:unknown",
			playerID: gmID,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deps := newTestDeps(t)
			m := NewGmControlModule()

			cfg := json.RawMessage(`{"GmPlayerID":"` + gmID.String() + `"}`)
			if err := m.Init(context.Background(), deps, cfg); err != nil {
				t.Fatalf("Init() error = %v", err)
			}

			var received string
			if tt.wantEvent != "" {
				deps.EventBus.Subscribe(tt.wantEvent, func(e engine.Event) {
					received = e.Type
				})
			}

			err := m.HandleMessage(context.Background(), tt.playerID, tt.msgType, tt.payload)
			if (err != nil) != tt.wantErr {
				t.Errorf("HandleMessage() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantEvent != "" && received != tt.wantEvent {
				t.Errorf("expected event %q, got %q", tt.wantEvent, received)
			}
		})
	}
}

func TestGmControlModule_BuildState(t *testing.T) {
	deps := newTestDeps(t)
	m := NewGmControlModule()

	gmID := uuid.New()
	cfg := json.RawMessage(`{"GmPlayerID":"` + gmID.String() + `"}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	raw, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState() error = %v", err)
	}

	var state map[string]any
	if err := json.Unmarshal(raw, &state); err != nil {
		t.Fatalf("unmarshal error = %v", err)
	}

	if state["gmPlayerId"] != gmID.String() {
		t.Errorf("gmPlayerId = %v, want %s", state["gmPlayerId"], gmID.String())
	}
	if state["isActive"] != true {
		t.Errorf("isActive = %v, want true", state["isActive"])
	}
}
