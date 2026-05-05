package engine

import (
	"context"
	"encoding/json"
	"testing"
)

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
			OnExit:  json.RawMessage(`[{"type":"DELIVER_INFORMATION","params":{"deliveries":[{"id":"d2"}]}}]`),
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
	if ids := phaseActionDeliveryIDs(t, reactor.received[0]); len(ids) != 1 || ids[0] != "d1" {
		t.Fatalf("OnEnter delivery IDs = %#v", ids)
	}

	if _, err := pe.AdvancePhase(ctx); err != nil {
		t.Fatalf("AdvancePhase: %v", err)
	}
	if len(reactor.received) != 2 || reactor.received[0].Action != ActionDeliverInformation || reactor.received[1].Action != ActionDeliverInformation {
		t.Fatalf("expected OnEnter + OnExit actions, got %#v", reactor.received)
	}
	if ids := phaseActionDeliveryIDs(t, reactor.received[1]); len(ids) != 1 || ids[0] != "d2" {
		t.Fatalf("OnExit delivery IDs = %#v", ids)
	}
	if len(hook.exited) != 1 || hook.exited[0] != "intro" {
		t.Fatalf("exited hooks = %#v", hook.exited)
	}
	if len(hook.entered) != 2 || hook.entered[1] != "next" {
		t.Fatalf("entered hooks after advance = %#v", hook.entered)
	}
}

func TestPhaseEngine_NormalizesLegacyPhaseActionTypes(t *testing.T) {
	voting := &stubFullModule{
		stubCoreModule: stubCoreModule{name: "voting"},
		actions:        []PhaseAction{ActionOpenVoting},
	}
	textChat := &stubFullModule{
		stubCoreModule: stubCoreModule{name: "text_chat"},
		actions:        []PhaseAction{ActionMuteChat},
	}
	phases := []PhaseDefinition{
		{
			ID:      "intro",
			Name:    "Intro",
			OnEnter: json.RawMessage(`[{"type":"enable_voting"}]`),
			OnExit:  json.RawMessage(`{"actions":[{"type":"disable_chat"}]}`),
		},
		{ID: "next", Name: "Next"},
	}
	pe, _ := newTestPhaseEngine(t, []Module{voting, textChat}, phases)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	if len(voting.received) != 1 || voting.received[0].Action != ActionOpenVoting {
		t.Fatalf("OnEnter legacy action = %#v", voting.received)
	}
	if _, err := pe.AdvancePhase(ctx); err != nil {
		t.Fatalf("AdvancePhase: %v", err)
	}
	if len(textChat.received) != 1 || textChat.received[0].Action != ActionMuteChat {
		t.Fatalf("OnExit legacy action = %#v", textChat.received)
	}
}

func TestParseConfiguredPhaseActions_NormalizesLegacyAliases(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want PhaseAction
	}{
		{name: "deliver information", raw: `[{"type":"deliver_information"}]`, want: ActionDeliverInformation},
		{name: "open voting", raw: `[{"type":"enable_voting"}]`, want: ActionOpenVoting},
		{name: "close voting", raw: `[{"type":"disable_voting"}]`, want: ActionCloseVoting},
		{name: "unmute chat", raw: `[{"type":"enable_chat"}]`, want: ActionUnmuteChat},
		{name: "mute chat", raw: `[{"type":"disable_chat"}]`, want: ActionMuteChat},
		{name: "set bgm", raw: `[{"type":"play_bgm"}]`, want: ActionSetBGM},
		{name: "play sound", raw: `[{"type":"play_sound"}]`, want: ActionPlaySound},
		{name: "play media", raw: `[{"type":"play_media"}]`, want: ActionPlayMedia},
		{name: "stop audio", raw: `[{"type":"stop_bgm"}]`, want: ActionStopAudio},
		{name: "broadcast", raw: `[{"type":"broadcast"}]`, want: ActionBroadcastMessage},
		{name: "wrapped action", raw: `{"actions":[{"type":"disable_chat"}]}`, want: ActionMuteChat},
		{name: "lowercase canonical", raw: `[{"type":"evaluate_ending"}]`, want: ActionEvaluateEnding},
		{name: "trimmed uppercase canonical", raw: `[{"type":" SET_BGM "}]`, want: ActionSetBGM},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actions, err := parseConfiguredPhaseActions(json.RawMessage(tt.raw))
			if err != nil {
				t.Fatalf("parseConfiguredPhaseActions: %v", err)
			}
			if len(actions) != 1 || actions[0].Action != tt.want {
				t.Fatalf("actions = %#v, want action %q", actions, tt.want)
			}
		})
	}
}

func phaseActionDeliveryIDs(t *testing.T, action PhaseActionPayload) []string {
	t.Helper()
	var params struct {
		Deliveries []struct {
			ID string `json:"id"`
		} `json:"deliveries"`
	}
	if err := json.Unmarshal(action.Params, &params); err != nil {
		t.Fatalf("unmarshal action params: %v", err)
	}
	ids := make([]string, 0, len(params.Deliveries))
	for _, delivery := range params.Deliveries {
		ids = append(ids, delivery.ID)
	}
	return ids
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
