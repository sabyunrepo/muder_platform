package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"

	"github.com/google/uuid"
)

// --- integration test stubs ---

// trackingModule records all lifecycle calls for verification.
type trackingModule struct {
	mu           sync.Mutex
	name         string
	initialised  bool
	cleanedUp    bool
	messages     []string
	reactedTo    []PhaseActionPayload
	actions      []PhaseAction
	panicOnReact bool
}

func (m *trackingModule) Name() string { return m.name }

func (m *trackingModule) Init(_ context.Context, _ ModuleDeps, _ json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.initialised = true
	return nil
}

func (m *trackingModule) BuildState() (json.RawMessage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return json.Marshal(map[string]any{
		"name":        m.name,
		"initialised": m.initialised,
		"messages":    len(m.messages),
	})
}

func (m *trackingModule) HandleMessage(_ context.Context, _ uuid.UUID, msgType string, _ json.RawMessage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.messages = append(m.messages, msgType)
	return nil
}

func (m *trackingModule) Cleanup(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cleanedUp = true
	return nil
}

func (m *trackingModule) ReactTo(_ context.Context, action PhaseActionPayload) error {
	if m.panicOnReact {
		panic(fmt.Sprintf("intentional panic in %s", m.name))
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.reactedTo = append(m.reactedTo, action)
	return nil
}

func (m *trackingModule) SupportedActions() []PhaseAction {
	return m.actions
}

// TestIntegration_FullSessionLifecycle is an end-to-end test:
// session create → init → phase advance → event dispatch → module response →
// panic isolation → audit logging → cleanup.
func TestIntegration_FullSessionLifecycle(t *testing.T) {
	ctx := context.Background()
	sessionID := uuid.New()

	// Create modules.
	voting := &trackingModule{
		name:    "voting",
		actions: []PhaseAction{ActionOpenVoting, ActionCloseVoting},
	}
	chat := &trackingModule{
		name:    "text_chat",
		actions: []PhaseAction{ActionMuteChat, ActionUnmuteChat},
	}
	panicMod := &trackingModule{
		name:         "panic_mod",
		actions:      []PhaseAction{"BOOM"},
		panicOnReact: true,
	}

	modules := []Module{voting, chat, panicMod}
	audit := &recordingAuditLogger{}
	logger := &testLogger{t}
	bus := NewEventBus(logger)

	phases := []PhaseDefinition{
		{ID: "intro", Name: "Introduction"},
		{ID: "investigation", Name: "Investigation"},
		{ID: "voting", Name: "Final Vote"},
		{ID: "ending", Name: "Ending"},
	}

	pe := NewPhaseEngine(sessionID, modules, bus, audit, logger, phases)

	// --- Phase 1: Start + verify init ---

	// Track EventBus events.
	var phaseEvents []string
	bus.Subscribe("phase:entered", func(e Event) {
		info := e.Payload.(*PhaseInfo)
		phaseEvents = append(phaseEvents, "entered:"+info.ID)
	})
	bus.Subscribe("phase:exiting", func(_ Event) {
		phaseEvents = append(phaseEvents, "exiting")
	})

	configs := map[string]json.RawMessage{
		"voting":    json.RawMessage(`{"mode":"open"}`),
		"text_chat": nil,
	}
	if err := pe.Start(ctx, configs); err != nil {
		t.Fatalf("Start: %v", err)
	}

	// All modules should be initialised.
	if !voting.initialised || !chat.initialised || !panicMod.initialised {
		t.Fatal("all modules should be initialised")
	}

	// Should be on intro phase.
	if pe.CurrentPhase().ID != "intro" {
		t.Fatalf("expected intro, got %s", pe.CurrentPhase().ID)
	}

	// engine.started audit event should be logged.
	if len(audit.eventsOfType("engine.started")) != 1 {
		t.Fatal("expected engine.started audit event")
	}

	// --- Phase 2: Handle player message ---

	playerID := uuid.New()
	if err := pe.HandleMessage(ctx, playerID, "voting", "vote:cast", json.RawMessage(`{"targetCode":"A"}`)); err != nil {
		t.Fatalf("HandleMessage: %v", err)
	}
	if len(voting.messages) != 1 || voting.messages[0] != "vote:cast" {
		t.Fatalf("expected [vote:cast], got %v", voting.messages)
	}

	// --- Phase 3: Dispatch action to targeted module ---

	if err := pe.DispatchAction(ctx, PhaseActionPayload{Action: ActionOpenVoting}); err != nil {
		t.Fatalf("DispatchAction: %v", err)
	}
	if len(voting.reactedTo) != 1 {
		t.Fatal("voting should have received OPEN_VOTING")
	}

	// --- Phase 4: Panic isolation ---

	err := pe.DispatchAction(ctx, PhaseActionPayload{Action: "BOOM"})
	if err == nil {
		t.Fatal("expected error from panicking module")
	}
	panicAudits := audit.eventsOfType("module.panic")
	if len(panicAudits) != 1 {
		t.Fatalf("expected 1 module.panic audit, got %d", len(panicAudits))
	}

	// Engine should still be operational after panic.
	if err := pe.DispatchAction(ctx, PhaseActionPayload{Action: ActionMuteChat}); err != nil {
		t.Fatalf("post-panic DispatchAction: %v", err)
	}
	if len(chat.reactedTo) != 1 {
		t.Fatal("chat should have received MUTE_CHAT after panic recovery")
	}

	// --- Phase 5: Advance through phases ---

	hasNext, err := pe.AdvancePhase(ctx)
	if err != nil || !hasNext {
		t.Fatalf("advance 1: hasNext=%v err=%v", hasNext, err)
	}
	if pe.CurrentPhase().ID != "investigation" {
		t.Fatalf("expected investigation, got %s", pe.CurrentPhase().ID)
	}

	hasNext, err = pe.AdvancePhase(ctx)
	if err != nil || !hasNext {
		t.Fatalf("advance 2: hasNext=%v err=%v", hasNext, err)
	}
	if pe.CurrentPhase().ID != "voting" {
		t.Fatalf("expected voting, got %s", pe.CurrentPhase().ID)
	}

	// Verify phase.advanced audit events.
	if len(audit.eventsOfType("phase.advanced")) != 2 {
		t.Fatalf("expected 2 phase.advanced audits, got %d", len(audit.eventsOfType("phase.advanced")))
	}

	// --- Phase 6: Skip to ending (GM override) ---

	if err := pe.SkipToPhase(ctx, "ending"); err != nil {
		t.Fatalf("SkipToPhase: %v", err)
	}
	if pe.CurrentPhase().ID != "ending" {
		t.Fatalf("expected ending, got %s", pe.CurrentPhase().ID)
	}
	if len(audit.eventsOfType("phase.skipped")) != 1 {
		t.Fatal("expected phase.skipped audit event")
	}

	// --- Phase 7: Build state ---

	state, err := pe.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var parsed map[string]any
	if err := json.Unmarshal(state, &parsed); err != nil {
		t.Fatalf("unmarshal state: %v", err)
	}
	if parsed["sessionId"] == nil {
		t.Fatal("expected sessionId in state")
	}
	modulesState, ok := parsed["modules"].(map[string]any)
	if !ok {
		t.Fatal("expected modules map in state")
	}
	if len(modulesState) != 3 {
		t.Fatalf("expected 3 module states, got %d", len(modulesState))
	}

	// --- Phase 8: Stop + verify cleanup ---

	if err := pe.Stop(ctx); err != nil {
		t.Fatalf("Stop: %v", err)
	}

	if !voting.cleanedUp || !chat.cleanedUp || !panicMod.cleanedUp {
		t.Fatal("all modules should be cleaned up")
	}
	if len(audit.eventsOfType("engine.stopped")) != 1 {
		t.Fatal("expected engine.stopped audit event")
	}

	// --- Phase 9: Verify EventBus received phase events ---

	// Expected: entered:intro (from Start), exiting+entered:investigation,
	// exiting+entered:voting, entered:ending (from skip)
	expectedEvents := []string{
		"entered:intro",
		"exiting", "entered:investigation",
		"exiting", "entered:voting",
		"entered:ending",
	}
	if len(phaseEvents) != len(expectedEvents) {
		t.Fatalf("expected %d phase events, got %d: %v", len(expectedEvents), len(phaseEvents), phaseEvents)
	}
	for i, want := range expectedEvents {
		if phaseEvents[i] != want {
			t.Errorf("phase event[%d]: want %q got %q", i, want, phaseEvents[i])
		}
	}

	// --- Phase 10: Operations on stopped engine fail gracefully ---

	if err := pe.HandleMessage(ctx, playerID, "voting", "test", nil); err == nil {
		t.Fatal("expected error on stopped engine")
	}
	_, err = pe.AdvancePhase(ctx)
	if err == nil {
		t.Fatal("expected error on stopped engine")
	}
}

// TestIntegration_EmptyModules verifies engine works with zero modules.
func TestIntegration_EmptyModules(t *testing.T) {
	ctx := context.Background()
	logger := &testLogger{t}
	bus := NewEventBus(logger)
	pe := NewPhaseEngine(uuid.New(), nil, bus, nil, logger, []PhaseDefinition{
		{ID: "only", Name: "Only Phase"},
	})

	if err := pe.Start(ctx, nil); err != nil {
		t.Fatal(err)
	}

	// Advance past single phase.
	hasNext, _ := pe.AdvancePhase(ctx)
	if hasNext {
		t.Fatal("expected no more phases")
	}

	if err := pe.Stop(ctx); err != nil {
		t.Fatal(err)
	}
}
