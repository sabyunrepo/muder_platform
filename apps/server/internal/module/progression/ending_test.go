package progression

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestEndingModule_Init(t *testing.T) {
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
			name:   "custom reveal steps",
			config: json.RawMessage(`{"RevealSteps":["vote_result","criminal_reveal"],"ShowTimeline":true}`),
		},
		{
			name:    "invalid json",
			config:  json.RawMessage(`{bad`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewEndingModule()
			err := m.Init(context.Background(), newTestDeps(t), tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("Init() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEndingModule_DefaultRevealSteps(t *testing.T) {
	m := NewEndingModule()
	if err := m.Init(context.Background(), newTestDeps(t), nil); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	if m.totalSteps != 6 {
		t.Errorf("totalSteps = %d, want 6 (default)", m.totalSteps)
	}

	expected := []string{"vote_result", "criminal_reveal", "timeline", "relationships", "mission_scores", "ending_content"}
	for i, step := range expected {
		if m.revealSteps[i] != step {
			t.Errorf("revealSteps[%d] = %q, want %q", i, m.revealSteps[i], step)
		}
	}
}

func TestEndingModule_HandleMessage(t *testing.T) {
	tests := []struct {
		name      string
		msgType   string
		wantErr   bool
		wantEvent string
	}{
		{
			name:      "next reveal",
			msgType:   "ending:next_reveal",
			wantEvent: "ending.reveal_step",
		},
		{
			name:    "unknown message",
			msgType: "ending:unknown",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deps := newTestDeps(t)
			m := NewEndingModule()

			cfg := json.RawMessage(`{"RevealSteps":["step1","step2"]}`)
			if err := m.Init(context.Background(), deps, cfg); err != nil {
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

func TestEndingModule_RevealSequence(t *testing.T) {
	deps := newTestDeps(t)
	m := NewEndingModule()

	cfg := json.RawMessage(`{"RevealSteps":["step1","step2","step3"]}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	var revealedSteps []string
	deps.EventBus.Subscribe("ending.reveal_step", func(e engine.Event) {
		if p, ok := e.Payload.(map[string]any); ok {
			step, _ := p["Step"].(string)
			revealedSteps = append(revealedSteps, step)
		}
	})

	var completed bool
	deps.EventBus.Subscribe("ending.completed", func(e engine.Event) {
		completed = true
	})

	playerID := uuid.New()

	// Reveal step 1
	if err := m.HandleMessage(context.Background(), playerID, "ending:next_reveal", nil); err != nil {
		t.Fatalf("reveal step 1 error = %v", err)
	}
	if completed {
		t.Error("should not be completed after step 1")
	}

	// Reveal step 2
	if err := m.HandleMessage(context.Background(), playerID, "ending:next_reveal", nil); err != nil {
		t.Fatalf("reveal step 2 error = %v", err)
	}
	if completed {
		t.Error("should not be completed after step 2")
	}

	// Reveal step 3 (last)
	if err := m.HandleMessage(context.Background(), playerID, "ending:next_reveal", nil); err != nil {
		t.Fatalf("reveal step 3 error = %v", err)
	}
	if !completed {
		t.Error("expected completed after last step")
	}

	// Extra reveal should fail
	if err := m.HandleMessage(context.Background(), playerID, "ending:next_reveal", nil); err == nil {
		t.Error("expected error when all steps already revealed")
	}

	// Verify steps were revealed in order
	expected := []string{"step1", "step2", "step3"}
	if len(revealedSteps) != len(expected) {
		t.Fatalf("revealedSteps length = %d, want %d", len(revealedSteps), len(expected))
	}
	for i, step := range expected {
		if revealedSteps[i] != step {
			t.Errorf("revealedSteps[%d] = %q, want %q", i, revealedSteps[i], step)
		}
	}
}

func TestEndingModule_BuildState(t *testing.T) {
	deps := newTestDeps(t)
	m := NewEndingModule()

	cfg := json.RawMessage(`{"RevealSteps":["a","b","c"]}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	// Reveal one step
	if err := m.HandleMessage(context.Background(), uuid.New(), "ending:next_reveal", nil); err != nil {
		t.Fatalf("reveal error = %v", err)
	}

	raw, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState() error = %v", err)
	}

	var state map[string]any
	if err := json.Unmarshal(raw, &state); err != nil {
		t.Fatalf("unmarshal error = %v", err)
	}

	if state["currentStep"] != float64(1) {
		t.Errorf("currentStep = %v, want 1", state["currentStep"])
	}
	if state["totalSteps"] != float64(3) {
		t.Errorf("totalSteps = %v, want 3", state["totalSteps"])
	}
	if state["isRevealing"] != true {
		t.Errorf("isRevealing = %v, want true", state["isRevealing"])
	}

	revealedSteps, ok := state["revealedSteps"].([]any)
	if !ok {
		t.Fatalf("revealedSteps type = %T, want []any", state["revealedSteps"])
	}
	if len(revealedSteps) != 1 || revealedSteps[0] != "a" {
		t.Errorf("revealedSteps = %v, want [a]", revealedSteps)
	}
}
