package media

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

type fakeMediaResolver struct {
	url        string
	sourceType string
	err        error
	calledType string
}

func (f *fakeMediaResolver) ResolveMediaURL(_ context.Context, _ uuid.UUID, _ uuid.UUID, allowedTypes ...string) (string, string, error) {
	if len(allowedTypes) > 0 {
		f.calledType = allowedTypes[0]
	}
	return f.url, f.sourceType, f.err
}

func TestPresentationModule_ReactTo_SetBackground(t *testing.T) {
	deps, bus := newTestDeps(t)
	mediaID := uuid.New()
	resolver := &fakeMediaResolver{url: "https://cdn.example/background.png", sourceType: "FILE"}
	deps.MediaResolver = resolver
	m := NewPresentationModule()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init: %v", err)
	}

	received := make(chan engine.Event, 1)
	bus.Subscribe("presentation.set_background", func(e engine.Event) {
		received <- e
	})

	params, _ := json.Marshal(map[string]any{"mediaId": mediaID.String()})
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionSetBackground,
		Params: params,
	}); err != nil {
		t.Fatalf("ReactTo: %v", err)
	}

	select {
	case e := <-received:
		payload, _ := e.Payload.(json.RawMessage)
		var parsedPayload struct {
			MediaID    string `json:"mediaId"`
			SourceType string `json:"sourceType"`
			URL        string `json:"url"`
		}
		if err := json.Unmarshal(payload, &parsedPayload); err != nil {
			t.Fatalf("Unmarshal payload: %v", err)
		}
		if parsedPayload.MediaID != mediaID.String() || parsedPayload.URL == "" || parsedPayload.SourceType != "FILE" {
			t.Fatalf("payload = %#v", parsedPayload)
		}
	default:
		t.Fatal("expected presentation.set_background event")
	}
	if resolver.calledType != "IMAGE" {
		t.Fatalf("allowed type = %q, want IMAGE", resolver.calledType)
	}

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var parsed struct {
		BackgroundMediaID string `json:"backgroundMediaId"`
		BackgroundURL     string `json:"backgroundMediaUrl"`
		BackgroundSource  string `json:"backgroundSourceType"`
	}
	if err := json.Unmarshal(state, &parsed); err != nil {
		t.Fatalf("Unmarshal state: %v", err)
	}
	if parsed.BackgroundMediaID != mediaID.String() {
		t.Fatalf("backgroundMediaId = %q, want %s", parsed.BackgroundMediaID, mediaID.String())
	}
	if parsed.BackgroundURL != "https://cdn.example/background.png" || parsed.BackgroundSource != "FILE" {
		t.Fatalf("background snapshot = %#v", parsed)
	}
}

func TestPresentationModule_ReactTo_SetBackgroundRequiresResolverAndMediaID(t *testing.T) {
	deps, _ := newTestDeps(t)
	m := NewPresentationModule()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init: %v", err)
	}

	params, _ := json.Marshal(map[string]any{"mediaId": uuid.NewString()})
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionSetBackground,
		Params: params,
	}); err == nil {
		t.Fatal("expected missing resolver error")
	}

	deps.MediaResolver = &fakeMediaResolver{url: "https://cdn.example/background.png", sourceType: "FILE"}
	m = NewPresentationModule()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init with resolver: %v", err)
	}
	params, _ = json.Marshal(map[string]any{"mediaId": ""})
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionSetBackground,
		Params: params,
	}); err == nil {
		t.Fatal("expected missing mediaId error")
	}
}

func TestPresentationModule_ReactTo_SetBackgroundDoesNotCommitOnResolveFailure(t *testing.T) {
	deps, _ := newTestDeps(t)
	deps.MediaResolver = &fakeMediaResolver{err: errors.New("missing media")}
	m := NewPresentationModule()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init: %v", err)
	}

	params, _ := json.Marshal(map[string]any{"mediaId": uuid.NewString()})
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionSetBackground,
		Params: params,
	}); err == nil {
		t.Fatal("expected resolve error")
	}

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var parsed struct {
		BackgroundMediaID string `json:"backgroundMediaId"`
	}
	if err := json.Unmarshal(state, &parsed); err != nil {
		t.Fatalf("Unmarshal state: %v", err)
	}
	if parsed.BackgroundMediaID != "" {
		t.Fatalf("backgroundMediaId = %q, want empty after failed resolve", parsed.BackgroundMediaID)
	}
}

func TestPresentationModule_ReactTo_SetThemeColor(t *testing.T) {
	deps, bus := newTestDeps(t)
	m := NewPresentationModule()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init: %v", err)
	}

	received := make(chan engine.Event, 1)
	bus.Subscribe("presentation.set_theme_color", func(e engine.Event) {
		received <- e
	})

	params, _ := json.Marshal(map[string]any{"themeToken": "tension"})
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionSetThemeColor,
		Params: params,
	}); err != nil {
		t.Fatalf("ReactTo: %v", err)
	}

	select {
	case e := <-received:
		payload, _ := e.Payload.(json.RawMessage)
		var parsedPayload struct {
			ThemeToken string `json:"themeToken"`
		}
		if err := json.Unmarshal(payload, &parsedPayload); err != nil {
			t.Fatalf("Unmarshal payload: %v", err)
		}
		if parsedPayload.ThemeToken != "tension" {
			t.Fatalf("payload themeToken = %q, want tension", parsedPayload.ThemeToken)
		}
	default:
		t.Fatal("expected presentation.set_theme_color event")
	}

	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var parsed struct {
		ThemeToken string `json:"themeToken"`
	}
	if err := json.Unmarshal(state, &parsed); err != nil {
		t.Fatalf("Unmarshal state: %v", err)
	}
	if parsed.ThemeToken != "tension" {
		t.Fatalf("themeToken = %q, want tension", parsed.ThemeToken)
	}
}

func TestPresentationModule_ReactTo_SetThemeColorRequiresToken(t *testing.T) {
	deps, _ := newTestDeps(t)
	m := NewPresentationModule()
	if err := m.Init(context.Background(), deps, nil); err != nil {
		t.Fatalf("Init: %v", err)
	}

	params, _ := json.Marshal(map[string]any{"themeToken": ""})
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionSetThemeColor,
		Params: params,
	}); err == nil {
		t.Fatal("expected missing themeToken error")
	}
}
