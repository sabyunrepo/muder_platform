package progression

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
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

func TestReadingModule_AdvanceAuthorization(t *testing.T) {
	// Config with 4 lines, each with a different advanceBy semantics.
	// Line indices:
	//   0 -> "gm"             (current line; advance moves to 1)
	//   1 -> "role:detective"
	//   2 -> "voice"
	//   3 -> (last)
	cfg := json.RawMessage(`{
		"TotalLines": 4,
		"Lines": [
			{"AdvanceBy": "gm"},
			{"AdvanceBy": "role:detective"},
			{"AdvanceBy": "voice"},
			{"AdvanceBy": "gm"}
		]
	}`)

	newModule := func(t *testing.T) *ReadingModule {
		t.Helper()
		m := NewReadingModule()
		if err := m.Init(context.Background(), newTestDeps(t), cfg); err != nil {
			t.Fatalf("Init() error = %v", err)
		}
		return m
	}

	assertCode := func(t *testing.T, err error, wantCode string) {
		t.Helper()
		if err == nil {
			t.Fatalf("expected error with code %q, got nil", wantCode)
		}
		var ae *apperror.AppError
		if !errors.As(err, &ae) {
			t.Fatalf("expected *apperror.AppError, got %T: %v", err, err)
		}
		if ae.Code != wantCode {
			t.Fatalf("expected code %q, got %q", wantCode, ae.Code)
		}
	}

	t.Run("gm line: host can advance", func(t *testing.T) {
		m := newModule(t)
		err := m.HandleAdvance(context.Background(), uuid.New(), true, "")
		if err != nil {
			t.Fatalf("HandleAdvance() error = %v", err)
		}
	})

	t.Run("gm line: non-host cannot advance", func(t *testing.T) {
		m := newModule(t)
		err := m.HandleAdvance(context.Background(), uuid.New(), false, "detective")
		assertCode(t, err, apperror.ErrReadingAdvanceForbidden)
	})

	t.Run("role line: matching role can advance", func(t *testing.T) {
		m := newModule(t)
		// move to line index 1 (role:detective is on line 1)
		if err := m.HandleAdvance(context.Background(), uuid.New(), true, ""); err != nil {
			t.Fatalf("setup advance error = %v", err)
		}
		// now currentLineIndex == 1; advancing requires detective role
		err := m.HandleAdvance(context.Background(), uuid.New(), false, "detective")
		if err != nil {
			t.Fatalf("HandleAdvance() detective error = %v", err)
		}
	})

	t.Run("role line: other role cannot advance", func(t *testing.T) {
		m := newModule(t)
		if err := m.HandleAdvance(context.Background(), uuid.New(), true, ""); err != nil {
			t.Fatalf("setup advance error = %v", err)
		}
		err := m.HandleAdvance(context.Background(), uuid.New(), false, "suspect")
		assertCode(t, err, apperror.ErrReadingAdvanceForbidden)
	})

	t.Run("voice line: manual advance forbidden for everyone", func(t *testing.T) {
		m := newModule(t)
		// advance twice to land on line index 2 (voice)
		if err := m.HandleAdvance(context.Background(), uuid.New(), true, ""); err != nil {
			t.Fatalf("setup advance 1 error = %v", err)
		}
		if err := m.HandleAdvance(context.Background(), uuid.New(), false, "detective"); err != nil {
			t.Fatalf("setup advance 2 error = %v", err)
		}
		// currentLineIndex == 2; voice line — host attempt
		err := m.HandleAdvance(context.Background(), uuid.New(), true, "")
		assertCode(t, err, apperror.ErrReadingAdvanceForbidden)
	})

	t.Run("invalid advanceBy string", func(t *testing.T) {
		badCfg := json.RawMessage(`{
			"TotalLines": 2,
			"Lines": [
				{"AdvanceBy": "wat"},
				{"AdvanceBy": "gm"}
			]
		}`)
		m := NewReadingModule()
		if err := m.Init(context.Background(), newTestDeps(t), badCfg); err != nil {
			t.Fatalf("Init() error = %v", err)
		}
		err := m.HandleAdvance(context.Background(), uuid.New(), true, "")
		assertCode(t, err, apperror.ErrReadingInvalidAdvanceBy)
	})

	t.Run("no current line: out of range", func(t *testing.T) {
		emptyCfg := json.RawMessage(`{"TotalLines": 0}`)
		m := NewReadingModule()
		if err := m.Init(context.Background(), newTestDeps(t), emptyCfg); err != nil {
			t.Fatalf("Init() error = %v", err)
		}
		err := m.HandleAdvance(context.Background(), uuid.New(), true, "")
		assertCode(t, err, apperror.ErrReadingLineOutOfRange)
	})
}

func TestReadingModule_PausedOnPlayerLeave_RoleLine(t *testing.T) {
	// Config: line 0 is gm, line 1 is role:detective. Advance to line 1
	// then have detective leave -> expect reading.paused.
	cfg := json.RawMessage(`{
		"TotalLines": 3,
		"Lines": [
			{"AdvanceBy": "gm"},
			{"AdvanceBy": "role:detective"},
			{"AdvanceBy": "gm"}
		]
	}`)

	deps := newTestDeps(t)
	m := NewReadingModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	// Move to line index 1 (role:detective)
	if err := m.HandleAdvance(context.Background(), uuid.New(), true, ""); err != nil {
		t.Fatalf("setup advance error = %v", err)
	}

	var paused engine.Event
	deps.EventBus.Subscribe("reading.paused", func(e engine.Event) {
		paused = e
	})

	m.HandlePlayerLeft(context.Background(), false, []string{"detective"})

	if paused.Type != "reading.paused" {
		t.Fatalf("expected reading.paused event, got %q", paused.Type)
	}
	payload, ok := paused.Payload.(map[string]any)
	if !ok {
		t.Fatalf("expected map payload, got %T", paused.Payload)
	}
	if payload["reason"] != "player_left" {
		t.Errorf("expected reason player_left, got %v", payload["reason"])
	}
	state := m.GetState()
	if state.Status != "paused" {
		t.Errorf("expected status paused, got %q", state.Status)
	}
}

func TestReadingModule_PausedOnHostLeave_GmLine(t *testing.T) {
	cfg := json.RawMessage(`{
		"TotalLines": 2,
		"Lines": [
			{"AdvanceBy": "gm"},
			{"AdvanceBy": "gm"}
		]
	}`)

	deps := newTestDeps(t)
	m := NewReadingModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	var pausedFired bool
	deps.EventBus.Subscribe("reading.paused", func(e engine.Event) {
		pausedFired = true
	})

	m.HandlePlayerLeft(context.Background(), true, nil)
	if !pausedFired {
		t.Errorf("expected reading.paused on host leave with gm line")
	}
	if m.GetState().Status != "paused" {
		t.Errorf("expected status paused")
	}
}

func TestReadingModule_NoEventOnPlayerLeave_VoiceLine(t *testing.T) {
	cfg := json.RawMessage(`{
		"TotalLines": 3,
		"Lines": [
			{"AdvanceBy": "gm"},
			{"AdvanceBy": "voice"},
			{"AdvanceBy": "gm"}
		]
	}`)

	deps := newTestDeps(t)
	m := NewReadingModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	// move to line index 1 (voice)
	if err := m.HandleAdvance(context.Background(), uuid.New(), true, ""); err != nil {
		t.Fatalf("setup advance error = %v", err)
	}

	var pausedFired bool
	deps.EventBus.Subscribe("reading.paused", func(e engine.Event) {
		pausedFired = true
	})

	m.HandlePlayerLeft(context.Background(), false, []string{"detective"})
	if pausedFired {
		t.Errorf("voice line must not pause on player leave")
	}
	m.HandlePlayerLeft(context.Background(), true, nil)
	if pausedFired {
		t.Errorf("voice line must not pause on host leave")
	}
}

func TestReadingModule_ResumedAfterPlayerRejoin(t *testing.T) {
	cfg := json.RawMessage(`{
		"TotalLines": 3,
		"Lines": [
			{"AdvanceBy": "gm"},
			{"AdvanceBy": "role:detective"},
			{"AdvanceBy": "gm"}
		]
	}`)

	deps := newTestDeps(t)
	m := NewReadingModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	if err := m.HandleAdvance(context.Background(), uuid.New(), true, ""); err != nil {
		t.Fatalf("setup advance error = %v", err)
	}
	m.HandlePlayerLeft(context.Background(), false, []string{"detective"})
	if m.GetState().Status != "paused" {
		t.Fatalf("setup: expected paused state")
	}

	var resumedFired bool
	deps.EventBus.Subscribe("reading.resumed", func(e engine.Event) {
		resumedFired = true
	})

	m.HandlePlayerRejoined(context.Background(), false, []string{"detective"})
	if !resumedFired {
		t.Errorf("expected reading.resumed event")
	}
	if m.GetState().Status != "playing" {
		t.Errorf("expected status playing, got %q", m.GetState().Status)
	}
}

func TestReadingModule_GetState(t *testing.T) {
	cfg := json.RawMessage(`{
		"TotalLines": 4,
		"BGMId": "bgm-1",
		"Lines": [
			{"AdvanceBy": "gm", "Speaker": "narrator"},
			{"AdvanceBy": "role:detective", "VoiceMediaID": "voice-1"},
			{"AdvanceBy": "voice"},
			{"AdvanceBy": "gm"}
		]
	}`)

	deps := newTestDeps(t)
	m := NewReadingModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	// advance once -> currentIndex 1
	if err := m.HandleAdvance(context.Background(), uuid.New(), true, ""); err != nil {
		t.Fatalf("advance error = %v", err)
	}

	state := m.GetState()
	if state.CurrentIndex != 1 {
		t.Errorf("currentIndex = %d, want 1", state.CurrentIndex)
	}
	if state.BgmMediaID != "bgm-1" {
		t.Errorf("bgmMediaId = %q, want bgm-1", state.BgmMediaID)
	}
	if state.Status != "playing" {
		t.Errorf("status = %q, want playing", state.Status)
	}
	if len(state.Lines) != 4 {
		t.Errorf("expected 4 lines, got %d", len(state.Lines))
	}
	if state.Lines[1].AdvanceBy != "role:detective" {
		t.Errorf("expected role:detective, got %q", state.Lines[1].AdvanceBy)
	}
	// Snapshot must be independent — mutating returned slice must not affect module
	state.Lines[0].AdvanceBy = "mutated"
	state2 := m.GetState()
	if state2.Lines[0].AdvanceBy == "mutated" {
		t.Errorf("GetState() must return an independent snapshot")
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
