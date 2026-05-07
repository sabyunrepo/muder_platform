package informationdelivery

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/engine"
)

type testLogger struct{ t *testing.T }

func (l testLogger) Printf(format string, v ...any) {
	l.t.Helper()
	l.t.Logf(format, v...)
}

type testPlayerProvider struct {
	byID     map[uuid.UUID]engine.PlayerRuntimeInfo
	byTarget map[string]uuid.UUID
}

func (p testPlayerProvider) ResolvePlayerID(_ context.Context, targetCode string) (uuid.UUID, bool) {
	id, ok := p.byTarget[targetCode]
	return id, ok
}

func (p testPlayerProvider) PlayerRuntimeInfo(_ context.Context, playerID uuid.UUID) (engine.PlayerRuntimeInfo, bool) {
	info, ok := p.byID[playerID]
	return info, ok
}

func newTestModule(t *testing.T, provider engine.PlayerInfoProvider) *Module {
	t.Helper()
	m := NewModule()
	err := m.Init(context.Background(), engine.ModuleDeps{
		SessionID:          uuid.New(),
		EventBus:           engine.NewEventBus(testLogger{t}),
		Logger:             testLogger{t},
		PlayerInfoProvider: provider,
	}, nil)
	if err != nil {
		t.Fatalf("Init: %v", err)
	}
	return m
}

func decodeState(t *testing.T, raw json.RawMessage) moduleState {
	t.Helper()
	var state moduleState
	if err := json.Unmarshal(raw, &state); err != nil {
		t.Fatalf("unmarshal state: %v", err)
	}
	return state
}

func TestModule_DeliversOnlyToTargetCharacter(t *testing.T) {
	alice := uuid.New()
	bob := uuid.New()
	provider := testPlayerProvider{
		byID: map[uuid.UUID]engine.PlayerRuntimeInfo{
			alice: {PlayerID: alice, TargetCode: "char-alice"},
			bob:   {PlayerID: bob, TargetCode: "char-bob"},
		},
		byTarget: map[string]uuid.UUID{"char-alice": alice, "char-bob": bob},
	}
	m := newTestModule(t, provider)

	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionDeliverInformation,
		Params: json.RawMessage(`{"deliveries":[{"id":"d1","target":{"type":"character","character_id":"char-alice"},"reading_section_ids":["rs-2","rs-1","rs-1"]}]}`),
	})
	if err != nil {
		t.Fatalf("ReactTo: %v", err)
	}

	aliceState := mustStateFor(t, m, alice)
	bobState := mustStateFor(t, m, bob)

	if got := decodeState(t, aliceState).VisibleReadingSectionIDs; len(got) != 2 || got[0] != "rs-1" || got[1] != "rs-2" {
		t.Fatalf("alice visible sections = %#v", got)
	}
	if got := decodeState(t, bobState).VisibleReadingSectionIDs; len(got) != 0 {
		t.Fatalf("bob should not see alice sections, got %#v", got)
	}
}

func TestModule_DeliversStoryInfoOnlyToTargetCharacter(t *testing.T) {
	alice := uuid.New()
	bob := uuid.New()
	provider := testPlayerProvider{
		byID: map[uuid.UUID]engine.PlayerRuntimeInfo{
			alice: {PlayerID: alice, TargetCode: "char-alice"},
			bob:   {PlayerID: bob, TargetCode: "char-bob"},
		},
		byTarget: map[string]uuid.UUID{"char-alice": alice, "char-bob": bob},
	}
	m := newTestModule(t, provider)

	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionDeliverInformation,
		Params: json.RawMessage(`{"deliveries":[{"id":"d1","target":{"type":"character","character_id":"char-alice"},"story_info_ids":["info-2","info-1","info-1"]}]}`),
	})
	if err != nil {
		t.Fatalf("ReactTo: %v", err)
	}

	aliceState := decodeState(t, mustStateFor(t, m, alice))
	bobState := decodeState(t, mustStateFor(t, m, bob))

	if got := aliceState.VisibleStoryInfoIDs; len(got) != 2 || got[0] != "info-1" || got[1] != "info-2" {
		t.Fatalf("alice visible story info = %#v", got)
	}
	if got := aliceState.VisibleReadingSectionIDs; len(got) != 0 {
		t.Fatalf("story info delivery should not create reading sections, got %#v", got)
	}
	if got := aliceState.Deliveries[0].StoryInfoIDs; len(got) != 2 || got[0] != "info-1" || got[1] != "info-2" {
		t.Fatalf("alice delivery story info = %#v", got)
	}
	if got := bobState.VisibleStoryInfoIDs; len(got) != 0 {
		t.Fatalf("bob should not see alice story info, got %#v", got)
	}
}

func TestModule_DeliversReadingAndStoryInfoWithoutMixing(t *testing.T) {
	alice := uuid.New()
	m := newTestModule(t, nil)
	action := engine.PhaseActionPayload{
		Action: engine.ActionDeliverInformation,
		Params: json.RawMessage(`{"deliveries":[{"id":"mixed","target":{"type":"all_players"},"reading_section_ids":["rs-common"],"story_info_ids":["info-common"]}]}`),
	}
	if err := m.ReactTo(context.Background(), action); err != nil {
		t.Fatalf("ReactTo first: %v", err)
	}
	if err := m.ReactTo(context.Background(), action); err != nil {
		t.Fatalf("ReactTo second: %v", err)
	}

	state := decodeState(t, mustStateFor(t, m, alice))
	if got := state.VisibleReadingSectionIDs; len(got) != 1 || got[0] != "rs-common" {
		t.Fatalf("visible sections = %#v", got)
	}
	if got := state.VisibleStoryInfoIDs; len(got) != 1 || got[0] != "info-common" {
		t.Fatalf("visible story info = %#v", got)
	}
	if len(state.Deliveries) != 1 || state.Deliveries[0].DeliveryID != "mixed" {
		t.Fatalf("deliveries should not duplicate: %#v", state.Deliveries)
	}
	if got := state.Deliveries[0].ReadingSectionIDs; len(got) != 1 || got[0] != "rs-common" {
		t.Fatalf("delivery sections = %#v", got)
	}
	if got := state.Deliveries[0].StoryInfoIDs; len(got) != 1 || got[0] != "info-common" {
		t.Fatalf("delivery story info = %#v", got)
	}
}

func TestModule_AllPlayersAndReentryAreIdempotent(t *testing.T) {
	alice := uuid.New()
	m := newTestModule(t, nil)
	action := engine.PhaseActionPayload{
		Action: engine.ActionDeliverInformation,
		Params: json.RawMessage(`{"deliveries":[{"id":"all","target":{"type":"all_players"},"reading_section_ids":["rs-common"]}]}`),
	}
	if err := m.ReactTo(context.Background(), action); err != nil {
		t.Fatalf("ReactTo first: %v", err)
	}
	if err := m.ReactTo(context.Background(), action); err != nil {
		t.Fatalf("ReactTo second: %v", err)
	}

	state := decodeState(t, mustStateFor(t, m, alice))
	if len(state.VisibleReadingSectionIDs) != 1 || state.VisibleReadingSectionIDs[0] != "rs-common" {
		t.Fatalf("visible sections = %#v", state.VisibleReadingSectionIDs)
	}
	if len(state.Deliveries) != 1 || state.Deliveries[0].DeliveryID != "all" {
		t.Fatalf("deliveries should not duplicate: %#v", state.Deliveries)
	}
}

func TestModule_InvalidParamsReturnError(t *testing.T) {
	m := newTestModule(t, nil)
	err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionDeliverInformation,
		Params: json.RawMessage(`{"deliveries":`),
	})
	if err == nil {
		t.Fatal("expected invalid params error")
	}
}

func TestModule_InvalidDeliveryConfigReturnsAppError(t *testing.T) {
	tests := []struct {
		name   string
		params json.RawMessage
	}{
		{
			name:   "empty content ids",
			params: json.RawMessage(`{"deliveries":[{"id":"empty","target":{"type":"all_players"}}]}`),
		},
		{
			name:   "missing character id",
			params: json.RawMessage(`{"deliveries":[{"id":"missing-character","target":{"type":"character"},"story_info_ids":["info-1"]}]}`),
		},
		{
			name:   "unsupported target type",
			params: json.RawMessage(`{"deliveries":[{"id":"bad-target","target":{"type":"room"},"story_info_ids":["info-1"]}]}`),
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			m := newTestModule(t, nil)
			err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
				Action: engine.ActionDeliverInformation,
				Params: tc.params,
			})
			var appErr *apperror.AppError
			if !errors.As(err, &appErr) {
				t.Fatalf("ReactTo error = %T %v, want *apperror.AppError", err, err)
			}
			if appErr.Code != apperror.ErrValidation {
				t.Fatalf("AppError code = %q, want %q", appErr.Code, apperror.ErrValidation)
			}
		})
	}
}

func mustStateFor(t *testing.T, m *Module, playerID uuid.UUID) json.RawMessage {
	t.Helper()
	state, err := m.BuildStateFor(playerID)
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	return state
}

func TestEnginePhaseEnterDeliversAndReconnectStatePersists(t *testing.T) {
	alice := uuid.New()
	bob := uuid.New()
	provider := testPlayerProvider{
		byID: map[uuid.UUID]engine.PlayerRuntimeInfo{
			alice: {PlayerID: alice, TargetCode: "char-alice"},
			bob:   {PlayerID: bob, TargetCode: "char-bob"},
		},
		byTarget: map[string]uuid.UUID{"char-alice": alice, "char-bob": bob},
	}
	bus := engine.NewEventBus(testLogger{t})
	module := NewModule()
	phases := []engine.PhaseDefinition{
		{
			ID:   "investigation",
			Name: "Investigation",
			OnEnter: json.RawMessage(`[
				{"type":"DELIVER_INFORMATION","params":{"deliveries":[
					{"id":"alice-only","target":{"type":"character","character_id":"char-alice"},"reading_section_ids":["rs-secret"]},
					{"id":"common","target":{"type":"all_players"},"reading_section_ids":["rs-common"]}
				]}}
			]`),
		},
	}
	pe := engine.NewPhaseEngine(uuid.New(), []engine.Module{module}, bus, nil, testLogger{t}, phases)
	pe.SetPlayerInfoProvider(provider)
	if err := pe.Start(context.Background(), map[string]json.RawMessage{module.Name(): nil}); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(context.Background())

	// Re-entering the same action must not duplicate the reconnect state.
	if err := module.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionDeliverInformation,
		Params: json.RawMessage(`{"deliveries":[{"id":"alice-only","target":{"type":"character","character_id":"char-alice"},"reading_section_ids":["rs-secret"]},{"id":"common","target":{"type":"all_players"},"reading_section_ids":["rs-common"]}]}`),
	}); err != nil {
		t.Fatalf("ReactTo retry: %v", err)
	}

	aliceState := decodeState(t, mustStateFor(t, module, alice))
	bobState := decodeState(t, mustStateFor(t, module, bob))
	if got := aliceState.VisibleReadingSectionIDs; len(got) != 2 || got[0] != "rs-common" || got[1] != "rs-secret" {
		t.Fatalf("alice reconnect state = %#v", got)
	}
	if got := bobState.VisibleReadingSectionIDs; len(got) != 1 || got[0] != "rs-common" {
		t.Fatalf("bob reconnect state = %#v", got)
	}
}

func TestEnginePhaseEnterDeliversStoryInfoAndReconnectStatePersists(t *testing.T) {
	alice := uuid.New()
	bob := uuid.New()
	provider := testPlayerProvider{
		byID: map[uuid.UUID]engine.PlayerRuntimeInfo{
			alice: {PlayerID: alice, TargetCode: "char-alice"},
			bob:   {PlayerID: bob, TargetCode: "char-bob"},
		},
		byTarget: map[string]uuid.UUID{"char-alice": alice, "char-bob": bob},
	}
	bus := engine.NewEventBus(testLogger{t})
	module := NewModule()
	phases := []engine.PhaseDefinition{
		{
			ID:   "investigation",
			Name: "Investigation",
			OnEnter: json.RawMessage(`[
				{"type":"DELIVER_INFORMATION","params":{"deliveries":[
					{"id":"alice-info","target":{"type":"character","character_id":"char-alice"},"story_info_ids":["info-secret"]},
					{"id":"common-info","target":{"type":"all_players"},"story_info_ids":["info-common"]}
				]}}
			]`),
		},
	}
	pe := engine.NewPhaseEngine(uuid.New(), []engine.Module{module}, bus, nil, testLogger{t}, phases)
	pe.SetPlayerInfoProvider(provider)
	if err := pe.Start(context.Background(), map[string]json.RawMessage{module.Name(): nil}); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(context.Background())

	aliceState := decodeState(t, mustStateFor(t, module, alice))
	bobState := decodeState(t, mustStateFor(t, module, bob))
	if got := aliceState.VisibleStoryInfoIDs; len(got) != 2 || got[0] != "info-common" || got[1] != "info-secret" {
		t.Fatalf("alice story info reconnect state = %#v", got)
	}
	if got := bobState.VisibleStoryInfoIDs; len(got) != 1 || got[0] != "info-common" {
		t.Fatalf("bob story info reconnect state = %#v", got)
	}
	if got := aliceState.VisibleReadingSectionIDs; len(got) != 0 {
		t.Fatalf("story info phase action should not create reading sections, got %#v", got)
	}
}

func TestModule_TargetCodeFallbackAndBuildState(t *testing.T) {
	m := newTestModule(t, nil)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionDeliverInformation,
		Params: json.RawMessage(`{"deliveries":[{"id":"fallback","target":{"type":"character","character_id":"char-late"},"reading_section_ids":["rs-late"]}]}`),
	}); err != nil {
		t.Fatalf("ReactTo: %v", err)
	}

	// BuildState is persistence/admin-facing and contains the union of delivered
	// sections; player-facing redaction is verified in BuildStateFor tests above.
	state := decodeState(t, mustBuildState(t, m))
	if len(state.VisibleReadingSectionIDs) != 1 || state.VisibleReadingSectionIDs[0] != "rs-late" {
		t.Fatalf("build state sections = %#v", state.VisibleReadingSectionIDs)
	}

	latePlayer := uuid.New()
	m.deps.PlayerInfoProvider = testPlayerProvider{
		byID: map[uuid.UUID]engine.PlayerRuntimeInfo{
			latePlayer: {PlayerID: latePlayer, TargetCode: "char-late"},
		},
		byTarget: map[string]uuid.UUID{"char-late": latePlayer},
	}
	playerState := decodeState(t, mustStateFor(t, m, latePlayer))
	if len(playerState.VisibleReadingSectionIDs) != 1 || playerState.VisibleReadingSectionIDs[0] != "rs-late" {
		t.Fatalf("late player sections = %#v", playerState.VisibleReadingSectionIDs)
	}
}

func TestModule_StoryInfoTargetCodeFallbackAndBuildState(t *testing.T) {
	m := newTestModule(t, nil)
	if err := m.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionDeliverInformation,
		Params: json.RawMessage(`{"deliveries":[{"id":"fallback","target":{"type":"character","character_id":"char-late"},"story_info_ids":["info-late"]}]}`),
	}); err != nil {
		t.Fatalf("ReactTo: %v", err)
	}

	state := decodeState(t, mustBuildState(t, m))
	if len(state.VisibleStoryInfoIDs) != 1 || state.VisibleStoryInfoIDs[0] != "info-late" {
		t.Fatalf("build state story info = %#v", state.VisibleStoryInfoIDs)
	}

	latePlayer := uuid.New()
	m.deps.PlayerInfoProvider = testPlayerProvider{
		byID: map[uuid.UUID]engine.PlayerRuntimeInfo{
			latePlayer: {PlayerID: latePlayer, TargetCode: "char-late"},
		},
		byTarget: map[string]uuid.UUID{"char-late": latePlayer},
	}
	playerState := decodeState(t, mustStateFor(t, m, latePlayer))
	if len(playerState.VisibleStoryInfoIDs) != 1 || playerState.VisibleStoryInfoIDs[0] != "info-late" {
		t.Fatalf("late player story info = %#v", playerState.VisibleStoryInfoIDs)
	}
}

func TestModule_CleanupAndUnknownMessage(t *testing.T) {
	m := newTestModule(t, nil)
	if err := m.HandleMessage(context.Background(), uuid.New(), "noop", nil); err == nil {
		t.Fatal("expected unknown message error")
	}
	if err := m.Cleanup(context.Background()); err != nil {
		t.Fatalf("Cleanup: %v", err)
	}
}

func mustBuildState(t *testing.T, m *Module) json.RawMessage {
	t.Helper()
	state, err := m.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	return state
}

func TestModule_InvalidDeliverySemanticsReturnError(t *testing.T) {
	m := newTestModule(t, nil)
	tests := []struct {
		name   string
		params json.RawMessage
	}{
		{
			name:   "empty sections and story info",
			params: json.RawMessage(`{"deliveries":[{"id":"bad","target":{"type":"all_players"},"reading_section_ids":[]}]}`),
		},
		{
			name:   "missing character",
			params: json.RawMessage(`{"deliveries":[{"id":"bad","target":{"type":"character"},"reading_section_ids":["rs-1"]}]}`),
		},
		{
			name:   "unsupported target",
			params: json.RawMessage(`{"deliveries":[{"id":"bad","target":{"type":"room"},"reading_section_ids":["rs-1"]}]}`),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := m.ReactTo(context.Background(), engine.PhaseActionPayload{Action: engine.ActionDeliverInformation, Params: tt.params})
			if err == nil {
				t.Fatal("expected semantic validation error")
			}
		})
	}
}
