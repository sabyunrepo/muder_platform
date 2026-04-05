package progression

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestReadingModule_Init(t *testing.T) {
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
			name:   "custom config",
			config: json.RawMessage(`{"AdvanceMode":"auto","TotalLines":10}`),
		},
		{
			name:    "invalid json",
			config:  json.RawMessage(`{bad`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewReadingModule()
			err := m.Init(context.Background(), newTestDeps(t), tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("Init() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestReadingModule_HandleMessage(t *testing.T) {
	tests := []struct {
		name      string
		msgType   string
		payload   json.RawMessage
		wantErr   bool
		wantEvent string
	}{
		{
			name:      "advance line",
			msgType:   "reading:advance",
			wantEvent: "reading.line_changed",
		},
		{
			name:      "jump to line",
			msgType:   "reading:jump",
			payload:   json.RawMessage(`{"LineIndex":3}`),
			wantEvent: "reading.line_changed",
		},
		{
			name:    "jump out of range",
			msgType: "reading:jump",
			payload: json.RawMessage(`{"LineIndex":100}`),
			wantErr: true,
		},
		{
			name:    "jump negative",
			msgType: "reading:jump",
			payload: json.RawMessage(`{"LineIndex":-1}`),
			wantErr: true,
		},
		{
			name:    "unknown message",
			msgType: "reading:unknown",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			deps := newTestDeps(t)
			m := NewReadingModule()

			cfg := json.RawMessage(`{"TotalLines":10}`)
			if err := m.Init(context.Background(), deps, cfg); err != nil {
				t.Fatalf("Init() error = %v", err)
			}

			var received string
			if tt.wantEvent != "" {
				deps.EventBus.Subscribe(tt.wantEvent, func(e engine.Event) {
					received = e.Type
				})
			}

			err := m.HandleMessage(context.Background(), uuid.New(), tt.msgType, tt.payload)
			if (err != nil) != tt.wantErr {
				t.Errorf("HandleMessage() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantEvent != "" && received != tt.wantEvent {
				t.Errorf("expected event %q, got %q", tt.wantEvent, received)
			}
		})
	}
}

func TestReadingModule_Completion(t *testing.T) {
	deps := newTestDeps(t)
	m := NewReadingModule()

	cfg := json.RawMessage(`{"TotalLines":3}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	var completed bool
	deps.EventBus.Subscribe("reading.completed", func(e engine.Event) {
		completed = true
	})

	playerID := uuid.New()

	// Advance from 0 to 1
	if err := m.HandleMessage(context.Background(), playerID, "reading:advance", nil); err != nil {
		t.Fatalf("advance error = %v", err)
	}
	if completed {
		t.Error("should not be completed at line 1 of 3")
	}

	// Advance from 1 to 2 (last line, index = totalLines-1)
	if err := m.HandleMessage(context.Background(), playerID, "reading:advance", nil); err != nil {
		t.Fatalf("advance error = %v", err)
	}
	if !completed {
		t.Error("expected completed at last line")
	}
}

func TestReadingModule_JumpToLastLine(t *testing.T) {
	deps := newTestDeps(t)
	m := NewReadingModule()

	cfg := json.RawMessage(`{"TotalLines":5}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	var completed bool
	deps.EventBus.Subscribe("reading.completed", func(e engine.Event) {
		completed = true
	})

	payload := json.RawMessage(`{"LineIndex":4}`)
	if err := m.HandleMessage(context.Background(), uuid.New(), "reading:jump", payload); err != nil {
		t.Fatalf("jump error = %v", err)
	}
	if !completed {
		t.Error("expected completed when jumping to last line")
	}
}

func TestReadingModule_BuildState(t *testing.T) {
	deps := newTestDeps(t)
	m := NewReadingModule()

	cfg := json.RawMessage(`{"AdvanceMode":"player","TotalLines":20}`)
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

	if state["currentLine"] != float64(0) {
		t.Errorf("currentLine = %v, want 0", state["currentLine"])
	}
	if state["totalLines"] != float64(20) {
		t.Errorf("totalLines = %v, want 20", state["totalLines"])
	}
	if state["isActive"] != true {
		t.Errorf("isActive = %v, want true", state["isActive"])
	}
	if state["advanceMode"] != "player" {
		t.Errorf("advanceMode = %v, want player", state["advanceMode"])
	}
}
