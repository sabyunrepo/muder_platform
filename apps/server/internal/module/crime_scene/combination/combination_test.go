package combination

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
	"github.com/mmp-platform/server/internal/engine/testutil"
)

func newTestDeps() engine.ModuleDeps {
	return engine.ModuleDeps{
		SessionID: uuid.New(),
		EventBus:  engine.NewEventBus(nil),
		Logger:    nil,
	}
}

func combinationCfg() json.RawMessage {
	return json.RawMessage(`{
		"combinations": [
			{
				"id": "combo1",
				"inputIds": ["knife","glove"],
				"outputClueId": "weapon_set",
				"description": "Knife + Glove"
			},
			{
				"id": "combo2",
				"inputIds": ["note"],
				"outputClueId": "motive",
				"description": "Note reveals motive"
			}
		],
		"winCombination": ["knife","glove","note"]
	}`)
}

func TestCombinationModule_Name(t *testing.T) {
	m := NewCombinationModule()
	if m.Name() != "combination" {
		t.Fatalf("expected %q, got %q", "combination", m.Name())
	}
}

func TestCombinationModule_Init_ValidConfig(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	m.mu.RLock()
	if len(m.comboByID) != 2 {
		t.Fatalf("expected 2 combinations, got %d", len(m.comboByID))
	}
	m.mu.RUnlock()
}

func TestCombinationModule_Init_InvalidConfig(t *testing.T) {
	m := NewCombinationModule()
	err := m.Init(context.Background(), newTestDeps(), json.RawMessage(`{bad}`))
	if err == nil {
		t.Fatal("expected error for bad JSON")
	}
}

func TestCombinationModule_Init_NilConfig(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), nil); err != nil {
		t.Fatalf("Init with nil config: %v", err)
	}
}

func TestCombinationModule_HandleMessage_Combine(t *testing.T) {
	m := NewCombinationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}

	playerID := uuid.New()
	// Give player the required evidence via eventbus.
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true, "glove": true}
	m.mu.Unlock()

	var completedEvt, clueEvt bool
	deps.EventBus.Subscribe("combination.completed", func(e engine.Event) { completedEvt = true })
	deps.EventBus.Subscribe("combination.clue_unlocked", func(e engine.Event) { clueEvt = true })

	err := m.HandleMessage(context.Background(), playerID,
		"combine", json.RawMessage(`{"evidence_ids":["knife","glove"]}`))
	if err != nil {
		t.Fatalf("combine: %v", err)
	}
	if !completedEvt {
		t.Fatal("expected combination.completed event")
	}
	if !clueEvt {
		t.Fatal("expected combination.clue_unlocked event")
	}

	m.mu.RLock()
	found := false
	for _, id := range m.completed[playerID] {
		if id == "combo1" {
			found = true
		}
	}
	m.mu.RUnlock()
	if !found {
		t.Fatal("combo1 not in completed list")
	}
}

func TestCombinationModule_HandleMessage_Combine_MissingEvidence(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	// player has only knife, not glove
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true}
	m.mu.Unlock()

	err := m.HandleMessage(context.Background(), playerID,
		"combine", json.RawMessage(`{"evidence_ids":["knife","glove"]}`))
	if err == nil {
		t.Fatal("expected error: missing evidence glove")
	}
}

func TestCombinationModule_HandleMessage_Combine_NoMatch(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	err := m.HandleMessage(context.Background(), uuid.New(),
		"combine", json.RawMessage(`{"evidence_ids":["unknown1","unknown2"]}`))
	if err == nil {
		t.Fatal("expected error: no matching combination")
	}
}

func TestCombinationModule_HandleMessage_Combine_Idempotent(t *testing.T) {
	m := NewCombinationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true, "glove": true}
	m.mu.Unlock()

	p := json.RawMessage(`{"evidence_ids":["knife","glove"]}`)
	if err := m.HandleMessage(context.Background(), playerID, "combine", p); err != nil {
		t.Fatalf("first combine: %v", err)
	}
	if err := m.HandleMessage(context.Background(), playerID, "combine", p); err != nil {
		t.Fatalf("second combine (idempotent): %v", err)
	}

	m.mu.RLock()
	count := 0
	for _, id := range m.completed[playerID] {
		if id == "combo1" {
			count++
		}
	}
	m.mu.RUnlock()
	if count != 1 {
		t.Fatalf("expected exactly 1 combo1 completion, got %d", count)
	}
}

func TestCombinationModule_HandleMessage_UnknownType(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	err := m.HandleMessage(context.Background(), uuid.New(), "unknown", nil)
	if err == nil {
		t.Fatal("expected error for unknown message type")
	}
}

func TestCombinationModule_CheckWin_NotMet(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	result, err := m.CheckWin(context.Background(), engine.GameState{})
	if err != nil {
		t.Fatalf("CheckWin: %v", err)
	}
	if result.Won {
		t.Fatal("expected not won initially")
	}
}

func TestCombinationModule_CheckWin_Met(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true, "glove": true, "note": true}
	m.mu.Unlock()

	result, err := m.CheckWin(context.Background(), engine.GameState{})
	if err != nil {
		t.Fatalf("CheckWin: %v", err)
	}
	if !result.Won {
		t.Fatal("expected win when all required evidence collected")
	}
	if len(result.WinnerIDs) == 0 || result.WinnerIDs[0] != playerID {
		t.Fatalf("expected winner to be playerID, got %v", result.WinnerIDs)
	}
}

func TestCombinationModule_CheckWin_NoWinCombo(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), json.RawMessage(`{
		"combinations": [{"id":"c1","inputIds":["a"],"outputClueId":"b","description":""}]
	}`)); err != nil {
		t.Fatalf("Init: %v", err)
	}
	result, err := m.CheckWin(context.Background(), engine.GameState{})
	if err != nil {
		t.Fatalf("CheckWin: %v", err)
	}
	if result.Won {
		t.Fatal("expected no win without winCombination configured")
	}
}

func TestCombinationModule_GetRules(t *testing.T) {
	m := NewCombinationModule()
	rules := m.GetRules()
	if len(rules) == 0 {
		t.Fatal("expected at least one rule")
	}
	for _, r := range rules {
		if r.ID == "" {
			t.Fatal("rule missing ID")
		}
	}
}

func TestCombinationModule_SaveRestoreState(t *testing.T) {
	m := NewCombinationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true, "glove": true}
	m.mu.Unlock()
	_ = m.HandleMessage(context.Background(), playerID,
		"combine", json.RawMessage(`{"evidence_ids":["knife","glove"]}`))

	gs, err := m.SaveState(context.Background())
	if err != nil {
		t.Fatalf("SaveState: %v", err)
	}
	if _, ok := gs.Modules["combination"]; !ok {
		t.Fatal("expected combination key in saved state")
	}

	m2 := NewCombinationModule()
	if err := m2.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init m2: %v", err)
	}
	if err := m2.RestoreState(context.Background(), uuid.New(), gs); err != nil {
		t.Fatalf("RestoreState: %v", err)
	}

	m2.mu.RLock()
	found := false
	for _, id := range m2.completed[playerID] {
		if id == "combo1" {
			found = true
		}
	}
	m2.mu.RUnlock()
	if !found {
		t.Fatal("combo1 not in completed after restore")
	}
}

func TestCombinationModule_BuildState(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	data, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var s combinationState
	if err := json.Unmarshal(data, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
}

// Phase 19 PR-2c (D-MO-1): BuildStateFor must expose only the caller's own
// completed/derived sets, never peer progress.
func TestCombinationModule_BuildStateFor_OnlyCallerVisible(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	bob := uuid.New()

	m.mu.Lock()
	m.completed[alice] = []string{"combo1"}
	m.derived[alice] = []string{"weapon_set"}
	m.completed[bob] = []string{"combo2"}
	m.derived[bob] = []string{"motive"}
	m.mu.Unlock()

	raw, err := m.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor(alice): %v", err)
	}
	var s combinationState
	if err := json.Unmarshal(raw, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	aliceKey := alice.String()
	bobKey := bob.String()

	if got := s.Completed[aliceKey]; len(got) != 1 || got[0] != "combo1" {
		t.Errorf("alice completed: got %v, want [combo1]", got)
	}
	if got := s.Derived[aliceKey]; len(got) != 1 || got[0] != "weapon_set" {
		t.Errorf("alice derived: got %v, want [weapon_set]", got)
	}
	if _, ok := s.Completed[bobKey]; ok {
		t.Errorf("alice snapshot leaked bob completed: %v", s.Completed)
	}
	if _, ok := s.Derived[bobKey]; ok {
		t.Errorf("alice snapshot leaked bob derived: %v", s.Derived)
	}
}

// Phase 19 PR-2c: a player with no combination progress must get empty (non-nil)
// maps so the JSON shape stays `{}` — never `null` — and never mirrors peers.
func TestCombinationModule_BuildStateFor_EmptyForNewPlayer(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	newbie := uuid.New()

	m.mu.Lock()
	m.completed[alice] = []string{"combo1"}
	m.derived[alice] = []string{"weapon_set"}
	m.collected[alice] = map[string]bool{"knife": true, "glove": true}
	m.mu.Unlock()

	raw, err := m.BuildStateFor(newbie)
	if err != nil {
		t.Fatalf("BuildStateFor(newbie): %v", err)
	}

	// Root keys must exist and decode to empty objects, not null.
	var probe struct {
		Completed map[string][]string `json:"completed"`
		Derived   map[string][]string `json:"derived"`
		Collected map[string][]string `json:"collected"`
	}
	if err := json.Unmarshal(raw, &probe); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if probe.Completed == nil || probe.Derived == nil || probe.Collected == nil {
		t.Fatalf("expected non-nil maps, got %q", raw)
	}
	if len(probe.Completed) != 0 || len(probe.Derived) != 0 || len(probe.Collected) != 0 {
		t.Fatalf("newbie snapshot not empty: %q", raw)
	}

	// And no trace of alice may appear in the newbie's view.
	if got := string(raw); got != "{}" && !jsonIsEmptyShape(got) {
		// Smoke-check: alice's uuid must never show up.
		if strings.Contains(got, alice.String()) {
			t.Errorf("newbie snapshot leaked alice id: %s", got)
		}
	}
}

// Phase 19 PR-2c: collected evidence mirrored from the event bus must be
// per-player-scoped in the snapshot, so bob's collected inventory stays
// invisible to alice even when both players are active.
func TestCombinationModule_BuildStateFor_CollectedMirror(t *testing.T) {
	m := NewCombinationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	bob := uuid.New()

	// Drive the event bus exactly like the evidence module would.
	deps.EventBus.Publish(engine.Event{
		Type: "evidence.collected",
		Payload: map[string]any{
			"playerID":   alice,
			"evidenceID": "knife",
		},
	})
	deps.EventBus.Publish(engine.Event{
		Type: "evidence.collected",
		Payload: map[string]any{
			"playerID":   bob,
			"evidenceID": "note",
		},
	})

	raw, err := m.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor(alice): %v", err)
	}
	var s combinationState
	if err := json.Unmarshal(raw, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	aliceKey := alice.String()
	bobKey := bob.String()

	if got := s.Collected[aliceKey]; len(got) != 1 || got[0] != "knife" {
		t.Errorf("alice collected: got %v, want [knife]", got)
	}
	if _, ok := s.Collected[bobKey]; ok {
		t.Errorf("alice snapshot leaked bob collected: %v", s.Collected)
	}
	if strings.Contains(string(raw), "note") {
		t.Errorf("alice snapshot leaked bob evidence id 'note': %s", raw)
	}
}

// jsonIsEmptyShape allows for any of `{"completed":{},"derived":{},"collected":{}}` orderings.
func jsonIsEmptyShape(s string) bool {
	var probe struct {
		Completed map[string][]string `json:"completed"`
		Derived   map[string][]string `json:"derived"`
		Collected map[string][]string `json:"collected"`
	}
	if err := json.Unmarshal([]byte(s), &probe); err != nil {
		return false
	}
	return len(probe.Completed) == 0 && len(probe.Derived) == 0 && len(probe.Collected) == 0
}

// Phase 19 PR-2c hotfix: uuid.Nil must return an empty shape even when peers
// have state. Protects against stray zero-value playerIDs ever aliasing a
// real entry at the redaction layer.
func TestCombinationModule_BuildStateFor_NilUUIDEmpty(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	m.mu.Lock()
	m.completed[alice] = []string{"combo1"}
	m.derived[alice] = []string{"weapon_set"}
	m.collected[alice] = map[string]bool{"knife": true}
	m.mu.Unlock()

	raw, err := m.BuildStateFor(uuid.Nil)
	if err != nil {
		t.Fatalf("BuildStateFor(uuid.Nil): %v", err)
	}
	if !jsonIsEmptyShape(string(raw)) {
		t.Errorf("uuid.Nil snapshot must be empty shape, got %s", raw)
	}
	if strings.Contains(string(raw), alice.String()) {
		t.Errorf("uuid.Nil snapshot leaked alice id: %s", raw)
	}
}

// Phase 19 PR-2c hotfix: Collected slice must be sorted for deterministic
// JSON — map iteration order is non-deterministic in Go, causing spurious
// diffs between otherwise identical snapshots on reconnect / diff paths.
func TestCombinationModule_BuildStateFor_CollectedSortedStable(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	m.mu.Lock()
	m.collected[alice] = map[string]bool{"zeta": true, "alpha": true, "mike": true, "bravo": true}
	m.mu.Unlock()

	// Marshal twice and ensure byte identity — the fix must survive map
	// iteration randomisation across calls.
	r1, err := m.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor first call: %v", err)
	}
	r2, err := m.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor second call: %v", err)
	}
	if string(r1) != string(r2) {
		t.Errorf("BuildStateFor not deterministic between calls:\n  %s\n  %s", r1, r2)
	}

	// And the collected slice must be in ascending ASCII order.
	var s combinationState
	if err := json.Unmarshal(r1, &s); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	got := s.Collected[alice.String()]
	want := []string{"alpha", "bravo", "mike", "zeta"}
	if len(got) != len(want) {
		t.Fatalf("collected length: got %d, want %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("collected[%d]: got %q, want %q", i, got[i], want[i])
		}
	}
}

// Phase 19 PR-2c hotfix (HIGH): handleCombine must not publish events while
// holding m.mu.Lock. Any subscriber calling a method that takes m.mu
// (legitimate now that BuildStateFor is a live broadcast path) would
// deadlock. This test plants such a subscriber and asserts that the combine
// call + the callback both complete promptly.
func TestCombinationModule_HandleCombine_NoDeadlockDuringPublish(t *testing.T) {
	m := NewCombinationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true, "glove": true}
	m.mu.Unlock()

	callbackDone := make(chan error, 1)
	deps.EventBus.Subscribe("combination.completed", func(_ engine.Event) {
		// Re-enter the module through a BuildStateFor call. This takes
		// m.mu.RLock internally; if handleCombine still held m.mu.Lock it
		// would block forever.
		_, err := m.BuildStateFor(playerID)
		callbackDone <- err
	})

	combineDone := make(chan error, 1)
	go func() {
		combineDone <- m.HandleMessage(context.Background(), playerID,
			"combine", json.RawMessage(`{"evidence_ids":["knife","glove"]}`))
	}()

	select {
	case err := <-combineDone:
		if err != nil {
			t.Fatalf("HandleMessage combine: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("HandleMessage deadlocked — likely holding m.mu across Publish")
	}

	select {
	case err := <-callbackDone:
		if err != nil {
			t.Fatalf("subscriber BuildStateFor: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("combination.completed subscriber never reached BuildStateFor — deadlock or missed publish")
	}
}

// Phase 19 PR-2c hotfix: concurrent BuildStateFor fan-out (broadcast to N
// players in parallel) must not race with handleCombine writes. go test
// -race will flag any missed lock or unsynchronised map access.
func TestCombinationModule_BuildStateFor_ConcurrentBroadcast(t *testing.T) {
	m := NewCombinationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}

	const n = 16
	players := make([]uuid.UUID, n)
	m.mu.Lock()
	for i := range players {
		players[i] = uuid.New()
		m.collected[players[i]] = map[string]bool{"knife": true, "glove": true}
	}
	m.mu.Unlock()

	var wg sync.WaitGroup
	// Fan out BuildStateFor across all players while one player actively
	// triggers a combine. The combine writes to m.completed / m.derived
	// under Lock; the readers take RLock in snapshotFor.
	wg.Add(n + 1)
	go func() {
		defer wg.Done()
		_ = m.HandleMessage(context.Background(), players[0],
			"combine", json.RawMessage(`{"evidence_ids":["knife","glove"]}`))
	}()
	for i := 0; i < n; i++ {
		go func(pid uuid.UUID) {
			defer wg.Done()
			for j := 0; j < 32; j++ {
				if _, err := m.BuildStateFor(pid); err != nil {
					t.Errorf("BuildStateFor: %v", err)
					return
				}
			}
		}(players[i])
	}
	wg.Wait()
}

// Phase 20 PR-5: GroupID shortcut — clients can pass `group_id` to match
// a specific clue_edge_groups row directly instead of relying on InputIDs
// set equality.
func TestCombinationModule_HandleMessage_Combine_ByGroupID(t *testing.T) {
	m := NewCombinationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true, "glove": true}
	m.mu.Unlock()

	err := m.HandleMessage(context.Background(), playerID,
		"combine", json.RawMessage(`{"group_id":"combo1","evidence_ids":["knife","glove"]}`))
	if err != nil {
		t.Fatalf("combine by group_id: %v", err)
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	if len(m.completed[playerID]) != 1 || m.completed[playerID][0] != "combo1" {
		t.Fatalf("expected combo1 completed, got %v", m.completed[playerID])
	}
}

// Phase 20 PR-5: GroupID with mismatched inputs must be rejected (protect
// against clients sending a group id whose InputIDs don't match evidence_ids).
func TestCombinationModule_HandleMessage_Combine_GroupIDMismatch(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"note": true}
	m.mu.Unlock()

	// combo1 = knife+glove, but we send note → must reject.
	err := m.HandleMessage(context.Background(), playerID,
		"combine", json.RawMessage(`{"group_id":"combo1","evidence_ids":["note"]}`))
	if err == nil {
		t.Fatal("expected mismatch error")
	}
}

// Phase 20 PR-5: after a successful combine, the derived output clue lands
// in the `crafted` set. A subsequent graph.Resolve through checkNewCombos
// should see it as available — verifying the crafted wiring is live.
func TestCombinationModule_CraftedSetSurfacesOutput(t *testing.T) {
	m := NewCombinationModule()
	deps := newTestDeps()
	if err := m.Init(context.Background(), deps, combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	playerID := uuid.New()
	m.mu.Lock()
	m.collected[playerID] = map[string]bool{"knife": true, "glove": true}
	m.mu.Unlock()

	if err := m.HandleMessage(context.Background(), playerID,
		"combine", json.RawMessage(`{"evidence_ids":["knife","glove"]}`)); err != nil {
		t.Fatalf("combine: %v", err)
	}

	// After combine, derived holds weapon_set. craftedAsClueMap should
	// reflect it.
	m.mu.RLock()
	crafted := m.craftedAsClueMap(playerID)
	m.mu.RUnlock()
	if !crafted["weapon_set"] {
		t.Fatalf("expected crafted[weapon_set]=true, got %v", crafted)
	}
}

func TestCombinationModule_Cleanup(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	if err := m.Cleanup(context.Background()); err != nil {
		t.Fatalf("Cleanup: %v", err)
	}
	m.mu.RLock()
	if m.comboByID != nil {
		t.Fatal("expected nil comboByID after cleanup")
	}
	m.mu.RUnlock()
}

// Phase 19.1 PR-C: multi-player (3+) redaction matrix using the shared
// PeerLeakAssert helper from engine/testutil. Each player in a 3-player
// session has distinct completed/derived sets; iterating the caller guarantees
// no peer UUID leaks into anyone's snapshot.
func TestCombinationModule_BuildStateFor_ThreePlayersTable_NoPeerLeak(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	bob := uuid.New()
	charlie := uuid.New()

	m.mu.Lock()
	m.completed[alice] = []string{"combo1"}
	m.derived[alice] = []string{"weapon_set"}
	m.collected[alice] = map[string]bool{"knife": true, "glove": true}
	m.completed[bob] = []string{"combo2"}
	m.derived[bob] = []string{"motive"}
	m.collected[bob] = map[string]bool{"note": true}
	// charlie: no progress — must receive an empty but well-formed shape.
	m.mu.Unlock()

	cases := []struct {
		name       string
		caller     uuid.UUID
		peers      []uuid.UUID
		wantCaller bool // expect caller.String() to appear in raw (false for zero-state)
	}{
		{"alice", alice, []uuid.UUID{bob, charlie}, true},
		{"bob", bob, []uuid.UUID{alice, charlie}, true},
		{"charlie_zero_state", charlie, []uuid.UUID{alice, bob}, false},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			raw, err := m.BuildStateFor(tc.caller)
			if err != nil {
				t.Fatalf("BuildStateFor(%s): %v", tc.name, err)
			}
			testutil.PeerLeakAssert(t, raw, tc.caller, tc.peers...)
			if tc.wantCaller {
				testutil.AssertContainsCaller(t, raw, tc.caller)
			}
		})
	}
}

// Phase 19.1 PR-C: after SaveState / RestoreState round-trip, BuildStateFor
// must continue to emit only the caller's entries. Regression against a drift
// where Restore reconstitutes maps under different keys and the per-player
// filter silently fails to match.
func TestCombinationModule_BuildStateFor_AfterRestoreState_PreservesRedaction(t *testing.T) {
	src := NewCombinationModule()
	if err := src.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init src: %v", err)
	}
	alice := uuid.New()
	bob := uuid.New()
	src.mu.Lock()
	src.completed[alice] = []string{"combo1"}
	src.derived[alice] = []string{"weapon_set"}
	src.completed[bob] = []string{"combo2"}
	src.derived[bob] = []string{"motive"}
	src.mu.Unlock()

	gs, err := src.SaveState(context.Background())
	if err != nil {
		t.Fatalf("SaveState: %v", err)
	}

	dst := NewCombinationModule()
	if err := dst.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init dst: %v", err)
	}
	if err := dst.RestoreState(context.Background(), uuid.New(), gs); err != nil {
		t.Fatalf("RestoreState: %v", err)
	}

	rawAlice, err := dst.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor(alice): %v", err)
	}
	testutil.AssertContainsCaller(t, rawAlice, alice)
	testutil.PeerLeakAssert(t, rawAlice, alice, bob)

	rawBob, err := dst.BuildStateFor(bob)
	if err != nil {
		t.Fatalf("BuildStateFor(bob): %v", err)
	}
	testutil.AssertContainsCaller(t, rawBob, bob)
	testutil.PeerLeakAssert(t, rawBob, bob, alice)
}

// Phase 19.1 PR-C: verify that engine.BuildModuleStateFor correctly dispatches
// to CombinationModule.BuildStateFor (PlayerAware path, not BuildState
// fallback). This pins the engine-level wiring that PR-2a installed.
func TestCombinationModule_BuildStateFor_ViaEngineDispatch(t *testing.T) {
	m := NewCombinationModule()
	if err := m.Init(context.Background(), newTestDeps(), combinationCfg()); err != nil {
		t.Fatalf("Init: %v", err)
	}
	alice := uuid.New()
	bob := uuid.New()
	m.mu.Lock()
	m.completed[alice] = []string{"combo1"}
	m.derived[alice] = []string{"weapon_set"}
	m.completed[bob] = []string{"combo2"}
	m.derived[bob] = []string{"motive"}
	m.mu.Unlock()

	// engine.BuildModuleStateFor dispatches to PlayerAwareModule.BuildStateFor
	// when the module satisfies the interface. If this ever regresses to
	// m.BuildState() fallback (e.g. through a refactor removing the
	// PlayerAwareModule interface assertion), the assert below will catch it
	// because bob's UUID would leak into alice's payload.
	raw, err := engine.BuildModuleStateFor(m, alice)
	if err != nil {
		t.Fatalf("BuildModuleStateFor(alice): %v", err)
	}
	testutil.AssertContainsCaller(t, raw, alice)
	testutil.PeerLeakAssert(t, raw, alice, bob)

	// Second player — same assertion flipped.
	raw2, err := engine.BuildModuleStateFor(m, bob)
	if err != nil {
		t.Fatalf("BuildModuleStateFor(bob): %v", err)
	}
	testutil.AssertContainsCaller(t, raw2, bob)
	testutil.PeerLeakAssert(t, raw2, bob, alice)

	// Sanity: BuildState() DOES contain both (reserved for persistence).
	// This is not a security failure — it confirms the internal path exists
	// and why the pub method needs the godoc boundary added in PR-A.
	all, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	if !strings.Contains(string(all), alice.String()) || !strings.Contains(string(all), bob.String()) {
		t.Errorf("BuildState should include both players (persistence view), got %s", all)
	}
}
