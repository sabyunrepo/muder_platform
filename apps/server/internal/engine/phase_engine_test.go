package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"

	"github.com/google/uuid"
)

// --- test helpers ---

// testLogger implements the Printf interface for testing.
type testLogger struct{ t *testing.T }

func (l *testLogger) Printf(format string, v ...any) {
	l.t.Helper()
	l.t.Logf(format, v...)
}

type stubCoreModule struct {
	name      string
	initErr   error
	cleaned   bool
	mu        sync.Mutex
	messages  []string
}

func (s *stubCoreModule) Name() string { return s.name }
func (s *stubCoreModule) Init(_ context.Context, _ ModuleDeps, _ json.RawMessage) error {
	return s.initErr
}
func (s *stubCoreModule) BuildState() (json.RawMessage, error) {
	return json.Marshal(map[string]string{"name": s.name})
}
func (s *stubCoreModule) HandleMessage(_ context.Context, _ uuid.UUID, msgType string, _ json.RawMessage) error {
	s.mu.Lock()
	s.messages = append(s.messages, msgType)
	s.mu.Unlock()
	return nil
}
func (s *stubCoreModule) Cleanup(_ context.Context) error {
	s.cleaned = true
	return nil
}

type stubFullModule struct {
	stubCoreModule
	actions  []PhaseAction
	received []PhaseActionPayload
}

func (s *stubFullModule) ReactTo(_ context.Context, action PhaseActionPayload) error {
	s.received = append(s.received, action)
	return nil
}

func (s *stubFullModule) SupportedActions() []PhaseAction {
	return s.actions
}

type panicModule struct {
	stubCoreModule
}

func (p *panicModule) ReactTo(_ context.Context, _ PhaseActionPayload) error {
	panic("intentional test panic")
}

func (p *panicModule) SupportedActions() []PhaseAction {
	return []PhaseAction{"TEST_ACTION"}
}

type recordingAuditLogger struct {
	mu     sync.Mutex
	events []auditEntry
}

type auditEntry struct {
	SessionID uuid.UUID
	EventType string
	Payload   json.RawMessage
}

func (r *recordingAuditLogger) Log(_ context.Context, sessionID uuid.UUID, eventType string, payload json.RawMessage) {
	r.mu.Lock()
	r.events = append(r.events, auditEntry{SessionID: sessionID, EventType: eventType, Payload: payload})
	r.mu.Unlock()
}

func (r *recordingAuditLogger) eventsOfType(t string) []auditEntry {
	r.mu.Lock()
	defer r.mu.Unlock()
	var result []auditEntry
	for _, e := range r.events {
		if e.EventType == t {
			result = append(result, e)
		}
	}
	return result
}

var testPhaseDefinitions = []PhaseDefinition{
	{ID: "intro", Name: "Introduction", Type: "discussion", Duration: 60},
	{ID: "invest", Name: "Investigation", Type: "investigation", Duration: 120},
	{ID: "vote", Name: "Voting", Type: "voting", Duration: 30},
}

func newTestPhaseEngine(t *testing.T, modules []Module, phases []PhaseDefinition) (*PhaseEngine, *recordingAuditLogger) {
	t.Helper()
	logger := &testLogger{t}
	audit := &recordingAuditLogger{}
	bus := NewEventBus(logger)
	pe := NewPhaseEngine(uuid.New(), modules, bus, audit, logger, phases)
	return pe, audit
}

// --- tests ---

func TestPhaseEngine_StartAndCurrentPhase(t *testing.T) {
	mod := &stubCoreModule{name: "test_mod"}
	pe, audit := newTestPhaseEngine(t, []Module{mod}, testPhaseDefinitions)

	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	phase := pe.CurrentPhase()
	if phase == nil {
		t.Fatal("expected non-nil phase")
	}
	if phase.ID != "intro" {
		t.Fatalf("expected intro, got %s", phase.ID)
	}
	if phase.Index != 0 {
		t.Fatalf("expected index 0, got %d", phase.Index)
	}

	// Verify audit event logged.
	started := audit.eventsOfType("engine.started")
	if len(started) != 1 {
		t.Fatalf("expected 1 engine.started audit, got %d", len(started))
	}
}

func TestPhaseEngine_DoubleStartError(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	if err := pe.Start(ctx, nil); err == nil {
		t.Fatal("expected error on double start")
	}
}

func TestPhaseEngine_NoPhasesError(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, nil)
	if err := pe.Start(context.Background(), nil); err == nil {
		t.Fatal("expected error for no phases")
	}
}

func TestPhaseEngine_ModuleInitError(t *testing.T) {
	mod := &stubCoreModule{name: "bad_mod", initErr: fmt.Errorf("init failed")}
	pe, _ := newTestPhaseEngine(t, []Module{mod}, testPhaseDefinitions)

	if err := pe.Start(context.Background(), nil); err == nil {
		t.Fatal("expected init error")
	}
}

func TestPhaseEngine_AdvancePhase(t *testing.T) {
	pe, audit := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	// Advance intro → invest.
	hasNext, err := pe.AdvancePhase(ctx)
	if err != nil || !hasNext {
		t.Fatalf("advance 1: hasNext=%v err=%v", hasNext, err)
	}
	if pe.CurrentPhase().ID != "invest" {
		t.Fatalf("expected invest, got %s", pe.CurrentPhase().ID)
	}

	// Advance invest → vote.
	hasNext, err = pe.AdvancePhase(ctx)
	if err != nil || !hasNext {
		t.Fatalf("advance 2: hasNext=%v err=%v", hasNext, err)
	}
	if pe.CurrentPhase().ID != "vote" {
		t.Fatalf("expected vote, got %s", pe.CurrentPhase().ID)
	}

	// Advance past last phase.
	hasNext, _ = pe.AdvancePhase(ctx)
	if hasNext {
		t.Fatal("expected no more phases")
	}

	// Verify audit events.
	advanced := audit.eventsOfType("phase.advanced")
	if len(advanced) != 2 {
		t.Fatalf("expected 2 phase.advanced audits, got %d", len(advanced))
	}
	completed := audit.eventsOfType("engine.completed")
	if len(completed) != 1 {
		t.Fatalf("expected 1 engine.completed audit, got %d", len(completed))
	}
}

func TestPhaseEngine_SkipToPhase(t *testing.T) {
	pe, audit := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	if err := pe.SkipToPhase(ctx, "vote"); err != nil {
		t.Fatal(err)
	}
	if pe.CurrentPhase().ID != "vote" {
		t.Fatalf("expected vote, got %s", pe.CurrentPhase().ID)
	}

	skipped := audit.eventsOfType("phase.skipped")
	if len(skipped) != 1 {
		t.Fatalf("expected 1 phase.skipped audit, got %d", len(skipped))
	}
}

func TestPhaseEngine_SkipToNotFound(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	if err := pe.SkipToPhase(ctx, "nonexistent"); err == nil {
		t.Fatal("expected error for nonexistent phase")
	}
}

func TestPhaseEngine_HandleMessage(t *testing.T) {
	mod := &stubCoreModule{name: "test_mod"}
	pe, _ := newTestPhaseEngine(t, []Module{mod}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	if err := pe.HandleMessage(ctx, uuid.New(), "test_mod", "hello", nil); err != nil {
		t.Fatal(err)
	}
	if len(mod.messages) != 1 || mod.messages[0] != "hello" {
		t.Fatalf("expected [hello], got %v", mod.messages)
	}
}

func TestPhaseEngine_HandleMessageUnknownModule(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	err := pe.HandleMessage(ctx, uuid.New(), "nonexistent", "test", nil)
	if err == nil {
		t.Fatal("expected error for unknown module")
	}
}

func TestPhaseEngine_DispatchAction(t *testing.T) {
	reactor := &stubFullModule{
		stubCoreModule: stubCoreModule{name: "voting"},
		actions:        []PhaseAction{ActionOpenVoting, ActionCloseVoting},
	}
	pe, _ := newTestPhaseEngine(t, []Module{reactor}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	err := pe.DispatchAction(ctx, PhaseActionPayload{Action: ActionOpenVoting})
	if err != nil {
		t.Fatal(err)
	}
	if len(reactor.received) != 1 || reactor.received[0].Action != ActionOpenVoting {
		t.Fatalf("expected OPEN_VOTING, got %v", reactor.received)
	}
}

func TestPhaseEngine_DispatchActionTargeted(t *testing.T) {
	reactor := &stubFullModule{
		stubCoreModule: stubCoreModule{name: "text_chat"},
		actions:        []PhaseAction{ActionLockModule},
	}
	pe, _ := newTestPhaseEngine(t, []Module{reactor}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	err := pe.DispatchAction(ctx, PhaseActionPayload{
		Action: ActionLockModule,
		Target: "text_chat",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(reactor.received) != 1 {
		t.Fatal("expected 1 action dispatched")
	}
}

func TestPhaseEngine_PanicIsolation(t *testing.T) {
	pm := &panicModule{stubCoreModule: stubCoreModule{name: "panic_mod"}}
	pe, audit := newTestPhaseEngine(t, []Module{pm}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	// DispatchAction with a panicking module should not crash, should log audit.
	err := pe.DispatchAction(ctx, PhaseActionPayload{Action: "TEST_ACTION"})
	if err == nil {
		t.Fatal("expected error from panicking module")
	}

	panicAudits := audit.eventsOfType("module.panic")
	if len(panicAudits) != 1 {
		t.Fatalf("expected 1 module.panic audit, got %d", len(panicAudits))
	}
}

func TestPhaseEngine_PanicIsolationContinues(t *testing.T) {
	// Verify that after one module panics, the engine still works.
	pm := &panicModule{stubCoreModule: stubCoreModule{name: "panic_mod"}}
	good := &stubFullModule{
		stubCoreModule: stubCoreModule{name: "good_mod"},
		actions:        []PhaseAction{ActionBroadcastMessage},
	}
	pe, _ := newTestPhaseEngine(t, []Module{pm, good}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	// Trigger panic module (via broadcast — TEST_ACTION not targeted).
	_ = pe.DispatchAction(ctx, PhaseActionPayload{Action: "TEST_ACTION"})

	// Engine should still work for good module.
	err := pe.DispatchAction(ctx, PhaseActionPayload{Action: ActionBroadcastMessage})
	if err != nil {
		t.Fatalf("expected good module to work after panic: %v", err)
	}
	if len(good.received) != 1 {
		t.Fatal("good module should have received action")
	}
}

func TestPhaseEngine_BuildState(t *testing.T) {
	mod := &stubCoreModule{name: "test_mod"}
	pe, _ := newTestPhaseEngine(t, []Module{mod}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	state, err := pe.BuildState()
	if err != nil {
		t.Fatal(err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(state, &parsed); err != nil {
		t.Fatal(err)
	}
	if parsed["sessionId"] == nil {
		t.Fatal("expected sessionId in state")
	}
	if parsed["modules"] == nil {
		t.Fatal("expected modules in state")
	}
}

func TestPhaseEngine_StopCleansModules(t *testing.T) {
	mod := &stubCoreModule{name: "test_mod"}
	pe, audit := newTestPhaseEngine(t, []Module{mod}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}

	if err := pe.Stop(ctx); err != nil {
		t.Fatal(err)
	}
	if !mod.cleaned {
		t.Fatal("module should be cleaned up")
	}

	stopped := audit.eventsOfType("engine.stopped")
	if len(stopped) != 1 {
		t.Fatalf("expected 1 engine.stopped audit, got %d", len(stopped))
	}
}

func TestPhaseEngine_StopIdempotent(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	// Stop without start should not error.
	if err := pe.Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestPhaseEngine_EventBusReceivesPhaseEntered(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	ctx := context.Background()

	var received bool
	pe.EventBus().Subscribe("phase:entered", func(e Event) {
		received = true
		info := e.Payload.(*PhaseInfo)
		if info.ID != "intro" {
			t.Errorf("expected intro, got %s", info.ID)
		}
	})

	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	if !received {
		t.Fatal("expected phase:entered event on start")
	}
}

func TestPhaseEngine_EventBusPhaseAdvance(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	var exitReceived, enterReceived bool
	pe.EventBus().Subscribe("phase:exiting", func(_ Event) {
		exitReceived = true
	})
	pe.EventBus().Subscribe("phase:entered", func(e Event) {
		info := e.Payload.(*PhaseInfo)
		if info.ID == "invest" {
			enterReceived = true
		}
	})

	pe.AdvancePhase(ctx)

	if !exitReceived {
		t.Fatal("expected phase:exiting event")
	}
	if !enterReceived {
		t.Fatal("expected phase:entered event for invest")
	}
}

func TestPhaseEngine_NilAuditLogger(t *testing.T) {
	// Passing nil audit logger should not panic — uses noopAuditLogger.
	logger := &testLogger{t}
	bus := NewEventBus(logger)
	pe := NewPhaseEngine(uuid.New(), nil, bus, nil, logger, testPhaseDefinitions)

	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	pe.Stop(ctx)
}

func TestPhaseEngine_ModuleConfigPassedToInit(t *testing.T) {
	var receivedConfig json.RawMessage
	mod := &configCapture{stubCoreModule: stubCoreModule{name: "cfg_mod"}, onInit: func(cfg json.RawMessage) {
		receivedConfig = cfg
	}}
	pe, _ := newTestPhaseEngine(t, []Module{mod}, testPhaseDefinitions)

	configs := map[string]json.RawMessage{
		"cfg_mod": json.RawMessage(`{"key":"value"}`),
	}
	if err := pe.Start(context.Background(), configs); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(context.Background())

	if string(receivedConfig) != `{"key":"value"}` {
		t.Fatalf("expected config passed through, got %s", receivedConfig)
	}
}

// configCapture is a stub that captures the config passed to Init.
type configCapture struct {
	stubCoreModule
	onInit func(json.RawMessage)
}

func (c *configCapture) Init(ctx context.Context, deps ModuleDeps, config json.RawMessage) error {
	if c.onInit != nil {
		c.onInit(config)
	}
	return c.stubCoreModule.Init(ctx, deps, config)
}
