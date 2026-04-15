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
