package core

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

func TestClueInteractionModule_ConfiguredRevealConsumesAndRedacts(t *testing.T) {
	deps := newTestDeps()
	m := NewClueInteractionModule()
	playerID := uuid.New()
	otherID := uuid.New()
	clueID := uuid.New()
	cfg, _ := json.Marshal(ClueInteractionConfig{ItemEffects: map[string]ClueItemEffectConfig{
		clueID.String(): {Effect: clueEffectReveal, Target: "self", Consume: true, RevealText: "금고 비밀번호는 0421입니다."},
	}})
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}
	m.mu.Lock()
	m.acquiredClues[playerID] = []string{clueID.String()}
	m.mu.Unlock()

	var declared, resolved, revealed bool
	deps.EventBus.Subscribe("clue.item_declared", func(e engine.Event) { declared = true })
	deps.EventBus.Subscribe("clue.item_resolved", func(e engine.Event) {
		payload := e.Payload.(map[string]any)
		resolved = payload["consumed"] == true
	})
	deps.EventBus.Subscribe("clue.reveal_result", func(e engine.Event) { revealed = true })

	payload, _ := json.Marshal(itemUsePayload{ClueID: clueID.String()})
	if err := m.HandleMessage(context.Background(), playerID, "clue:use", payload); err != nil {
		t.Fatalf("clue:use reveal: %v", err)
	}
	if !declared || !resolved || !revealed {
		t.Fatalf("expected declared/resolved/revealed events, got declared=%v resolved=%v revealed=%v", declared, resolved, revealed)
	}
	m.mu.RLock()
	if m.playerHasClueLocked(playerID, clueID.String()) {
		t.Fatal("consumed reveal clue should be removed from player inventory")
	}
	if got := m.revealedInfo[playerID][clueID.String()]; got != "금고 비밀번호는 0421입니다." {
		t.Fatalf("revealed text = %q", got)
	}
	m.mu.RUnlock()

	ownData, err := m.BuildStateFor(playerID)
	if err != nil {
		t.Fatalf("BuildStateFor owner: %v", err)
	}
	if !bytes.Contains(ownData, []byte("0421")) {
		t.Fatalf("owner should see revealed info: %s", ownData)
	}
	otherData, err := m.BuildStateFor(otherID)
	if err != nil {
		t.Fatalf("BuildStateFor other: %v", err)
	}
	if bytes.Contains(otherData, []byte("0421")) || bytes.Contains(otherData, []byte(playerID.String())) {
		t.Fatalf("other player leaked revealed info: %s", otherData)
	}
}

func TestClueInteractionModule_ConfiguredGrantClueIsIdempotent(t *testing.T) {
	deps := newTestDeps()
	m := NewClueInteractionModule()
	playerID := uuid.New()
	keyID := uuid.New()
	rewardID := uuid.New().String()
	cfg, _ := json.Marshal(ClueInteractionConfig{ItemEffects: map[string]ClueItemEffectConfig{
		keyID.String(): {Effect: clueEffectGrantClue, Target: "self", Consume: false, GrantClueIDs: []string{rewardID}},
	}})
	if err := m.Init(context.Background(), deps, cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}
	m.mu.Lock()
	m.acquiredClues[playerID] = []string{keyID.String()}
	m.mu.Unlock()

	acquiredEvents := 0
	deps.EventBus.Subscribe("clue.acquired", func(e engine.Event) { acquiredEvents++ })
	payload, _ := json.Marshal(itemUsePayload{ClueID: keyID.String()})
	if err := m.HandleMessage(context.Background(), playerID, "clue:use", payload); err != nil {
		t.Fatalf("first grant use: %v", err)
	}
	if err := m.HandleMessage(context.Background(), playerID, "clue:use", payload); err != nil {
		t.Fatalf("second grant use should be idempotent: %v", err)
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	if !m.playerHasClueLocked(playerID, keyID.String()) {
		t.Fatal("non-consumed grant clue should remain in inventory")
	}
	if !m.playerHasClueLocked(playerID, rewardID) {
		t.Fatal("reward clue should be granted")
	}
	if len(m.usedItems[playerID]) != 1 {
		t.Fatalf("configured item use should be recorded once, got %d", len(m.usedItems[playerID]))
	}
	if acquiredEvents != 1 {
		t.Fatalf("expected one clue.acquired event, got %d", acquiredEvents)
	}
}

func TestClueInteractionModule_ConfiguredEffectRequiresOwnership(t *testing.T) {
	m := NewClueInteractionModule()
	clueID := uuid.New()
	cfg, _ := json.Marshal(ClueInteractionConfig{ItemEffects: map[string]ClueItemEffectConfig{
		clueID.String(): {Effect: clueEffectReveal, Target: "self", RevealText: "비밀"},
	}})
	if err := m.Init(context.Background(), newTestDeps(), cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}
	payload, _ := json.Marshal(itemUsePayload{ClueID: clueID.String()})
	if err := m.HandleMessage(context.Background(), uuid.New(), "clue:use", payload); err == nil {
		t.Fatal("expected ownership error for configured clue effect")
	}
}

func TestClueInteractionModule_ConfiguredEffectInvalidConfig(t *testing.T) {
	m := NewClueInteractionModule()
	clueID := uuid.New()
	cfg, _ := json.Marshal(ClueInteractionConfig{ItemEffects: map[string]ClueItemEffectConfig{
		clueID.String(): {Effect: clueEffectGrantClue, Target: "self"},
	}})
	if err := m.Init(context.Background(), newTestDeps(), cfg); err == nil {
		t.Fatal("expected invalid config error when grant_clue has no rewards")
	}
}

func TestClueInteractionModule_LegacyRevealPayloadIsNotRuntimeTruth(t *testing.T) {
	m := NewClueInteractionModule()
	if err := m.Init(context.Background(), newTestDeps(), nil); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	clueID := uuid.New()
	usePayload, _ := json.Marshal(itemUsePayload{ClueID: clueID.String(), Effect: clueEffectReveal, Target: "self"})
	if err := m.HandleMessage(context.Background(), playerID, "clue:use", usePayload); err != nil {
		t.Fatalf("legacy reveal declaration should keep old declare-then-fail behavior: %v", err)
	}
	targetPayload, _ := json.Marshal(itemUseTargetPayload{TargetPlayerID: playerID.String()})
	if err := m.HandleMessage(context.Background(), playerID, "clue:use_target", targetPayload); err == nil {
		t.Fatal("expected legacy reveal payload to be rejected without configured engine effect")
	}
}

func TestClueInteractionModule_ImmediateConfiguredUseDoesNotClearActiveTargetFlow(t *testing.T) {
	m := NewClueInteractionModule()
	selfPlayer := uuid.New()
	activePlayer := uuid.New()
	configuredClueID := uuid.New()
	activeClueID := uuid.New()
	cfg, _ := json.Marshal(ClueInteractionConfig{ItemEffects: map[string]ClueItemEffectConfig{
		configuredClueID.String(): {Effect: clueEffectReveal, Target: "self", RevealText: "개인 정보"},
	}})
	if err := m.Init(context.Background(), newTestDeps(), cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}
	m.mu.Lock()
	m.activeItemUse = &ItemUseState{UserID: activePlayer, ClueID: activeClueID, Effect: clueEffectPeek, Target: "player"}
	m.acquiredClues[selfPlayer] = []string{configuredClueID.String()}
	m.mu.Unlock()

	payload, _ := json.Marshal(itemUsePayload{ClueID: configuredClueID.String()})
	if err := m.HandleMessage(context.Background(), selfPlayer, "clue:use", payload); err != nil {
		t.Fatalf("configured self use should resolve: %v", err)
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.activeItemUse == nil || m.activeItemUse.ClueID != activeClueID {
		t.Fatalf("unrelated active target flow was cleared: %+v", m.activeItemUse)
	}
}
