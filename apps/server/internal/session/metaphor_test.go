package session_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/mmp-platform/server/internal/module/core"
	"github.com/mmp-platform/server/internal/template"
)

// newMetaphorTestDeps는 메타포 테스트용 ModuleDeps를 생성합니다.
func newMetaphorTestDeps() engine.ModuleDeps {
	return engine.ModuleDeps{
		SessionID: uuid.New(),
		EventBus:  engine.NewEventBus(nil),
		Logger:    nil,
	}
}

// metaphorClueConfig는 메타포 템플릿의 clue_interaction 설정 (drawLimit=4)입니다.
var metaphorClueConfig = json.RawMessage(`{
	"drawLimit": 4,
	"initialClueLevel": 1,
	"cumulativeLevel": true,
	"duplicatePolicy": "exclusive"
}`)

// clueModuleState는 BuildState 결과를 파싱하기 위한 로컬 구조체입니다.
type clueModuleState struct {
	PlayerDrawCounts map[uuid.UUID]int         `json:"playerDrawCounts"`
	CurrentClueLevel int                       `json:"currentClueLevel"`
	AcquiredClues    map[uuid.UUID][]string    `json:"acquiredClues"`
	Config           core.ClueInteractionConfig `json:"config"`
	UsedItems        map[uuid.UUID][]uuid.UUID  `json:"usedItems"`
	ActiveItemUse    *activeItemUseSnapshot     `json:"activeItemUse,omitempty"`
}

type activeItemUseSnapshot struct {
	UserID string `json:"userId"`
	ClueID string `json:"clueId"`
	Effect string `json:"effect"`
	Target string `json:"target"`
}

// parseClueState는 BuildState JSON을 clueModuleState로 파싱합니다.
func parseClueState(t *testing.T, m *core.ClueInteractionModule) clueModuleState {
	t.Helper()
	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var state clueModuleState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatalf("unmarshal state: %v", err)
	}
	return state
}

// TestMetaphor_TemplateLoads — 메타포 템플릿이 정상 로드되는지 확인합니다.
func TestMetaphor_TemplateLoads(t *testing.T) {
	loader := template.NewLoader()
	tmpl, err := loader.Load("murder_mystery_metaphor_6p")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(tmpl.Phases) != 13 {
		t.Fatalf("expected 13 phases, got %d", len(tmpl.Phases))
	}
	if len(tmpl.Modules) != 14 {
		t.Fatalf("expected 14 modules, got %d", len(tmpl.Modules))
	}
}

// TestMetaphor_TemplateModuleIDs — 메타포 템플릿의 모듈 ID 목록을 확인합니다.
func TestMetaphor_TemplateModuleIDs(t *testing.T) {
	loader := template.NewLoader()
	tmpl, err := loader.Load("murder_mystery_metaphor_6p")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	wantModules := []string{
		"connection", "room", "ready", "text_chat", "whisper", "group_chat",
		"clue_interaction", "trade_clue", "script_progression", "reading",
		"voting", "hidden_mission", "ending", "consensus_control",
	}
	if len(tmpl.Modules) != len(wantModules) {
		t.Fatalf("module count = %d, want %d", len(tmpl.Modules), len(wantModules))
	}
	got := make(map[string]bool, len(tmpl.Modules))
	for _, mod := range tmpl.Modules {
		got[mod.ID] = true
	}
	for _, want := range wantModules {
		if !got[want] {
			t.Errorf("missing module %q in template", want)
		}
	}
}

// TestMetaphor_TemplatePhaseIDs — 메타포 템플릿의 페이즈 ID 순서를 확인합니다.
func TestMetaphor_TemplatePhaseIDs(t *testing.T) {
	loader := template.NewLoader()
	tmpl, err := loader.Load("murder_mystery_metaphor_6p")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	wantPhases := []string{
		"lobby", "prologue", "character_select", "opening", "introduction",
		"investigation_1", "discussion_1", "secret_reveal", "investigation_2",
		"discussion_2", "voting", "action", "ending",
	}
	if len(tmpl.Phases) != len(wantPhases) {
		t.Fatalf("phase count = %d, want %d", len(tmpl.Phases), len(wantPhases))
	}
	for i, want := range wantPhases {
		if tmpl.Phases[i].ID != want {
			t.Errorf("phase[%d] = %q, want %q", i, tmpl.Phases[i].ID, want)
		}
	}
}

// TestMetaphor_ClueInteractionConfig — 메타포 템플릿의 clue_interaction 설정이 올바른지 확인합니다.
func TestMetaphor_ClueInteractionConfig(t *testing.T) {
	loader := template.NewLoader()
	tmpl, err := loader.Load("murder_mystery_metaphor_6p")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	var clueModCfg json.RawMessage
	for _, mod := range tmpl.Modules {
		if mod.ID == "clue_interaction" {
			clueModCfg = mod.Config
			break
		}
	}
	if clueModCfg == nil {
		t.Fatal("clue_interaction module not found in template")
	}

	m := core.NewClueInteractionModule()
	if err := m.Init(context.Background(), newMetaphorTestDeps(), clueModCfg); err != nil {
		t.Fatalf("Init with template config: %v", err)
	}

	state := parseClueState(t, m)
	if state.Config.DrawLimit != 4 {
		t.Fatalf("drawLimit = %d, want 4", state.Config.DrawLimit)
	}
	if state.Config.InitialClueLevel != 1 {
		t.Fatalf("initialClueLevel = %d, want 1", state.Config.InitialClueLevel)
	}
	if state.Config.DuplicatePolicy != "exclusive" {
		t.Fatalf("duplicatePolicy = %q, want %q", state.Config.DuplicatePolicy, "exclusive")
	}
}

// TestMetaphor_ClueInteraction_ItemUse — 아이템 사용 전체 플로우를 검증합니다.
// 1. p1이 clue:use 선언 → clue.item_declared 이벤트
// 2. p1이 clue:use_target으로 p2 지정 → clue.peek_result + clue.item_resolved 이벤트
// 3. activeItemUse 해제 확인, usedItems 기록 확인
func TestMetaphor_ClueInteraction_ItemUse(t *testing.T) {
	deps := newMetaphorTestDeps()
	m := core.NewClueInteractionModule()
	if err := m.Init(context.Background(), deps, metaphorClueConfig); err != nil {
		t.Fatalf("Init: %v", err)
	}

	p1 := uuid.New()
	p2 := uuid.New()
	clueID := uuid.New()

	// p2에게 단서를 드로우로 부여합니다 (exclusive policy 충돌 방지를 위해 다른 위치 사용).
	p2DrawPayload, _ := json.Marshal(map[string]string{"locationId": "garden"})
	if err := m.HandleMessage(context.Background(), p2, "draw_clue", p2DrawPayload); err != nil {
		t.Fatalf("p2 draw_clue: %v", err)
	}

	var declaredFired, resolvedFired, peekFired bool
	deps.EventBus.Subscribe("clue.item_declared", func(e engine.Event) { declaredFired = true })
	deps.EventBus.Subscribe("clue.item_resolved", func(e engine.Event) { resolvedFired = true })
	deps.EventBus.Subscribe("clue.peek_result", func(e engine.Event) { peekFired = true })

	// 1단계: 아이템 사용 선언 (clue:use).
	usePayload, _ := json.Marshal(map[string]string{
		"clueId": clueID.String(),
		"effect": "peek",
		"target": "player",
	})
	if err := m.HandleMessage(context.Background(), p1, "clue:use", usePayload); err != nil {
		t.Fatalf("clue:use failed: %v", err)
	}
	if !declaredFired {
		t.Fatal("clue.item_declared not published")
	}

	// 2단계: 대상 지정 (clue:use_target → p2).
	targetPayload, _ := json.Marshal(map[string]string{
		"targetPlayerId": p2.String(),
	})
	if err := m.HandleMessage(context.Background(), p1, "clue:use_target", targetPayload); err != nil {
		t.Fatalf("clue:use_target failed: %v", err)
	}
	if !resolvedFired {
		t.Fatal("clue.item_resolved not published")
	}
	if !peekFired {
		t.Fatal("clue.peek_result not published")
	}

	// activeItemUse 해제 및 usedItems 기록 확인.
	state := parseClueState(t, m)
	if state.ActiveItemUse != nil {
		t.Fatal("expected activeItemUse to be nil after resolution")
	}
	if len(state.UsedItems[p1]) != 1 {
		t.Fatalf("expected 1 used item, got %d", len(state.UsedItems[p1]))
	}
}

// TestMetaphor_ClueInteraction_ItemUseMutex — 동시 아이템 사용 차단을 검증합니다.
// p1이 사용 중일 때 p2가 시도하면 에러가 반환되어야 합니다.
func TestMetaphor_ClueInteraction_ItemUseMutex(t *testing.T) {
	m := core.NewClueInteractionModule()
	if err := m.Init(context.Background(), newMetaphorTestDeps(), metaphorClueConfig); err != nil {
		t.Fatalf("Init: %v", err)
	}

	p1, p2 := uuid.New(), uuid.New()
	clue1, clue2 := uuid.New(), uuid.New()

	// p1이 아이템 사용 선언.
	payload1, _ := json.Marshal(map[string]string{
		"clueId": clue1.String(),
		"effect": "peek",
		"target": "player",
	})
	if err := m.HandleMessage(context.Background(), p1, "clue:use", payload1); err != nil {
		t.Fatalf("p1 clue:use failed: %v", err)
	}

	// p2가 사용 시도 → 뮤텍스 차단.
	payload2, _ := json.Marshal(map[string]string{
		"clueId": clue2.String(),
		"effect": "peek",
		"target": "player",
	})
	if err := m.HandleMessage(context.Background(), p2, "clue:use", payload2); err == nil {
		t.Fatal("expected mutex block error for concurrent item use, got nil")
	}
}

// TestMetaphor_ClueInteraction_DrawLimitFour — drawLimit=4 제한을 검증합니다.
// 4장 획득 후 5번째 시도는 에러가 반환되어야 합니다.
func TestMetaphor_ClueInteraction_DrawLimitFour(t *testing.T) {
	m := core.NewClueInteractionModule()
	if err := m.Init(context.Background(), newMetaphorTestDeps(), metaphorClueConfig); err != nil {
		t.Fatalf("Init: %v", err)
	}

	playerID := uuid.New()

	// 4장 정상 획득 (exclusive policy 충돌 방지: 각 위치 별도 사용).
	locations := []string{"room_a", "room_b", "room_c", "room_d"}
	for i, loc := range locations {
		payload, _ := json.Marshal(map[string]string{"locationId": loc})
		if err := m.HandleMessage(context.Background(), playerID, "draw_clue", payload); err != nil {
			t.Fatalf("draw %d failed: %v", i+1, err)
		}
	}

	// 5번째 시도는 drawLimit 에러가 발생해야 합니다.
	payload, _ := json.Marshal(map[string]string{"locationId": "room_e"})
	if err := m.HandleMessage(context.Background(), playerID, "draw_clue", payload); err == nil {
		t.Fatal("expected draw limit error on 5th draw, got nil")
	}
}

// TestMetaphor_PhaseActions — RESET_DRAW_COUNT, SET_CLUE_LEVEL 페이즈 액션을 검증합니다.
func TestMetaphor_PhaseActions(t *testing.T) {
	m := core.NewClueInteractionModule()
	if err := m.Init(context.Background(), newMetaphorTestDeps(), metaphorClueConfig); err != nil {
		t.Fatalf("Init: %v", err)
	}

	playerID := uuid.New()

	// 단서 2장 획득.
	for i, loc := range []string{"lib_a", "lib_b"} {
		payload, _ := json.Marshal(map[string]string{"locationId": loc})
		if err := m.HandleMessage(context.Background(), playerID, "draw_clue", payload); err != nil {
			t.Fatalf("draw %d: %v", i+1, err)
		}
	}

	// RESET_DRAW_COUNT → drawCount가 0으로 초기화됩니다.
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionResetDrawCount,
	}); err != nil {
		t.Fatalf("ReactTo RESET_DRAW_COUNT: %v", err)
	}

	state := parseClueState(t, m)
	if state.PlayerDrawCounts[playerID] != 0 {
		t.Fatalf("draw count after reset = %d, want 0", state.PlayerDrawCounts[playerID])
	}

	// SET_CLUE_LEVEL:2 → 레벨이 2로 변경됩니다.
	params, _ := json.Marshal(map[string]int{"level": 2})
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionSetClueLevel,
		Params: params,
	}); err != nil {
		t.Fatalf("ReactTo SET_CLUE_LEVEL: %v", err)
	}

	state = parseClueState(t, m)
	if state.CurrentClueLevel != 2 {
		t.Fatalf("clue level = %d, want 2", state.CurrentClueLevel)
	}
}

// TestMetaphor_PhaseActions_InvestigationFlow — investigation_1 → investigation_2 전환 시나리오를 검증합니다.
// 템플릿 페이즈 액션 순서대로 RESET_DRAW_COUNT + SET_CLUE_LEVEL:2를 순차 적용합니다.
func TestMetaphor_PhaseActions_InvestigationFlow(t *testing.T) {
	m := core.NewClueInteractionModule()
	if err := m.Init(context.Background(), newMetaphorTestDeps(), metaphorClueConfig); err != nil {
		t.Fatalf("Init: %v", err)
	}

	p1, p2 := uuid.New(), uuid.New()

	// investigation_1: p1, p2 각각 다른 위치에서 단서 2장씩 획득.
	p1Locs := []string{"hall_a", "hall_b"}
	p2Locs := []string{"cellar_a", "cellar_b"}
	for _, loc := range p1Locs {
		payload, _ := json.Marshal(map[string]string{"locationId": loc})
		_ = m.HandleMessage(context.Background(), p1, "draw_clue", payload)
	}
	for _, loc := range p2Locs {
		payload, _ := json.Marshal(map[string]string{"locationId": loc})
		_ = m.HandleMessage(context.Background(), p2, "draw_clue", payload)
	}

	// investigation_2 진입: RESET_DRAW_COUNT → SET_CLUE_LEVEL:2.
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionResetDrawCount,
	}); err != nil {
		t.Fatalf("RESET_DRAW_COUNT: %v", err)
	}
	params, _ := json.Marshal(map[string]int{"level": 2})
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionSetClueLevel,
		Params: params,
	}); err != nil {
		t.Fatalf("SET_CLUE_LEVEL:2: %v", err)
	}

	state := parseClueState(t, m)
	if state.PlayerDrawCounts[p1] != 0 {
		t.Fatalf("p1 draw count after reset = %d, want 0", state.PlayerDrawCounts[p1])
	}
	if state.PlayerDrawCounts[p2] != 0 {
		t.Fatalf("p2 draw count after reset = %d, want 0", state.PlayerDrawCounts[p2])
	}
	if state.CurrentClueLevel != 2 {
		t.Fatalf("clue level = %d, want 2", state.CurrentClueLevel)
	}

	// investigation_2에서 drawLimit(4) 내로 다시 획득 가능해야 합니다.
	payload, _ := json.Marshal(map[string]string{"locationId": "attic_x"})
	if err := m.HandleMessage(context.Background(), p1, "draw_clue", payload); err != nil {
		t.Fatalf("draw after reset failed: %v", err)
	}
	state = parseClueState(t, m)
	if state.PlayerDrawCounts[p1] != 1 {
		t.Fatalf("p1 draw count after re-draw = %d, want 1", state.PlayerDrawCounts[p1])
	}
}
