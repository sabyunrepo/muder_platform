package progression

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/mmp-platform/server/internal/module/progression/mocks"
	"go.uber.org/mock/gomock"
)

var errTriggerTest = errors.New("trigger test error")

type blockingActionDispatcher struct {
	entered chan struct{}
	release chan struct{}
	actions []engine.PhaseActionPayload
}

func (b *blockingActionDispatcher) DispatchAction(_ context.Context, action engine.PhaseActionPayload) error {
	b.actions = append(b.actions, action)
	close(b.entered)
	<-b.release
	return nil
}

func TestEventProgressionModule_ConfiguredPasswordTriggerDispatchesMultipleResults(t *testing.T) {
	ctrl := gomock.NewController(t)
	deps := newTestDeps(t)
	sceneController := mocks.NewMockSceneController(ctrl)
	dispatcher := mocks.NewMockPhaseActionDispatcher(ctrl)
	deps.SceneController = sceneController
	deps.ActionDispatcher = dispatcher
	m := NewEventProgressionModule()

	dispatched := make([]engine.PhaseActionPayload, 0, 2)
	gomock.InOrder(
		dispatcher.EXPECT().
			DispatchAction(gomock.Any(), gomock.Any()).
			DoAndReturn(func(_ context.Context, action engine.PhaseActionPayload) error {
				dispatched = append(dispatched, action)
				return nil
			}),
		dispatcher.EXPECT().
			DispatchAction(gomock.Any(), gomock.Any()).
			DoAndReturn(func(_ context.Context, action engine.PhaseActionPayload) error {
				dispatched = append(dispatched, action)
				return nil
			}),
		sceneController.EXPECT().SkipToPhase(gomock.Any(), "middle").Return(nil),
	)

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

	if len(dispatched) != 2 {
		t.Fatalf("dispatched actions = %#v, want 2", dispatched)
	}
	if dispatched[0].Action != engine.ActionUnmuteChat {
		t.Fatalf("first action = %q, want %q", dispatched[0].Action, engine.ActionUnmuteChat)
	}
	if dispatched[1].Action != engine.ActionDeliverInformation {
		t.Fatalf("second action = %q, want %q", dispatched[1].Action, engine.ActionDeliverInformation)
	}
	if len(dispatched[1].Params) == 0 {
		t.Fatal("second action params were not preserved")
	}
}

func TestEventProgressionModule_ConfiguredPasswordTriggerRejectsWrongPassword(t *testing.T) {
	ctrl := gomock.NewController(t)
	deps := newTestDeps(t)
	deps.SceneController = mocks.NewMockSceneController(ctrl)
	deps.ActionDispatcher = mocks.NewMockPhaseActionDispatcher(ctrl)
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
}

func TestEventProgressionModule_ConfiguredTriggerRequiresSceneControllerForTarget(t *testing.T) {
	ctrl := gomock.NewController(t)
	deps := newTestDeps(t)
	deps.ActionDispatcher = mocks.NewMockPhaseActionDispatcher(ctrl)
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

	payload, _ := json.Marshal(map[string]string{"TriggerID": "unlock-safe", "Password": "0427"})
	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err == nil {
		t.Fatal("expected missing scene controller error, got nil")
	}
}

func TestEventProgressionModule_ConfiguredTriggerRollsBackAfterActionFailure(t *testing.T) {
	ctrl := gomock.NewController(t)
	deps := newTestDeps(t)
	sceneController := mocks.NewMockSceneController(ctrl)
	dispatcher := mocks.NewMockPhaseActionDispatcher(ctrl)
	deps.SceneController = sceneController
	deps.ActionDispatcher = dispatcher
	m := NewEventProgressionModule()

	successfulDispatches := 0
	gomock.InOrder(
		dispatcher.EXPECT().DispatchAction(gomock.Any(), gomock.Any()).Return(errTriggerTest),
		dispatcher.EXPECT().
			DispatchAction(gomock.Any(), gomock.Any()).
			DoAndReturn(func(_ context.Context, _ engine.PhaseActionPayload) error {
				successfulDispatches++
				return nil
			}),
		sceneController.EXPECT().SkipToPhase(gomock.Any(), "middle").Return(nil),
	)

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

	payload, _ := json.Marshal(map[string]string{"TriggerID": "unlock-safe", "Password": "0427"})
	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err == nil {
		t.Fatal("expected first action dispatch to fail, got nil")
	}
	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err != nil {
		t.Fatalf("retry HandleMessage() error = %v", err)
	}
	if successfulDispatches != 1 {
		t.Fatalf("successful dispatches after retry = %d, want 1", successfulDispatches)
	}
}

func TestEventProgressionModule_ConfiguredTriggerSkipsConcurrentReplay(t *testing.T) {
	ctrl := gomock.NewController(t)
	deps := newTestDeps(t)
	sceneController := mocks.NewMockSceneController(ctrl)
	dispatcher := &blockingActionDispatcher{
		entered: make(chan struct{}),
		release: make(chan struct{}),
	}
	deps.SceneController = sceneController
	deps.ActionDispatcher = dispatcher
	m := NewEventProgressionModule()

	sceneController.EXPECT().SkipToPhase(gomock.Any(), "middle").Return(nil).Times(1)

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

	payload, _ := json.Marshal(map[string]string{"TriggerID": "unlock-safe", "Password": "0427"})
	done := make(chan error, 1)
	go func() {
		done <- m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload)
	}()

	select {
	case <-dispatcher.entered:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for first trigger dispatch")
	}

	if err := m.HandleMessage(context.Background(), uuid.New(), "event:trigger", payload); err != nil {
		t.Fatalf("concurrent replay HandleMessage() error = %v", err)
	}
	close(dispatcher.release)

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("first HandleMessage() error = %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for first trigger completion")
	}

	if len(dispatcher.actions) != 1 {
		t.Fatalf("actions after concurrent replay = %#v, want one action", dispatcher.actions)
	}
}

func TestEventProgressionModule_ConfiguredTriggerOutsideCurrentPhaseFallsBackToLegacyGraph(t *testing.T) {
	ctrl := gomock.NewController(t)
	deps := newTestDeps(t)
	sceneController := mocks.NewMockSceneController(ctrl)
	deps.SceneController = sceneController
	m := NewEventProgressionModule()

	sceneController.EXPECT().SkipToPhase(gomock.Any(), "middle").Return(nil).Times(1)

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
