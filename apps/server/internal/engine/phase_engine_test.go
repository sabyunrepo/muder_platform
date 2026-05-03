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
	// PR-2a: declare public state so tests satisfy the F-sec-2 boot gate
	// without having to implement BuildStateFor on every stub.
	PublicStateMarker

	name     string
	initErr  error
	cleaned  bool
	mu       sync.Mutex
	messages []string
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
	{ID: "intro", Name: "Introduction"},
	{ID: "invest", Name: "Investigation"},
	{ID: "vote", Name: "Voting"},
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

// Phase 20 PR-5: CurrentRound — monotonic counter starting at 1 on Start,
// incrementing once per successful AdvancePhase, staying put after the final
// phase exits.
func TestPhaseEngine_CurrentRound_IncrementsWithAdvance(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	ctx := context.Background()

	if got := pe.CurrentRound(); got != 0 {
		t.Fatalf("pre-Start round = %d, want 0", got)
	}

	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	if got := pe.CurrentRound(); got != 1 {
		t.Fatalf("post-Start round = %d, want 1", got)
	}

	// Advance 1 → round 2
	if _, err := pe.AdvancePhase(ctx); err != nil {
		t.Fatalf("advance 1: %v", err)
	}
	if got := pe.CurrentRound(); got != 2 {
		t.Fatalf("after advance 1, round = %d, want 2", got)
	}

	// Advance 2 → round 3
	if _, err := pe.AdvancePhase(ctx); err != nil {
		t.Fatalf("advance 2: %v", err)
	}
	if got := pe.CurrentRound(); got != 3 {
		t.Fatalf("after advance 2, round = %d, want 3", got)
	}

	// Advance past the last phase — engine completes, round sticks.
	if hasNext, _ := pe.AdvancePhase(ctx); hasNext {
		t.Fatal("expected engine complete on 3rd advance")
	}
	if got := pe.CurrentRound(); got != 3 {
		t.Fatalf("post-completion round = %d, want 3 (sticks)", got)
	}
}

type hookRecordingModule struct {
	stubCoreModule
	entered []Phase
	exited  []Phase
}

func (h *hookRecordingModule) OnPhaseEnter(_ context.Context, phase Phase) error {
	h.entered = append(h.entered, phase)
	return nil
}

func (h *hookRecordingModule) OnPhaseExit(_ context.Context, phase Phase) error {
	h.exited = append(h.exited, phase)
	return nil
}

func TestPhaseEngine_PhaseHooksAndOnEnterActions(t *testing.T) {
	reactor := &stubFullModule{
		stubCoreModule: stubCoreModule{name: "information_delivery"},
		actions:        []PhaseAction{ActionDeliverInformation},
	}
	hook := &hookRecordingModule{stubCoreModule: stubCoreModule{name: "hook"}}
	phases := []PhaseDefinition{
		{
			ID:      "intro",
			Name:    "Intro",
			OnEnter: json.RawMessage(`[{"type":"DELIVER_INFORMATION","params":{"deliveries":[{"id":"d1"}]}}]`),
		},
		{ID: "next", Name: "Next"},
	}
	pe, _ := newTestPhaseEngine(t, []Module{hook, reactor}, phases)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	if len(hook.entered) != 1 || hook.entered[0] != "intro" {
		t.Fatalf("entered hooks = %#v", hook.entered)
	}
	if len(reactor.received) != 1 || reactor.received[0].Action != ActionDeliverInformation {
		t.Fatalf("received actions = %#v", reactor.received)
	}

	if _, err := pe.AdvancePhase(ctx); err != nil {
		t.Fatalf("AdvancePhase: %v", err)
	}
	if len(hook.exited) != 1 || hook.exited[0] != "intro" {
		t.Fatalf("exited hooks = %#v", hook.exited)
	}
	if len(hook.entered) != 2 || hook.entered[1] != "next" {
		t.Fatalf("entered hooks after advance = %#v", hook.entered)
	}
}

func TestPhaseEngine_LegacyJSONLogicOnEnterIsNoop(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, []PhaseDefinition{
		{ID: "intro", Name: "Intro", OnEnter: json.RawMessage(`{"==":[1,1]}`)},
	})
	if err := pe.Start(context.Background(), nil); err != nil {
		t.Fatalf("legacy JSONLogic-ish onEnter should remain no-op, got: %v", err)
	}
	defer pe.Stop(context.Background())
}

type failingEnterHookModule struct {
	stubCoreModule
	failPhase Phase
}

func (h *failingEnterHookModule) OnPhaseEnter(_ context.Context, phase Phase) error {
	if phase == h.failPhase {
		return fmt.Errorf("enter failed for %s", phase)
	}
	return nil
}

func (h *failingEnterHookModule) OnPhaseExit(_ context.Context, _ Phase) error { return nil }

type panicHookModule struct {
	stubCoreModule
	panicOnEnter bool
	panicOnExit  bool
}

func (p *panicHookModule) OnPhaseEnter(_ context.Context, _ Phase) error {
	if p.panicOnEnter {
		panic("enter hook boom")
	}
	return nil
}

func (p *panicHookModule) OnPhaseExit(_ context.Context, _ Phase) error {
	if p.panicOnExit {
		panic("exit hook boom")
	}
	return nil
}

func TestPhaseEngine_StartRollsBackWhenInitialEnterFails(t *testing.T) {
	hook := &failingEnterHookModule{stubCoreModule: stubCoreModule{name: "hook"}, failPhase: "intro"}
	pe, audit := newTestPhaseEngine(t, []Module{hook}, testPhaseDefinitions)

	err := pe.Start(context.Background(), nil)
	if err == nil {
		t.Fatal("expected start enter failure")
	}
	if pe.started {
		t.Fatal("engine should not remain started after initial enter failure")
	}
	if phase := pe.CurrentPhase(); phase != nil {
		t.Fatalf("CurrentPhase after failed start = %#v, want nil", phase)
	}
	if got := len(audit.eventsOfType("engine.started")); got != 0 {
		t.Fatalf("engine.started audits = %d, want 0", got)
	}
}

func TestPhaseEngine_AdvanceRollsBackCurrentWhenTargetEnterFails(t *testing.T) {
	hook := &failingEnterHookModule{stubCoreModule: stubCoreModule{name: "hook"}, failPhase: "invest"}
	pe, audit := newTestPhaseEngine(t, []Module{hook}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	hasNext, err := pe.AdvancePhase(ctx)
	if err == nil || hasNext {
		t.Fatalf("AdvancePhase should fail without advancing, hasNext=%v err=%v", hasNext, err)
	}
	if got := pe.CurrentPhase().ID; got != "intro" {
		t.Fatalf("CurrentPhase after failed advance = %s, want intro", got)
	}
	if got := pe.CurrentRound(); got != 1 {
		t.Fatalf("CurrentRound after failed advance = %d, want 1", got)
	}
	if got := len(audit.eventsOfType("phase.advanced")); got != 0 {
		t.Fatalf("phase.advanced audits = %d, want 0", got)
	}
}

func TestPhaseEngine_SkipRollsBackCurrentWhenTargetEnterFails(t *testing.T) {
	hook := &failingEnterHookModule{stubCoreModule: stubCoreModule{name: "hook"}, failPhase: "vote"}
	pe, audit := newTestPhaseEngine(t, []Module{hook}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	err := pe.SkipToPhase(ctx, "vote")
	if err == nil {
		t.Fatal("expected SkipToPhase enter failure")
	}
	if got := pe.CurrentPhase().ID; got != "intro" {
		t.Fatalf("CurrentPhase after failed skip = %s, want intro", got)
	}
	if got := len(audit.eventsOfType("phase.skipped")); got != 0 {
		t.Fatalf("phase.skipped audits = %d, want 0", got)
	}
}

func TestPhaseEngine_RequiredModuleDispatchUsesPanicIsolation(t *testing.T) {
	pm := &panicModule{stubCoreModule: stubCoreModule{name: "information_delivery"}}
	pe, audit := newTestPhaseEngine(t, []Module{pm}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	err := pe.DispatchAction(ctx, PhaseActionPayload{Action: ActionDeliverInformation})
	if err == nil {
		t.Fatal("expected panic-isolated error")
	}
	if got := len(audit.eventsOfType("module.panic")); got != 1 {
		t.Fatalf("module.panic audits = %d", got)
	}
}

func TestPhaseEngine_PhaseHookPanicIsolation(t *testing.T) {
	pm := &panicHookModule{stubCoreModule: stubCoreModule{name: "hook_panic"}, panicOnEnter: true}
	pe, audit := newTestPhaseEngine(t, []Module{pm}, testPhaseDefinitions)
	err := pe.Start(context.Background(), nil)
	if err == nil {
		t.Fatal("expected hook panic to become error")
	}
	if got := len(audit.eventsOfType("module.panic")); got != 1 {
		t.Fatalf("module.panic audits = %d", got)
	}
}

func TestPhaseEngine_SkipToPhaseRunsExitHooks(t *testing.T) {
	hook := &hookRecordingModule{stubCoreModule: stubCoreModule{name: "hook"}}
	pe, _ := newTestPhaseEngine(t, []Module{hook}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}
	defer pe.Stop(ctx)

	if err := pe.SkipToPhase(ctx, "vote"); err != nil {
		t.Fatal(err)
	}
	if len(hook.exited) != 1 || hook.exited[0] != "intro" {
		t.Fatalf("skip should exit old phase, exited=%#v", hook.exited)
	}
	if len(hook.entered) != 2 || hook.entered[1] != "vote" {
		t.Fatalf("skip should enter target phase, entered=%#v", hook.entered)
	}
}
