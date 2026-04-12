package clue

import (
	"testing"
)

var testPlayer = PlayerContext{
	PlayerID: "player-1",
	Role:     "detective",
	Team:     "blue",
}

func buildVisibilityGraph(t *testing.T) *Graph {
	t.Helper()
	g := NewGraph()
	for _, c := range []Clue{
		{ID: "public_clue", Name: "Public"},
		{ID: "det_only", Name: "Detective Only"},
		{ID: "hidden", Name: "Hidden from All"},
		{ID: "team_blue", Name: "Blue Team"},
		{ID: "player_specific", Name: "Player Specific"},
		{ID: "no_rules", Name: "No Rules"},
	} {
		if err := g.Add(c); err != nil {
			t.Fatal(err)
		}
	}
	return g
}

func TestComputeVisible_NoRules_AllVisible(t *testing.T) {
	g := buildVisibilityGraph(t)
	visible := ComputeVisible(g, nil, nil, testPlayer)
	// All 6 root clues should be visible when no rules.
	if len(visible) != 6 {
		t.Fatalf("expected 6 visible clues, got %d", len(visible))
	}
}

func TestComputeVisible_ScopeAll(t *testing.T) {
	g := buildVisibilityGraph(t)
	rules := []VisibilityRule{
		{ClueID: "public_clue", Scope: ScopeAll, Hidden: false},
	}
	visible := ComputeVisible(g, nil, rules, testPlayer)
	if !visible["public_clue"] {
		t.Fatal("public_clue should be visible")
	}
}

func TestComputeVisible_ScopeAll_Hidden(t *testing.T) {
	g := buildVisibilityGraph(t)
	rules := []VisibilityRule{
		{ClueID: "hidden", Scope: ScopeAll, Hidden: true},
	}
	visible := ComputeVisible(g, nil, rules, testPlayer)
	if visible["hidden"] {
		t.Fatal("hidden should NOT be visible")
	}
}

func TestComputeVisible_ScopeRole_Match(t *testing.T) {
	g := buildVisibilityGraph(t)
	rules := []VisibilityRule{
		{ClueID: "det_only", Scope: ScopeRole, Target: "detective", Hidden: false},
	}
	visible := ComputeVisible(g, nil, rules, testPlayer)
	if !visible["det_only"] {
		t.Fatal("det_only should be visible for detective")
	}
}

func TestComputeVisible_ScopeRole_NoMatch(t *testing.T) {
	g := buildVisibilityGraph(t)
	rules := []VisibilityRule{
		{ClueID: "det_only", Scope: ScopeRole, Target: "murderer", Hidden: false},
	}
	visible := ComputeVisible(g, nil, rules, testPlayer)
	if visible["det_only"] {
		t.Fatal("det_only should NOT be visible for non-murderer")
	}
}

func TestComputeVisible_ScopeTeam(t *testing.T) {
	g := buildVisibilityGraph(t)
	rules := []VisibilityRule{
		{ClueID: "team_blue", Scope: ScopeTeam, Target: "blue", Hidden: false},
	}
	visible := ComputeVisible(g, nil, rules, testPlayer)
	if !visible["team_blue"] {
		t.Fatal("team_blue should be visible for blue team")
	}

	other := PlayerContext{PlayerID: "p2", Role: "witness", Team: "red"}
	visible = ComputeVisible(g, nil, rules, other)
	if visible["team_blue"] {
		t.Fatal("team_blue should NOT be visible for red team")
	}
}

func TestComputeVisible_ScopePlayer(t *testing.T) {
	g := buildVisibilityGraph(t)
	rules := []VisibilityRule{
		{ClueID: "player_specific", Scope: ScopePlayer, Target: "player-1", Hidden: false},
	}
	visible := ComputeVisible(g, nil, rules, testPlayer)
	if !visible["player_specific"] {
		t.Fatal("player_specific should be visible for player-1")
	}

	other := PlayerContext{PlayerID: "player-2", Role: "detective", Team: "blue"}
	visible = ComputeVisible(g, nil, rules, other)
	if visible["player_specific"] {
		t.Fatal("player_specific should NOT be visible for player-2")
	}
}

func TestComputeVisible_SpecificOverridesGeneral(t *testing.T) {
	g := buildVisibilityGraph(t)
	rules := []VisibilityRule{
		{ClueID: "det_only", Scope: ScopeAll, Hidden: true},
		{ClueID: "det_only", Scope: ScopeRole, Target: "detective", Hidden: false},
	}
	visible := ComputeVisible(g, nil, rules, testPlayer)
	if !visible["det_only"] {
		t.Fatal("role grant should override all-hidden")
	}
}

func TestComputeVisible_HiddenOverridesGrantAtSameLevel(t *testing.T) {
	g := buildVisibilityGraph(t)
	rules := []VisibilityRule{
		{ClueID: "det_only", Scope: ScopeRole, Target: "detective", Hidden: false},
		{ClueID: "det_only", Scope: ScopeRole, Target: "detective", Hidden: true},
	}
	visible := ComputeVisible(g, nil, rules, testPlayer)
	if visible["det_only"] {
		t.Fatal("hidden should win at same specificity")
	}
}

func TestComputeVisible_PlayerOverridesRole(t *testing.T) {
	g := buildVisibilityGraph(t)
	rules := []VisibilityRule{
		{ClueID: "player_specific", Scope: ScopeRole, Target: "detective", Hidden: true},
		{ClueID: "player_specific", Scope: ScopePlayer, Target: "player-1", Hidden: false},
	}
	visible := ComputeVisible(g, nil, rules, testPlayer)
	if !visible["player_specific"] {
		t.Fatal("player-level grant should override role-level hidden")
	}
}

func TestComputeVisible_UnavailableCluesExcluded(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "root", Name: "Root"})
	g.Add(Clue{ID: "locked", Name: "Locked"})
	g.AddDependency(Dependency{ClueID: "locked", Prerequisites: []ClueID{"root"}, Mode: ModeAND})

	rules := []VisibilityRule{
		{ClueID: "locked", Scope: ScopeAll, Hidden: false},
	}
	// locked is not available (root not discovered)
	visible := ComputeVisible(g, nil, rules, testPlayer)
	if visible["locked"] {
		t.Fatal("locked should NOT be visible when prerequisite not met")
	}

	// After discovering root, locked becomes available + visible
	visible = ComputeVisible(g, map[ClueID]bool{"root": true}, rules, testPlayer)
	if !visible["locked"] {
		t.Fatal("locked should be visible after root discovered")
	}
}

func TestComputeVisible_EmptyGraph(t *testing.T) {
	g := NewGraph()
	visible := ComputeVisible(g, nil, nil, testPlayer)
	if len(visible) != 0 {
		t.Fatalf("expected 0, got %d", len(visible))
	}
}

func TestComputeVisible_MultipleCluesMultipleRules(t *testing.T) {
	g := buildVisibilityGraph(t)
	rules := []VisibilityRule{
		{ClueID: "public_clue", Scope: ScopeAll, Hidden: false},
		{ClueID: "det_only", Scope: ScopeRole, Target: "detective", Hidden: false},
		{ClueID: "hidden", Scope: ScopeAll, Hidden: true},
		{ClueID: "team_blue", Scope: ScopeTeam, Target: "blue", Hidden: false},
		{ClueID: "player_specific", Scope: ScopePlayer, Target: "player-1", Hidden: false},
		// no_rules has no visibility rules → visible by default
	}

	visible := ComputeVisible(g, nil, rules, testPlayer)

	if !visible["public_clue"] {
		t.Error("public_clue should be visible")
	}
	if !visible["det_only"] {
		t.Error("det_only should be visible for detective")
	}
	if visible["hidden"] {
		t.Error("hidden should NOT be visible")
	}
	if !visible["team_blue"] {
		t.Error("team_blue should be visible for blue team")
	}
	if !visible["player_specific"] {
		t.Error("player_specific should be visible for player-1")
	}
	if !visible["no_rules"] {
		t.Error("no_rules should be visible (default)")
	}
}
