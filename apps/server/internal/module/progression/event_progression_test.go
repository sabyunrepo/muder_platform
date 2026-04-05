package progression

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestEventProgressionModule_Init(t *testing.T) {
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
			name:   "with initial phase and graph",
			config: json.RawMessage(`{"InitialPhase":"start","AllowBacktrack":true,"Graph":{"start":["middle"],"middle":["end"]}}`),
		},
		{
			name:    "invalid json",
			config:  json.RawMessage(`{bad`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewEventProgressionModule()
			err := m.Init(context.Background(), newTestDeps(t), tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("Init() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEventProgressionModule_HandleMessage(t *testing.T) {
	tests := []struct {
		name      string
		graph     map[string][]string
		initial   string
		backtrack bool
		triggerID string
		wantErr   bool
		wantEvent string
	}{
		{
			name:      "valid transition",
			graph:     map[string][]string{"start": {"middle"}},
			initial:   "start",
			triggerID: "middle",
			wantEvent: "event.phase_transition",
		},
		{
			name:      "invalid trigger",
			graph:     map[string][]string{"start": {"middle"}},
			initial:   "start",
			triggerID: "nonexistent",
			wantErr:   true,
		},
		{
			name:      "no edges from phase",
			graph:     map[string][]string{},
			initial:   "start",
			triggerID: "middle",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deps := newTestDeps(t)
			m := NewEventProgressionModule()

			cfg, _ := json.Marshal(map[string]any{
				"InitialPhase":   tt.initial,
				"AllowBacktrack": tt.backtrack,
				"Graph":          tt.graph,
			})
			if err := m.Init(context.Background(), deps, cfg); err != nil {
				t.Fatalf("Init() error = %v", err)
			}

			var received string
			if tt.wantEvent != "" {
				deps.EventBus.Subscribe(tt.wantEvent, func(e engine.Event) {
					received = e.Type
				})
			}

			payload, _ := json.Marshal(map[string]string{"TriggerID": tt.triggerID})
			err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload)
			if (err != nil) != tt.wantErr {
				t.Errorf("HandleMessage() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantEvent != "" && received != tt.wantEvent {
				t.Errorf("expected event %q, got %q", tt.wantEvent, received)
			}
		})
	}
}

func TestEventProgressionModule_BacktrackPrevention(t *testing.T) {
	deps := newTestDeps(t)
	m := NewEventProgressionModule()

	cfg, _ := json.Marshal(map[string]any{
		"InitialPhase":   "A",
		"AllowBacktrack": false,
		"Graph":          map[string][]string{"A": {"B"}, "B": {"A"}},
	})
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	// A -> B should succeed
	payload, _ := json.Marshal(map[string]string{"TriggerID": "B"})
	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err != nil {
		t.Fatalf("A->B transition error = %v", err)
	}

	// B -> A should fail (backtrack)
	payload, _ = json.Marshal(map[string]string{"TriggerID": "A"})
	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err == nil {
		t.Error("expected error for backtrack B->A, got nil")
	}
}

func TestEventProgressionModule_BuildState(t *testing.T) {
	deps := newTestDeps(t)
	m := NewEventProgressionModule()

	cfg := json.RawMessage(`{"InitialPhase":"start","AllowBacktrack":false}`)
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

	if state["currentPhase"] != "start" {
		t.Errorf("currentPhase = %v, want start", state["currentPhase"])
	}
	if state["allowBacktrack"] != false {
		t.Errorf("allowBacktrack = %v, want false", state["allowBacktrack"])
	}
}
