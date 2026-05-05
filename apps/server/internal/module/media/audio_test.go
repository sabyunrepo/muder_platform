package media

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/engine"
)

type testLogger struct{}

func (testLogger) Printf(format string, v ...any) {}

func newTestDeps(t *testing.T) (engine.ModuleDeps, *engine.EventBus) {
	t.Helper()
	log := testLogger{}
	bus := engine.NewEventBus(log)
	deps := engine.ModuleDeps{
		SessionID: uuid.New(),
		EventBus:  bus,
		Logger:    log,
	}
	return deps, bus
}

func TestAudioModule_SupportedActions(t *testing.T) {
	m := NewAudioModule()
	actions := m.SupportedActions()
	want := map[engine.PhaseAction]bool{
		engine.ActionPlaySound: true,
		engine.ActionPlayMedia: true,
		engine.ActionSetBGM:    true,
		engine.ActionStopAudio: true,
	}
	if len(actions) != len(want) {
		t.Fatalf("SupportedActions length = %d, want %d", len(actions), len(want))
	}
	for _, a := range actions {
		if !want[a] {
			t.Errorf("unexpected action %q", a)
		}
	}
}

func TestAudioModule_ReactTo_SetBGM(t *testing.T) {
	deps, bus := newTestDeps(t)
	m := NewAudioModule()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	defer func() { _ = m.Cleanup(context.Background()) }()

	received := make(chan engine.Event, 1)
	bus.Subscribe("audio.set_bgm", func(e engine.Event) {
		received <- e
	})

	params, _ := json.Marshal(map[string]any{"mediaId": "bgm-123", "fadeMs": 2000})
	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionSetBGM,
		Params: params,
	})
	if err != nil {
		t.Fatalf("ReactTo: %v", err)
	}

	select {
	case <-received:
		// ok
	default:
		t.Fatal("expected audio.set_bgm event to be published")
	}

	// State should be updated.
	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var parsed struct {
		CurrentBGMId string `json:"currentBGMId"`
		PhaseBGMId   string `json:"phaseBGMId"`
	}
	if err := json.Unmarshal(state, &parsed); err != nil {
		t.Fatalf("Unmarshal state: %v", err)
	}
	if parsed.CurrentBGMId != "bgm-123" {
		t.Errorf("currentBGMId = %q, want bgm-123", parsed.CurrentBGMId)
	}
	if parsed.PhaseBGMId != "bgm-123" {
		t.Errorf("phaseBGMId = %q, want bgm-123", parsed.PhaseBGMId)
	}
}

func TestAudioModule_ReactTo_PlaySoundAndMedia(t *testing.T) {
	deps, bus := newTestDeps(t)
	m := NewAudioModule()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	defer func() { _ = m.Cleanup(context.Background()) }()

	soundReceived := make(chan engine.Event, 1)
	mediaReceived := make(chan engine.Event, 1)
	bus.Subscribe("audio.play_sound", func(e engine.Event) {
		soundReceived <- e
	})
	bus.Subscribe("audio.play_media", func(e engine.Event) {
		mediaReceived <- e
	})

	params, _ := json.Marshal(map[string]any{"mediaId": "sfx-1"})
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionPlaySound,
		Params: params,
	}); err != nil {
		t.Fatalf("ReactTo play sound: %v", err)
	}
	params, _ = json.Marshal(map[string]any{"mediaId": "movie-1", "mode": "cutscene"})
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionPlayMedia,
		Params: params,
	}); err != nil {
		t.Fatalf("ReactTo play media: %v", err)
	}

	select {
	case e := <-soundReceived:
		payload, _ := e.Payload.(json.RawMessage)
		if string(payload) != `{"mediaId":"sfx-1"}` {
			t.Fatalf("sound payload = %s", payload)
		}
	default:
		t.Fatal("expected audio.play_sound event to be published")
	}
	select {
	case e := <-mediaReceived:
		payload, _ := e.Payload.(json.RawMessage)
		if string(payload) != `{"mediaId":"movie-1","mode":"cutscene"}` {
			t.Fatalf("media payload = %s", payload)
		}
	default:
		t.Fatal("expected audio.play_media event to be published")
	}
}

func TestAudioModule_ReactTo_UnsupportedAction(t *testing.T) {
	deps, _ := newTestDeps(t)
	m := NewAudioModule()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	defer func() { _ = m.Cleanup(context.Background()) }()

	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionOpenVoting,
	})
	if err == nil {
		t.Error("expected error for unsupported action, got nil")
	}
}

func TestAudioModule_ReadingLineChanged_PublishesPlayVoice(t *testing.T) {
	deps, bus := newTestDeps(t)
	m := NewAudioModule()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	defer func() { _ = m.Cleanup(context.Background()) }()

	received := make(chan engine.Event, 1)
	bus.Subscribe("audio.play_voice", func(e engine.Event) {
		received <- e
	})

	// Simulate ReadingModule emitting line_changed with voiceId.
	bus.Publish(engine.Event{
		Type: "reading.line_changed",
		Payload: map[string]any{
			"lineIndex":  0,
			"totalLines": 5,
			"voiceId":    "voice-abc",
		},
	})

	select {
	case e := <-received:
		payload, _ := e.Payload.(map[string]any)
		if payload["voiceId"] != "voice-abc" {
			t.Errorf("voiceId = %v, want voice-abc", payload["voiceId"])
		}
	default:
		t.Fatal("expected audio.play_voice event to be published")
	}
}
