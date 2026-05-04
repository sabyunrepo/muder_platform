package engine

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestPhaseEngine_AdvanceSceneSelectsFirstMatchingBackendCondition(t *testing.T) {
	pe, audit := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	if err := pe.SetSceneTransitions([]SceneTransition{
		{
			ID:        "blocked",
			From:      "intro",
			To:        "vote",
			SortOrder: 0,
			Condition: sceneTransitionCustomFlagCondition("blocked_route", "true"),
		},
		{
			ID:        "open",
			From:      "intro",
			To:        "invest",
			Label:     "조사 장면으로 이동",
			SortOrder: 1,
			Condition: sceneTransitionCustomFlagCondition("open_route", "true"),
		},
	}); err != nil {
		t.Fatalf("SetSceneTransitions: %v", err)
	}

	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	advanced, err := pe.AdvanceScene(ctx, json.RawMessage(`{"flags":{"blocked_route":false,"open_route":true}}`))
	if err != nil || !advanced {
		t.Fatalf("AdvanceScene: advanced=%v err=%v", advanced, err)
	}
	if got := pe.CurrentPhase().ID; got != "invest" {
		t.Fatalf("CurrentPhase = %s, want invest", got)
	}
	if got := pe.CurrentRound(); got != 2 {
		t.Fatalf("CurrentRound = %d, want 2", got)
	}

	events := audit.eventsOfType("phase.scene_transitioned")
	if len(events) != 1 {
		t.Fatalf("phase.scene_transitioned audits = %d, want 1", len(events))
	}
	var payload struct {
		From         string `json:"from"`
		To           string `json:"to"`
		TransitionID string `json:"transitionId"`
	}
	if err := json.Unmarshal(events[0].Payload, &payload); err != nil {
		t.Fatalf("unmarshal audit payload: %v", err)
	}
	if payload.From != "intro" || payload.To != "invest" || payload.TransitionID != "open" {
		t.Fatalf("audit payload = %#v", payload)
	}
}

func TestPhaseEngine_AdvanceSceneRejectsWhenNoConditionMatches(t *testing.T) {
	pe, audit := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	if err := pe.SetSceneTransitions([]SceneTransition{
		{
			ID:        "locked",
			From:      "intro",
			To:        "invest",
			Condition: sceneTransitionCustomFlagCondition("route_open", "true"),
		},
	}); err != nil {
		t.Fatalf("SetSceneTransitions: %v", err)
	}

	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	advanced, err := pe.AdvanceScene(ctx, json.RawMessage(`{"flags":{"route_open":false}}`))
	if err == nil || advanced {
		t.Fatalf("AdvanceScene should reject without advancing, advanced=%v err=%v", advanced, err)
	}
	if !strings.Contains(err.Error(), "no matching scene transition") {
		t.Fatalf("AdvanceScene error = %v", err)
	}
	if got := pe.CurrentPhase().ID; got != "intro" {
		t.Fatalf("CurrentPhase = %s, want intro", got)
	}
	if got := pe.CurrentRound(); got != 1 {
		t.Fatalf("CurrentRound = %d, want 1", got)
	}
	if got := len(audit.eventsOfType("phase.scene_transitioned")); got != 0 {
		t.Fatalf("phase.scene_transitioned audits = %d, want 0", got)
	}
}

func TestPhaseEngine_AdvanceSceneRunsExitAndEnterActions(t *testing.T) {
	reactor := &stubFullModule{
		stubCoreModule: stubCoreModule{name: "information_delivery"},
		actions:        []PhaseAction{ActionDeliverInformation},
	}
	phases := []PhaseDefinition{
		{
			ID:      "intro",
			Name:    "Intro",
			OnExit:  json.RawMessage(`[{"type":"DELIVER_INFORMATION","params":{"deliveries":[{"id":"exit-intro"}]}}]`),
			OnEnter: json.RawMessage(`[{"type":"DELIVER_INFORMATION","params":{"deliveries":[{"id":"enter-intro"}]}}]`),
		},
		{
			ID:      "invest",
			Name:    "Investigation",
			OnEnter: json.RawMessage(`[{"type":"DELIVER_INFORMATION","params":{"deliveries":[{"id":"enter-invest"}]}}]`),
		},
	}
	pe, _ := newTestPhaseEngine(t, []Module{reactor}, phases)
	if err := pe.SetSceneTransitions([]SceneTransition{{ID: "default", From: "intro", To: "invest"}}); err != nil {
		t.Fatalf("SetSceneTransitions: %v", err)
	}

	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	if _, err := pe.AdvanceScene(ctx, nil); err != nil {
		t.Fatalf("AdvanceScene: %v", err)
	}
	if len(reactor.received) != 3 {
		t.Fatalf("received actions = %#v, want 3 actions", reactor.received)
	}
	for idx, want := range []string{"enter-intro", "exit-intro", "enter-invest"} {
		if ids := phaseActionDeliveryIDs(t, reactor.received[idx]); len(ids) != 1 || ids[0] != want {
			t.Fatalf("action %d delivery IDs = %#v, want %s", idx, ids, want)
		}
	}
}

func TestPhaseEngine_AdvanceSceneRollsBackCurrentWhenTargetEnterFails(t *testing.T) {
	hook := &failingEnterHookModule{stubCoreModule: stubCoreModule{name: "hook"}, failPhase: "invest"}
	pe, audit := newTestPhaseEngine(t, []Module{hook}, testPhaseDefinitions)
	if err := pe.SetSceneTransitions([]SceneTransition{{ID: "default", From: "intro", To: "invest"}}); err != nil {
		t.Fatalf("SetSceneTransitions: %v", err)
	}

	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	advanced, err := pe.AdvanceScene(ctx, nil)
	if err == nil || advanced {
		t.Fatalf("AdvanceScene should fail without advancing, advanced=%v err=%v", advanced, err)
	}
	if got := pe.CurrentPhase().ID; got != "intro" {
		t.Fatalf("CurrentPhase after failed advance = %s, want intro", got)
	}
	if got := pe.CurrentRound(); got != 1 {
		t.Fatalf("CurrentRound after failed advance = %d, want 1", got)
	}
	if got := len(audit.eventsOfType("phase.scene_transitioned")); got != 0 {
		t.Fatalf("phase.scene_transitioned audits = %d, want 0", got)
	}
}

func TestPhaseEngine_AdvanceSceneFallsBackToLinearAdvanceWithoutSceneGraph(t *testing.T) {
	pe, _ := newTestPhaseEngine(t, nil, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	advanced, err := pe.AdvanceScene(ctx, nil)
	if err != nil || !advanced {
		t.Fatalf("AdvanceScene fallback: advanced=%v err=%v", advanced, err)
	}
	if got := pe.CurrentPhase().ID; got != "invest" {
		t.Fatalf("CurrentPhase = %s, want invest", got)
	}
}

func sceneTransitionCustomFlagCondition(flagKey string, value string) json.RawMessage {
	raw, err := json.Marshal(ConditionGroup{
		ID:       "group-" + flagKey,
		Operator: "AND",
		Rules: []ConditionNode{{
			Rule: &ConditionRule{
				ID:            "rule-" + flagKey,
				Variable:      "custom_flag",
				TargetFlagKey: flagKey,
				Comparator:    "=",
				Value:         value,
			},
		}},
	})
	if err != nil {
		panic(err)
	}
	return raw
}
