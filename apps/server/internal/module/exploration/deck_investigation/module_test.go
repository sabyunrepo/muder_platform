package deck_investigation

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/engine"
)

func TestModule_InitAndGrantInvestigationToken(t *testing.T) {
	alice := uuid.New()
	bob := uuid.New()
	module := NewModule()
	deps := engine.ModuleDeps{
		EventBus: engine.NewEventBus(nil),
		PlayerInfoProvider: rosterProvider{
			players: []engine.PlayerRuntimeInfo{
				{PlayerID: alice, TargetCode: "char-alice"},
				{PlayerID: bob, TargetCode: "char-bob"},
			},
		},
	}
	config := json.RawMessage(`{"tokens":[{"id":"coin","defaultAmount":1}],"decks":[]}`)
	if err := module.Init(context.Background(), deps, config); err != nil {
		t.Fatalf("Init: %v", err)
	}

	params := json.RawMessage(`{"tokenId":"coin","amount":2}`)
	if err := module.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionGrantInvestigationToken,
		Params: params,
	}); err != nil {
		t.Fatalf("ReactTo grant: %v", err)
	}

	state := decodeModuleState(t, module)
	if got := state.Tokens.ByCharacter["char-alice"]["coin"]; got != 3 {
		t.Fatalf("alice coin = %d, want 3", got)
	}
	if got := state.Tokens.ByCharacter["char-bob"]["coin"]; got != 3 {
		t.Fatalf("bob coin = %d, want 3", got)
	}
}

func TestModule_ResetInvestigationTokenForCharacter(t *testing.T) {
	module := NewModule()
	config := json.RawMessage(`{"tokens":[{"id":"coin","defaultAmount":1}],"decks":[]}`)
	if err := module.Init(context.Background(), engine.ModuleDeps{EventBus: engine.NewEventBus(nil)}, config); err != nil {
		t.Fatalf("Init: %v", err)
	}

	grant := json.RawMessage(`{"tokenId":"coin","amount":4,"target":{"type":"character","character_id":"char-late"}}`)
	if err := module.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionGrantInvestigationToken,
		Params: grant,
	}); err != nil {
		t.Fatalf("ReactTo grant: %v", err)
	}
	reset := json.RawMessage(`{"tokenId":"coin","target":{"type":"character","character_id":"char-late"}}`)
	if err := module.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionResetInvestigationToken,
		Params: reset,
	}); err != nil {
		t.Fatalf("ReactTo reset: %v", err)
	}

	state := decodeModuleState(t, module)
	if got := state.Tokens.ByCharacter["char-late"]["coin"]; got != 1 {
		t.Fatalf("char-late coin = %d, want 1", got)
	}
}

func TestModule_ResetInvestigationTokenToZero(t *testing.T) {
	module := NewModule()
	config := json.RawMessage(`{"tokens":[{"id":"coin","defaultAmount":2}],"decks":[]}`)
	if err := module.Init(context.Background(), engine.ModuleDeps{EventBus: engine.NewEventBus(nil)}, config); err != nil {
		t.Fatalf("Init: %v", err)
	}

	grant := json.RawMessage(`{"tokenId":"coin","amount":4,"target":{"type":"character","character_id":"char-late"}}`)
	if err := module.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionGrantInvestigationToken,
		Params: grant,
	}); err != nil {
		t.Fatalf("ReactTo grant: %v", err)
	}
	reset := json.RawMessage(`{"tokenId":"coin","mode":"zero","target":{"type":"character","character_id":"char-late"}}`)
	if err := module.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionResetInvestigationToken,
		Params: reset,
	}); err != nil {
		t.Fatalf("ReactTo reset: %v", err)
	}

	state := decodeModuleState(t, module)
	if got := state.Tokens.ByCharacter["char-late"]["coin"]; got != 0 {
		t.Fatalf("char-late coin = %d, want 0", got)
	}
}

func TestModule_RejectsUnsupportedInvestigationTokenResetMode(t *testing.T) {
	module := NewModule()
	config := json.RawMessage(`{"tokens":[{"id":"coin","defaultAmount":1}],"decks":[]}`)
	if err := module.Init(context.Background(), engine.ModuleDeps{}, config); err != nil {
		t.Fatalf("Init: %v", err)
	}

	err := module.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionResetInvestigationToken,
		Params: json.RawMessage(`{"tokenId":"coin","mode":"unsupported"}`),
	})
	if err == nil {
		t.Fatal("expected unsupported reset mode error")
	}
}

func TestModule_RejectsUnknownTokenAction(t *testing.T) {
	module := NewModule()
	config := json.RawMessage(`{"tokens":[{"id":"coin","defaultAmount":1}],"decks":[]}`)
	if err := module.Init(context.Background(), engine.ModuleDeps{}, config); err != nil {
		t.Fatalf("Init: %v", err)
	}

	err := module.ReactTo(context.Background(), engine.PhaseActionPayload{
		Action: engine.ActionGrantInvestigationToken,
		Params: json.RawMessage(`{"tokenId":"missing","amount":1}`),
	})
	if err == nil {
		t.Fatal("expected unknown token error")
	}
}

type moduleState struct {
	Tokens struct {
		ByCharacter map[string]map[string]int `json:"byCharacter"`
	} `json:"tokens"`
}

func decodeModuleState(t *testing.T, module *Module) moduleState {
	t.Helper()
	raw, err := module.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	var state moduleState
	if err := json.Unmarshal(raw, &state); err != nil {
		t.Fatalf("Unmarshal state: %v", err)
	}
	return state
}

type rosterProvider struct {
	players []engine.PlayerRuntimeInfo
}

func (r rosterProvider) ResolvePlayerID(_ context.Context, targetCode string) (uuid.UUID, bool) {
	for _, player := range r.players {
		if player.TargetCode == targetCode || player.PlayerID.String() == targetCode {
			return player.PlayerID, true
		}
	}
	return uuid.Nil, false
}

func (r rosterProvider) PlayerRuntimeInfo(_ context.Context, playerID uuid.UUID) (engine.PlayerRuntimeInfo, bool) {
	for _, player := range r.players {
		if player.PlayerID == playerID {
			return player, true
		}
	}
	return engine.PlayerRuntimeInfo{}, false
}

func (r rosterProvider) PlayerRuntimeRoster(_ context.Context) []engine.PlayerRuntimeInfo {
	return append([]engine.PlayerRuntimeInfo(nil), r.players...)
}
