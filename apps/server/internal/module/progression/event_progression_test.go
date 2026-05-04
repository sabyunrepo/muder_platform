package progression

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

type recordingSceneController struct {
	targets []string
}

func (r *recordingSceneController) SkipToPhase(_ context.Context, phaseID string) error {
	r.targets = append(r.targets, phaseID)
	return nil
}

type recordingActionDispatcher struct {
	actions []engine.PhaseActionPayload
}

func (r *recordingActionDispatcher) DispatchAction(_ context.Context, action engine.PhaseActionPayload) error {
	r.actions = append(r.actions, action)
	return nil
}

type triggerRuntimeTestReactor struct {
	engine.PublicStateMarker

	actions []engine.PhaseActionPayload
}

func (r *triggerRuntimeTestReactor) Name() string { return "trigger_runtime_test" }

func (r *triggerRuntimeTestReactor) Init(context.Context, engine.ModuleDeps, json.RawMessage) error {
	return nil
}

func (r *triggerRuntimeTestReactor) BuildState() (json.RawMessage, error) {
	return json.RawMessage(`{}`), nil
}

func (r *triggerRuntimeTestReactor) HandleMessage(context.Context, uuid.UUID, string, json.RawMessage) error {
	return nil
}

func (r *triggerRuntimeTestReactor) Cleanup(context.Context) error {
	return nil
}

func (r *triggerRuntimeTestReactor) ReactTo(_ context.Context, action engine.PhaseActionPayload) error {
	r.actions = append(r.actions, action)
	return nil
}

func (r *triggerRuntimeTestReactor) SupportedActions() []engine.PhaseAction {
	return []engine.PhaseAction{"TEST_ACTION"}
}

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
			wantEvent: "event.scene_transition_requested",
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

	// A -> B should succeed as a transition request. The module state is not
	// final until PhaseEngine enters B and calls the hook.
	payload, _ := json.Marshal(map[string]string{"TriggerID": "B"})
	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err != nil {
		t.Fatalf("A->B transition error = %v", err)
	}
	if err := m.OnPhaseEnter(context.Background(), "B"); err != nil {
		t.Fatalf("OnPhaseEnter(B) error = %v", err)
	}

	// B -> A should fail (backtrack)
	payload, _ = json.Marshal(map[string]string{"TriggerID": "A"})
	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err == nil {
		t.Error("expected error for backtrack B->A, got nil")
	}
}

func TestEventProgressionModule_TriggerRequestsDoNotMutateCurrentPhase(t *testing.T) {
	deps := newTestDeps(t)
	m := NewEventProgressionModule()

	cfg := json.RawMessage(`{"InitialPhase":"start","AllowBacktrack":false,"Graph":{"start":["middle"]}}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	payload, _ := json.Marshal(map[string]string{"TriggerID": "middle"})
	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err != nil {
		t.Fatalf("HandleMessage() error = %v", err)
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
		t.Fatalf("currentPhase after request = %v, want start", state["currentPhase"])
	}

	if err := m.OnPhaseEnter(context.Background(), "middle"); err != nil {
		t.Fatalf("OnPhaseEnter() error = %v", err)
	}
	raw, err = m.BuildState()
	if err != nil {
		t.Fatalf("BuildState() after enter error = %v", err)
	}
	if err := json.Unmarshal(raw, &state); err != nil {
		t.Fatalf("unmarshal after enter error = %v", err)
	}
	if state["currentPhase"] != "middle" {
		t.Fatalf("currentPhase after engine enter = %v, want middle", state["currentPhase"])
	}
}

func TestEventProgressionModule_ConfiguredPasswordTriggerDispatchesMultipleResults(t *testing.T) {
	deps := newTestDeps(t)
	sceneController := &recordingSceneController{}
	dispatcher := &recordingActionDispatcher{}
	deps.SceneController = sceneController
	deps.ActionDispatcher = dispatcher
	m := NewEventProgressionModule()

	cfg := json.RawMessage(`{
		"InitialPhase":"start",
		"AllowBacktrack":false,
		"Triggers":[{
			"id":"unlock-safe",
			"from":"start",
			"to":"middle",
			"password":"0427",
			"actions":[
				{"type":"enable_chat"},
				{"type":"DELIVER_INFORMATION","params":{"deliveries":[{"id":"d1"}]}}
			]
		}]
	}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	payload, _ := json.Marshal(map[string]string{"TriggerID": "unlock-safe", "Password": "0427"})
	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err != nil {
		t.Fatalf("HandleMessage() error = %v", err)
	}

	if len(dispatcher.actions) != 2 {
		t.Fatalf("dispatched actions = %#v, want 2", dispatcher.actions)
	}
	if dispatcher.actions[0].Action != engine.ActionUnmuteChat {
		t.Fatalf("first action = %q, want %q", dispatcher.actions[0].Action, engine.ActionUnmuteChat)
	}
	if dispatcher.actions[1].Action != engine.ActionDeliverInformation {
		t.Fatalf("second action = %q, want %q", dispatcher.actions[1].Action, engine.ActionDeliverInformation)
	}
	if len(dispatcher.actions[1].Params) == 0 {
		t.Fatal("second action params were not preserved")
	}
	if len(sceneController.targets) != 1 || sceneController.targets[0] != "middle" {
		t.Fatalf("scene targets = %#v, want [middle]", sceneController.targets)
	}
}

func TestEventProgressionModule_ConfiguredPasswordTriggerRejectsWrongPassword(t *testing.T) {
	deps := newTestDeps(t)
	sceneController := &recordingSceneController{}
	dispatcher := &recordingActionDispatcher{}
	deps.SceneController = sceneController
	deps.ActionDispatcher = dispatcher
	m := NewEventProgressionModule()

	cfg := json.RawMessage(`{
		"InitialPhase":"start",
		"Triggers":[{
			"id":"unlock-safe",
			"from":"start",
			"to":"middle",
			"password":"0427",
			"actions":[{"type":"OPEN_VOTING"}]
		}]
	}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	payload, _ := json.Marshal(map[string]string{"TriggerID": "unlock-safe", "Password": "0000"})
	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err == nil {
		t.Fatal("expected password mismatch error, got nil")
	}
	if len(dispatcher.actions) != 0 {
		t.Fatalf("actions dispatched on password mismatch: %#v", dispatcher.actions)
	}
	if len(sceneController.targets) != 0 {
		t.Fatalf("scene moved on password mismatch: %#v", sceneController.targets)
	}
}

func TestEventProgressionModule_ConfiguredTriggerOutsideCurrentPhaseFallsBackToLegacyGraph(t *testing.T) {
	deps := newTestDeps(t)
	sceneController := &recordingSceneController{}
	deps.SceneController = sceneController
	m := NewEventProgressionModule()

	cfg := json.RawMessage(`{
		"InitialPhase":"start",
		"AllowBacktrack":false,
		"Graph":{"start":["middle"]},
		"Triggers":[{
			"id":"middle",
			"from":"other",
			"to":"secret",
			"password":"0427"
		}]
	}`)
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init() error = %v", err)
	}

	payload, _ := json.Marshal(map[string]string{"TriggerID": "middle"})
	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err != nil {
		t.Fatalf("HandleMessage() error = %v", err)
	}

	if len(sceneController.targets) != 1 || sceneController.targets[0] != "middle" {
		t.Fatalf("scene targets = %#v, want [middle]", sceneController.targets)
	}
}

func TestEventProgressionModule_InitRejectsUnsupportedTriggerActions(t *testing.T) {
	m := NewEventProgressionModule()
	cfg := json.RawMessage(`{
		"InitialPhase":"start",
		"Triggers":[{
			"id":"bad-action",
			"from":"start",
			"actions":{"foo":"bar"}
		}]
	}`)

	if err := m.Init(context.Background(), newTestDeps(t), cfg); err == nil {
		t.Fatal("expected unsupported action config error, got nil")
	}
}

func TestEventProgressionModule_RuntimeTriggerUsesPhaseEngineAsController(t *testing.T) {
	progress := NewEventProgressionModule()
	reactor := &triggerRuntimeTestReactor{}
	bus := engine.NewEventBus(&testLogger{t})
	pe := engine.NewPhaseEngine(uuid.New(), []engine.Module{progress, reactor}, bus, nil, &testLogger{t}, []engine.PhaseDefinition{
		{ID: "start", Name: "Start"},
		{ID: "middle", Name: "Middle"},
	})
	cfg := json.RawMessage(`{
		"InitialPhase":"start",
		"Triggers":[{
			"id":"unlock-safe",
			"from":"start",
			"to":"middle",
			"password":"0427",
			"actions":[{"type":"TEST_ACTION"}]
		}]
	}`)
	if err := pe.Start(context.Background(), map[string]json.RawMessage{"event_progression": cfg}); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	t.Cleanup(func() { _ = pe.Stop(context.Background()) })

	payload, _ := json.Marshal(map[string]string{"TriggerID": "unlock-safe", "Password": "0427"})
	if err := pe.HandleMessage(context.Background(), uuid.New(), "event_progression", "event:trigger", payload); err != nil {
		t.Fatalf("HandleMessage() error = %v", err)
	}

	if pe.CurrentPhase().ID != "middle" {
		t.Fatalf("current phase = %q, want middle", pe.CurrentPhase().ID)
	}
	if len(reactor.actions) != 1 || reactor.actions[0].Action != "TEST_ACTION" {
		t.Fatalf("reactor actions = %#v, want TEST_ACTION", reactor.actions)
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
