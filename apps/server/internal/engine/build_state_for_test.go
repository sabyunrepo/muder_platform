package engine

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
)

// playerAwareStubModule returns a JSON state that embeds the requested
// playerID so tests can confirm that BuildStateFor plumbs the player through.
type playerAwareStubModule struct {
	stubCoreModule
	publicState string
}

func (p *playerAwareStubModule) BuildState() (json.RawMessage, error) {
	return json.Marshal(map[string]string{"view": "public:" + p.publicState})
}

func (p *playerAwareStubModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	return json.Marshal(map[string]string{
		"view":   "private",
		"viewer": playerID.String(),
	})
}

type rosterProviderStub struct {
	players []PlayerRuntimeInfo
}

func (r rosterProviderStub) ResolvePlayerID(_ context.Context, targetCode string) (uuid.UUID, bool) {
	for _, player := range r.players {
		if player.PlayerID.String() == targetCode || player.TargetCode == targetCode {
			return player.PlayerID, true
		}
	}
	return uuid.Nil, false
}

func (r rosterProviderStub) PlayerRuntimeInfo(_ context.Context, playerID uuid.UUID) (PlayerRuntimeInfo, bool) {
	for _, player := range r.players {
		if player.PlayerID == playerID {
			return player, true
		}
	}
	return PlayerRuntimeInfo{}, false
}

func (r rosterProviderStub) PlayerRuntimeRoster(context.Context) []PlayerRuntimeInfo {
	return r.players
}

// TestPhaseEngine_BuildStateFor_TwoPlayersDiffer verifies that player-aware
// modules emit distinct state per player and that non-aware modules fall back
// to BuildState (identical across players).
func TestPhaseEngine_BuildStateFor_TwoPlayersDiffer(t *testing.T) {
	aware := &playerAwareStubModule{
		stubCoreModule: stubCoreModule{name: "secret"},
		publicState:    "never",
	}
	public := &stubCoreModule{name: "public_mod"}

	pe, _ := newTestPhaseEngine(t, []Module{aware, public}, testPhaseDefinitions)
	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	alice := uuid.New()
	bob := uuid.New()

	aState, err := pe.BuildStateFor(alice)
	if err != nil {
		t.Fatalf("BuildStateFor alice: %v", err)
	}
	bState, err := pe.BuildStateFor(bob)
	if err != nil {
		t.Fatalf("BuildStateFor bob: %v", err)
	}

	if string(aState) == string(bState) {
		t.Fatalf("expected player-aware states to differ, got identical payloads: %s", aState)
	}

	// Player-aware module must surface the requesting player's id in its state.
	if !strings.Contains(string(aState), alice.String()) {
		t.Errorf("alice state missing her id: %s", aState)
	}
	if !strings.Contains(string(bState), bob.String()) {
		t.Errorf("bob state missing his id: %s", bState)
	}

	// "never" is the public fallback value — it must NEVER appear in player-aware state.
	if strings.Contains(string(aState), "never") {
		t.Errorf("alice state leaked public fallback token: %s", aState)
	}

	// Non-aware modules must emit identical state across players.
	var aEnv, bEnv struct {
		Modules map[string]json.RawMessage `json:"modules"`
	}
	if err := json.Unmarshal(aState, &aEnv); err != nil {
		t.Fatalf("unmarshal alice: %v", err)
	}
	if err := json.Unmarshal(bState, &bEnv); err != nil {
		t.Fatalf("unmarshal bob: %v", err)
	}
	if string(aEnv.Modules["public_mod"]) != string(bEnv.Modules["public_mod"]) {
		t.Errorf("non-aware module differs: alice=%s bob=%s",
			aEnv.Modules["public_mod"], bEnv.Modules["public_mod"])
	}
	// Player-aware module must differ.
	if string(aEnv.Modules["secret"]) == string(bEnv.Modules["secret"]) {
		t.Errorf("player-aware module should differ: %s == %s",
			aEnv.Modules["secret"], bEnv.Modules["secret"])
	}
}

// TestBuildModuleStateFor_FallsBackWhenNotAware verifies the helper falls
// back to BuildState for modules that do not implement PlayerAwareModule.
func TestBuildModuleStateFor_FallsBackWhenNotAware(t *testing.T) {
	mod := &stubCoreModule{name: "plain"}
	want, err := mod.BuildState()
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}
	got, err := BuildModuleStateFor(mod, uuid.New())
	if err != nil {
		t.Fatalf("BuildModuleStateFor: %v", err)
	}
	if string(got) != string(want) {
		t.Errorf("fallback mismatch: got %s want %s", got, want)
	}
}

func TestPhaseEngine_BuildStateForIncludesResolvedRosterWithoutAliasRules(t *testing.T) {
	playerID := uuid.New()
	aliasIconMediaID := uuid.New().String()
	pe, _ := newTestPhaseEngine(t, []Module{&stubCoreModule{name: "public_mod"}}, testPhaseDefinitions)
	pe.SetPlayerInfoProvider(rosterProviderStub{players: []PlayerRuntimeInfo{{
		PlayerID:           playerID,
		TargetCode:         "char_witness",
		Nickname:           "참가자",
		Role:               "detective",
		IsAlive:            true,
		IsHost:             true,
		IsReady:            true,
		DisplayName:        "밤의 목격자",
		DisplayIconMediaID: &aliasIconMediaID,
	}}})

	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	raw, err := pe.BuildStateFor(playerID)
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	var body struct {
		Players []map[string]any `json:"players"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("unmarshal state: %v", err)
	}
	if len(body.Players) != 1 {
		t.Fatalf("players len = %d, want 1: %s", len(body.Players), raw)
	}
	player := body.Players[0]
	if player["displayName"] != "밤의 목격자" || player["nickname"] != "참가자" {
		t.Fatalf("player display mismatch: %+v", player)
	}
	if player["displayIconMediaId"] != aliasIconMediaID {
		t.Fatalf("displayIconMediaId = %v, want %s", player["displayIconMediaId"], aliasIconMediaID)
	}
	if _, leaked := player["alias_rules"]; leaked {
		t.Fatalf("player payload leaked alias_rules: %s", raw)
	}
	if _, leaked := player["targetCode"]; leaked {
		t.Fatalf("player payload leaked targetCode: %s", raw)
	}
}

func TestPhaseEngine_BuildStateForRosterSortsAndUsesNicknameFallback(t *testing.T) {
	earlyID := uuid.New()
	lateID := uuid.New()
	displayIconURL := "https://cdn.example/icon.png"
	pe, _ := newTestPhaseEngine(t, []Module{&stubCoreModule{name: "public_mod"}}, testPhaseDefinitions)
	pe.SetPlayerInfoProvider(rosterProviderStub{players: []PlayerRuntimeInfo{{
		PlayerID:       lateID,
		Nickname:       "두 번째 참가자",
		Role:           "",
		IsAlive:        true,
		ConnectedAt:    200,
		DisplayIconURL: &displayIconURL,
	}, {
		PlayerID:    earlyID,
		Nickname:    "첫 번째 참가자",
		Role:        "detective",
		IsAlive:     true,
		ConnectedAt: 100,
	}}})

	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	raw, err := pe.BuildStateFor(earlyID)
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	var body struct {
		Players []map[string]any `json:"players"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("unmarshal state: %v", err)
	}
	if len(body.Players) != 2 {
		t.Fatalf("players len = %d, want 2: %s", len(body.Players), raw)
	}
	if body.Players[0]["id"] != earlyID.String() {
		t.Fatalf("first player id = %v, want %s", body.Players[0]["id"], earlyID)
	}
	if body.Players[1]["displayName"] != "두 번째 참가자" {
		t.Fatalf("displayName fallback = %v, want nickname", body.Players[1]["displayName"])
	}
	if body.Players[1]["role"] != nil {
		t.Fatalf("empty role should be null, got %+v", body.Players[1]["role"])
	}
	if body.Players[1]["displayIconUrl"] != displayIconURL {
		t.Fatalf("displayIconUrl = %v, want %s", body.Players[1]["displayIconUrl"], displayIconURL)
	}
}

func TestPhaseEngine_BuildStateForIncludesEmptyRosterWhenProviderIsPresent(t *testing.T) {
	playerID := uuid.New()
	pe, _ := newTestPhaseEngine(t, []Module{&stubCoreModule{name: "public_mod"}}, testPhaseDefinitions)
	pe.SetPlayerInfoProvider(rosterProviderStub{})

	ctx := context.Background()
	if err := pe.Start(ctx, nil); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer pe.Stop(ctx)

	raw, err := pe.BuildStateFor(playerID)
	if err != nil {
		t.Fatalf("BuildStateFor: %v", err)
	}
	var body struct {
		Players []map[string]any `json:"players"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("unmarshal state: %v", err)
	}
	if body.Players == nil {
		t.Fatalf("players should be an empty array when roster provider is present: %s", raw)
	}
	if len(body.Players) != 0 {
		t.Fatalf("players len = %d, want 0", len(body.Players))
	}
}
