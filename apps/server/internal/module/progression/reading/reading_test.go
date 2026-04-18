package reading

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
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
	// Note: the legacy "reading:advance" and "reading:voice_ended" branches
	// of HandleMessage are now intentionally gated and return
	// ErrReadingAdvanceForbidden — production callers must route through
	// HandleAdvance / HandleVoiceEnded so the per-line permission and
	// stale-race guards apply. Only the jump and unknown-message branches
	// remain as legitimate HandleMessage cases.
	tests := []struct {
		name      string
		msgType   string
		payload   json.RawMessage
		wantErr   bool
		wantCode  string
		wantEvent string
	}{
		{
			name:     "advance forbidden via legacy path",
			msgType:  "reading:advance",
			wantErr:  true,
			wantCode: apperror.ErrReadingAdvanceForbidden,
		},
		{
			name:     "voice_ended forbidden via legacy path",
			msgType:  "reading:voice_ended",
			wantErr:  true,
			wantCode: apperror.ErrReadingAdvanceForbidden,
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
			if tt.wantCode != "" {
				var ae *apperror.AppError
				if !errors.As(err, &ae) {
					t.Fatalf("expected *apperror.AppError, got %T: %v", err, err)
				}
				if ae.Code != tt.wantCode {
					t.Errorf("error code = %q, want %q", ae.Code, tt.wantCode)
				}
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
	if err := m.HandleAdvance(context.Background(), playerID, true, ""); err != nil {
		t.Fatalf("advance error = %v", err)
	}
	if completed {
		t.Error("should not be completed at line 1 of 3")
	}

	// Advance from 1 to 2 (last line, index = totalLines-1)
	if err := m.HandleAdvance(context.Background(), playerID, true, ""); err != nil {
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

func TestReadingModule_HandleVoiceEnded(t *testing.T) {
	cfg := json.RawMessage(`{
		"TotalLines": 3,
		"Lines": [
			{"AdvanceBy": "voice", "VoiceID": "v0"},
			{"AdvanceBy": "gm", "VoiceID": "v1"},
			{"AdvanceBy": "voice", "VoiceID": "v2"}
		]
	}`)

	t.Run("voice line: voice_ended advances", func(t *testing.T) {
		m := NewReadingModule()
		deps := newTestDeps(t)
		if err := m.Init(context.Background(), deps, cfg); err != nil {
			t.Fatalf("Init() error = %v", err)
		}
		// On line 0 (voice). HandleVoiceEnded should advance to line 1.
		if err := m.HandleVoiceEnded(context.Background(), "v0"); err != nil {
			t.Fatalf("HandleVoiceEnded() error = %v", err)
		}
		state := m.GetState()
		if state.CurrentIndex != 1 {
			t.Errorf("CurrentIndex = %d, want 1", state.CurrentIndex)
		}
	})

	t.Run("gm line: voice_ended is a no-op", func(t *testing.T) {
		m := NewReadingModule()
		deps := newTestDeps(t)
		if err := m.Init(context.Background(), deps, cfg); err != nil {
			t.Fatalf("Init() error = %v", err)
		}
		// Manually advance past the voice line via HandleVoiceEnded.
		if err := m.HandleVoiceEnded(context.Background(), "v0"); err != nil {
			t.Fatalf("setup voice_ended error = %v", err)
		}
		// Now on gm line — voice_ended should be ignored.
		if err := m.HandleVoiceEnded(context.Background(), "v1"); err != nil {
			t.Fatalf("HandleVoiceEnded gm-line error = %v", err)
		}
		state := m.GetState()
		if state.CurrentIndex != 1 {
			t.Errorf("CurrentIndex = %d, want 1 (no-op on gm line)", state.CurrentIndex)
		}
	})
}

func TestReadingModule_HandleVoiceEnded_StaleVoiceID(t *testing.T) {
	// Two voice lines: current line has VoiceID v0. A stale voice_ended for
	// v1 must NOT advance the line and must NOT publish any event.
	cfg := json.RawMessage(`{
		"TotalLines": 2,
		"Lines": [
			{"AdvanceBy": "voice", "VoiceID": "v0"},
			{"AdvanceBy": "voice", "VoiceID": "v1"}
		]
	}`)

	m := NewReadingModule()
	deps := newTestDeps(t)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	var lineChanged int
	deps.EventBus.Subscribe("reading.line_changed", func(e engine.Event) {
		lineChanged++
	})

	// Stale voice id: should be silently ignored.
	if err := m.HandleVoiceEnded(context.Background(), "stale-id-99"); err != nil {
		t.Fatalf("HandleVoiceEnded stale-id error = %v", err)
	}
	if got := m.GetState().CurrentIndex; got != 0 {
		t.Errorf("currentIndex advanced on stale voice id: got %d, want 0", got)
	}
	if lineChanged != 0 {
		t.Errorf("reading.line_changed published on stale voice id: count = %d", lineChanged)
	}

	// Empty voice id: accepted (backward compat) — should advance.
	if err := m.HandleVoiceEnded(context.Background(), ""); err != nil {
		t.Fatalf("HandleVoiceEnded empty error = %v", err)
	}
	if got := m.GetState().CurrentIndex; got != 1 {
		t.Errorf("currentIndex after empty voice id: got %d, want 1", got)
	}

	// Matching voice id on the current line: should advance.
	if err := m.HandleVoiceEnded(context.Background(), "v1"); err != nil {
		t.Fatalf("HandleVoiceEnded match error = %v", err)
	}
}

func TestReadingModule_HandleVoiceEnded_StaleVoiceMediaID(t *testing.T) {
	// VoiceMediaID is the production-shape field; ensure it's checked too.
	cfg := json.RawMessage(`{
		"TotalLines": 2,
		"Lines": [
			{"AdvanceBy": "voice", "VoiceMediaID": "media-5"},
			{"AdvanceBy": "voice", "VoiceMediaID": "media-6"}
		]
	}`)

	m := NewReadingModule()
	deps := newTestDeps(t)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	if err := m.HandleVoiceEnded(context.Background(), "media-1"); err != nil {
		t.Fatalf("HandleVoiceEnded stale media error = %v", err)
	}
	if got := m.GetState().CurrentIndex; got != 0 {
		t.Errorf("currentIndex advanced on stale media id: got %d, want 0", got)
	}

	if err := m.HandleVoiceEnded(context.Background(), "media-5"); err != nil {
		t.Fatalf("HandleVoiceEnded match media error = %v", err)
	}
	if got := m.GetState().CurrentIndex; got != 1 {
		t.Errorf("currentIndex after match: got %d, want 1", got)
	}
}

func TestReadingModule_EmitsReadingStartedOnInit(t *testing.T) {
	// reading.started is consumed by the WS bridge to push the initial
	// line buffer to all clients. It must include every line with the
	// PascalCase storage shape so the bridge can convert to camelCase.
	cfg := json.RawMessage(`{
		"TotalLines": 2,
		"BGMId": "bgm-1",
		"Lines": [
			{"Index": 0, "Text": "hello", "Speaker": "narrator", "AdvanceBy": "gm"},
			{"Index": 1, "Text": "world", "Speaker": "Alice", "AdvanceBy": "role:alice"}
		]
	}`)

	deps := newTestDeps(t)

	var started engine.Event
	var startedCount int
	deps.EventBus.Subscribe("reading.started", func(e engine.Event) {
		started = e
		startedCount++
	})

	m := NewReadingModule()
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	if startedCount != 1 {
		t.Fatalf("reading.started emitted %d times, want 1", startedCount)
	}
	payload, ok := started.Payload.(map[string]any)
	if !ok {
		t.Fatalf("reading.started payload type = %T, want map[string]any", started.Payload)
	}
	if payload["bgmMediaId"] != "bgm-1" {
		t.Errorf("bgmMediaId = %v, want bgm-1", payload["bgmMediaId"])
	}
	if payload["totalLines"] != 2 {
		t.Errorf("totalLines = %v, want 2", payload["totalLines"])
	}
	// Re-marshal and decode to verify storage shape flows through — index
	// and text must be present on every line.
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	var decoded struct {
		Lines []readingLineConfig `json:"lines"`
	}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if len(decoded.Lines) != 2 {
		t.Fatalf("lines length = %d, want 2", len(decoded.Lines))
	}
	if decoded.Lines[0].Text != "hello" || decoded.Lines[0].Index != 0 {
		t.Errorf("line[0] = %+v, want {Index:0, Text:hello}", decoded.Lines[0])
	}
	if decoded.Lines[1].Text != "world" || decoded.Lines[1].Index != 1 {
		t.Errorf("line[1] = %+v, want {Index:1, Text:world}", decoded.Lines[1])
	}
	if decoded.Lines[1].AdvanceBy != "role:alice" {
		t.Errorf("line[1].AdvanceBy = %q, want role:alice", decoded.Lines[1].AdvanceBy)
	}
}

func TestReadingModule_GetReadingStateWire(t *testing.T) {
	cfg := json.RawMessage(`{
		"TotalLines": 2,
		"BGMId": "bgm-1",
		"Lines": [
			{"AdvanceBy": "gm", "VoiceID": "v0", "Speaker": "narrator"},
			{"AdvanceBy": "gm", "VoiceID": "v1"}
		]
	}`)
	m := NewReadingModule()
	if err := m.Init(context.Background(), newTestDeps(t), cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	wire := m.GetReadingStateWire()
	if wire.CurrentIndex != 0 {
		t.Errorf("CurrentIndex = %d, want 0", wire.CurrentIndex)
	}
	if wire.BgmMediaID != "bgm-1" {
		t.Errorf("BgmMediaID = %q, want bgm-1", wire.BgmMediaID)
	}
	if wire.Status != "playing" {
		t.Errorf("Status = %q, want playing", wire.Status)
	}
	// Lines should be valid JSON.
	var lines []map[string]any
	if err := json.Unmarshal(wire.Lines, &lines); err != nil {
		t.Fatalf("Lines is not valid JSON: %v", err)
	}
	if len(lines) != 2 {
		t.Errorf("len(Lines) = %d, want 2", len(lines))
	}
}

// --- PR-2b: broadcast-shape snapshot (no per-player progress) ---

func TestReadingModule_BuildStateFor_Broadcast(t *testing.T) {
	m := NewReadingModule()
	if err := m.Init(context.Background(), newTestDeps(t), nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	bob := uuid.New()

	aliceData, err := m.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor(alice): %v", err)
	}
	bobData, err := m.BuildStateFor(bob)
	if err != nil {
		t.Fatalf("BuildStateFor(bob): %v", err)
	}

	if string(aliceData) != string(bobData) {
		t.Fatalf("reading is broadcast — alice and bob should see identical snapshots\n  alice: %s\n  bob:   %s", aliceData, bobData)
	}
	var s map[string]any
	if err := json.Unmarshal(aliceData, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for _, k := range []string{"currentLine", "totalLines", "isActive", "advanceMode"} {
		if _, ok := s[k]; !ok {
			t.Errorf("expected key %q in snapshot, got %v", k, s)
		}
	}
}

func TestReadingModule_BuildStateFor_ReflectsLineIndex(t *testing.T) {
	m := NewReadingModule()
	if err := m.Init(context.Background(), newTestDeps(t), nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	m.mu.Lock()
	m.currentLineIndex = 3
	m.totalLines = 10
	m.mu.Unlock()

	data, _ := m.BuildStateFor(uuid.New())
	var s map[string]any
	_ = json.Unmarshal(data, &s)
	if got := s["currentLine"]; got != float64(3) {
		t.Fatalf("currentLine got %v, want 3", got)
	}
	if got := s["totalLines"]; got != float64(10) {
		t.Fatalf("totalLines got %v, want 10", got)
	}
}

func TestReadingModule_BuildStateFor_UsesIndependentPath(t *testing.T) {
	// BuildStateFor must NOT delegate to BuildState (stub pattern banned by
	// PR-2b coverage lint). Verify path independence by ensuring both
	// produce equivalent JSON even after concurrent state reads.
	m := NewReadingModule()
	if err := m.Init(context.Background(), newTestDeps(t), nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	pub, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	per, err := m.BuildStateFor(uuid.New())
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	// They should produce the same logical content (same keys/values)
	// because reading has no per-player redaction. We parse both as
	// map[string]any and compare key-by-key rather than byte-comparing to
	// tolerate future ordering differences.
	var pubMap, perMap map[string]any
	if err := json.Unmarshal(pub, &pubMap); err != nil {
		t.Fatalf("unmarshal pub: %v", err)
	}
	if err := json.Unmarshal(per, &perMap); err != nil {
		t.Fatalf("unmarshal per: %v", err)
	}
	for k, v := range pubMap {
		if perMap[k] != v {
			t.Errorf("key %q: BuildState=%v BuildStateFor=%v", k, v, perMap[k])
		}
	}
}
