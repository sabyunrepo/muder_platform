package progression

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

// testLogger implements engine.Logger for testing.
type testLogger struct{ t *testing.T }

func (l *testLogger) Printf(format string, v ...any) {
	l.t.Helper()
	l.t.Logf(format, v...)
}

func newTestDeps(t *testing.T) engine.ModuleDeps {
	t.Helper()
	return engine.ModuleDeps{
		SessionID: uuid.New(),
		EventBus:  engine.NewEventBus(&testLogger{t}),
		Logger:    &testLogger{t},
	}
}

func TestScriptProgressionModule_Init(t *testing.T) {
	tests := []struct {
		name    string
		config  json.RawMessage
		wantErr bool
	}{
		{
			name:   "default config",
			config: nil,
		},
		{
			name:   "with all options",
			config: json.RawMessage(`{"AllowSkip":true,"ShowProgress":true,"AutoStartFirst":true,"phases":["p1","p2","p3"]}`),
		},
		{
			name:    "invalid json",
			config:  json.RawMessage(`{invalid`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewScriptProgressionModule()
			err := m.Init(context.Background(), newTestDeps(t), tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("Init() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestScriptProgressionModule_HandleMessage(t *testing.T) {
	tests := []struct {
		name      string
		allowSkip bool
		msgType   string
		wantErr   bool
		wantEvent string
	}{
		{
			name:      "skip allowed",
			allowSkip: true,
			msgType:   "script:skip",
			wantEvent: "progression.skip_requested",
		},
		{
			name:    "skip not allowed",
			msgType: "script:skip",
			wantErr: true,
		},
		{
			name:    "unknown message",
			msgType: "script:unknown",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deps := newTestDeps(t)
			m := NewScriptProgressionModule()

			cfg := map[string]any{"AllowSkip": tt.allowSkip}
			cfgJSON, _ := json.Marshal(cfg)
			if err := m.Init(context.Background(), deps, cfgJSON); err != nil {
				t.Fatalf("Init() error = %v", err)
			}

			var received string
			if tt.wantEvent != "" {
				deps.EventBus.Subscribe(tt.wantEvent, func(e engine.Event) {
					received = e.Type
				})
			}

			err := m.HandleMessage(context.Background(), uuid.New(), tt.msgType, nil)
			if (err != nil) != tt.wantErr {
				t.Errorf("HandleMessage() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantEvent != "" && received != tt.wantEvent {
				t.Errorf("expected event %q, got %q", tt.wantEvent, received)
			}
		})
	}
}

func TestScriptProgressionModule_BuildState(t *testing.T) {
	deps := newTestDeps(t)
	m := NewScriptProgressionModule()

	cfg := json.RawMessage(`{"AllowSkip":true,"ShowProgress":true,"phases":["p1","p2"]}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	raw, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState() error = %v", err)
	}

	var state map[string]any
	if err := json.Unmarshal(raw, &state); err != nil {
		t.Fatalf("unmarshal state error = %v", err)
	}

	if state["currentIndex"] != float64(0) {
		t.Errorf("currentIndex = %v, want 0", state["currentIndex"])
	}
	if state["totalPhases"] != float64(2) {
		t.Errorf("totalPhases = %v, want 2", state["totalPhases"])
	}
	if state["showProgress"] != true {
		t.Errorf("showProgress = %v, want true", state["showProgress"])
	}
	if state["allowSkip"] != true {
		t.Errorf("allowSkip = %v, want true", state["allowSkip"])
	}
}
