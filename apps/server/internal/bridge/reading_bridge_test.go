package bridge

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/engine"
	"github.com/mmp-platform/server/internal/module/progression/reading"
	"github.com/mmp-platform/server/internal/ws"
)

// testLogger implements engine.Logger for testing.
type testLogger struct{ t *testing.T }

func (l *testLogger) Printf(format string, v ...any) {
	l.t.Helper()
	l.t.Logf(format, v...)
}

// newAdapter constructs a fully-initialised ReadingModuleAdapter wrapping a
// reading.ReadingModule with the given JSON config.
func newAdapter(t *testing.T, cfg json.RawMessage) *ReadingModuleAdapter {
	t.Helper()
	mod := reading.NewReadingModule()
	logger := &testLogger{t}
	deps := engine.ModuleDeps{
		SessionID: uuid.New(),
		EventBus:  engine.NewEventBus(logger),
		Logger:    logger,
	}
	if err := mod.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	return &ReadingModuleAdapter{Module: mod}
}

func TestReadingModuleAdapter_InterfaceSatisfaction(t *testing.T) {
	// Compile-time check (already at package scope), but assert at runtime
	// too so this test fails loudly if the interface drifts.
	var _ ws.ReadingModuleAPI = (*ReadingModuleAdapter)(nil)

	a := newAdapter(t, json.RawMessage(`{"TotalLines":1,"Lines":[{"AdvanceBy":"gm"}]}`))
	var iface ws.ReadingModuleAPI = a
	if iface == nil {
		t.Fatal("adapter does not satisfy ws.ReadingModuleAPI at runtime")
	}
}

func TestReadingModuleAdapter_GetReadingStateSnapshot_CamelCaseLines(t *testing.T) {
	// Storage uses PascalCase tags. The adapter must convert to camelCase
	// on the wire so the FE consumer sees a consistent payload.
	cfg := json.RawMessage(`{
		"TotalLines": 2,
		"BGMId": "bgm-1",
		"Lines": [
			{"Index": 0, "Text": "안녕, 누구 있어?", "AdvanceBy": "voice", "Speaker": "NPC", "VoiceMediaID": "v-1"},
			{"Index": 1, "Text": "조용한 밤이었다.", "AdvanceBy": "gm"}
		]
	}`)
	a := newAdapter(t, cfg)

	snap := a.GetReadingStateSnapshot()
	if snap.BgmMediaID != "bgm-1" {
		t.Errorf("BgmMediaID = %q, want bgm-1", snap.BgmMediaID)
	}
	if snap.Status != "playing" {
		t.Errorf("Status = %q, want playing", snap.Status)
	}

	// Marshal the full snapshot envelope and inspect the lines payload.
	full, err := json.Marshal(snap)
	if err != nil {
		t.Fatalf("marshal snapshot: %v", err)
	}
	got := string(full)

	// camelCase keys must be present — including index and text, which are
	// required for the FE ReadingOverlay to render dialogue.
	for _, want := range []string{`"voiceMediaId"`, `"advanceBy"`, `"speaker"`, `"index"`, `"text"`} {
		if !strings.Contains(got, want) {
			t.Errorf("snapshot JSON missing camelCase key %s\npayload: %s", want, got)
		}
	}

	// PascalCase storage keys must NOT leak through.
	for _, bad := range []string{`"VoiceMediaID"`, `"AdvanceBy"`, `"Speaker"`, `"Index"`, `"Text"`} {
		if strings.Contains(got, bad) {
			t.Errorf("snapshot JSON leaked PascalCase key %s\npayload: %s", bad, got)
		}
	}

	// Decode lines to verify the per-line shape end-to-end.
	var lines []map[string]any
	if err := json.Unmarshal(snap.Lines, &lines); err != nil {
		t.Fatalf("unmarshal lines: %v", err)
	}
	if len(lines) != 2 {
		t.Fatalf("len(lines) = %d, want 2", len(lines))
	}
	if lines[0]["voiceMediaId"] != "v-1" {
		t.Errorf("lines[0].voiceMediaId = %v, want v-1", lines[0]["voiceMediaId"])
	}
	if lines[0]["speaker"] != "NPC" {
		t.Errorf("lines[0].speaker = %v, want NPC", lines[0]["speaker"])
	}
	if lines[0]["advanceBy"] != "voice" {
		t.Errorf("lines[0].advanceBy = %v, want voice", lines[0]["advanceBy"])
	}
	// Index/Text round-trip from storage PascalCase through camelCase wire.
	if lines[0]["text"] != "안녕, 누구 있어?" {
		t.Errorf("lines[0].text = %v, want 안녕, 누구 있어?", lines[0]["text"])
	}
	// JSON numbers decode as float64; line 0 is Index 0.
	if got := lines[0]["index"]; got != float64(0) {
		t.Errorf("lines[0].index = %v, want 0", got)
	}
	if lines[1]["text"] != "조용한 밤이었다." {
		t.Errorf("lines[1].text = %v, want 조용한 밤이었다.", lines[1]["text"])
	}
	if got := lines[1]["index"]; got != float64(1) {
		t.Errorf("lines[1].index = %v, want 1", got)
	}
}

func TestReadingModuleAdapter_GetReadingStateSnapshot_EmptyLines(t *testing.T) {
	a := newAdapter(t, json.RawMessage(`{"TotalLines":0}`))
	snap := a.GetReadingStateSnapshot()
	if snap.Lines == nil {
		t.Fatal("expected non-nil Lines on empty config")
	}
	// Should be a JSON array (possibly empty).
	var lines []map[string]any
	if err := json.Unmarshal(snap.Lines, &lines); err != nil {
		t.Fatalf("Lines is not a JSON array: %v", err)
	}
}

func TestReadingModuleAdapter_HandleAdvance_DelegatesToModule(t *testing.T) {
	a := newAdapter(t, json.RawMessage(`{
		"TotalLines": 2,
		"Lines": [
			{"AdvanceBy": "gm"},
			{"AdvanceBy": "gm"}
		]
	}`))

	// Host advance succeeds.
	if err := a.HandleAdvance(context.Background(), uuid.New(), true, ""); err != nil {
		t.Fatalf("HandleAdvance host error = %v", err)
	}
	// Non-host advance is rejected with the module's permission error.
	if err := a.HandleAdvance(context.Background(), uuid.New(), false, ""); err == nil {
		t.Errorf("expected permission error for non-host advance")
	}
}

func TestReadingModuleAdapter_HandleVoiceEnded_DelegatesToModule(t *testing.T) {
	a := newAdapter(t, json.RawMessage(`{
		"TotalLines": 2,
		"Lines": [
			{"AdvanceBy": "voice", "VoiceMediaID": "media-1"},
			{"AdvanceBy": "gm"}
		]
	}`))

	// Stale voice id: no advance.
	if err := a.HandleVoiceEnded(context.Background(), "stale"); err != nil {
		t.Fatalf("HandleVoiceEnded stale error = %v", err)
	}
	if got := a.GetReadingStateSnapshot().CurrentIndex; got != 0 {
		t.Errorf("currentIndex advanced on stale id: got %d, want 0", got)
	}

	// Matching voice id: advances.
	if err := a.HandleVoiceEnded(context.Background(), "media-1"); err != nil {
		t.Fatalf("HandleVoiceEnded match error = %v", err)
	}
	if got := a.GetReadingStateSnapshot().CurrentIndex; got != 1 {
		t.Errorf("currentIndex after match: got %d, want 1", got)
	}
}
