package clue

import (
	"testing"
)

func buildSimpleGraph(t *testing.T) *Graph {
	t.Helper()
	g := NewGraph()
	for _, c := range []Clue{
		{ID: "knife", Name: "Bloody Knife"},
		{ID: "letter", Name: "Threatening Letter"},
		{ID: "alibi", Name: "Broken Alibi"},
		{ID: "motive", Name: "Hidden Motive"},
	} {
		if err := g.Add(c); err != nil {
			t.Fatal(err)
		}
	}
	// motive requires knife AND letter
	if err := g.AddDependency(Dependency{
		ClueID:        "motive",
		Prerequisites: []ClueID{"knife", "letter"},
		Mode:          ModeAND,
	}); err != nil {
		t.Fatal(err)
	}
	// alibi requires knife OR letter
	if err := g.AddDependency(Dependency{
		ClueID:        "alibi",
		Prerequisites: []ClueID{"knife", "letter"},
		Mode:          ModeOR,
	}); err != nil {
		t.Fatal(err)
	}
	return g
}

func TestGraph_Add(t *testing.T) {
	g := NewGraph()
	if err := g.Add(Clue{ID: "a", Name: "A"}); err != nil {
		t.Fatal(err)
	}
	if g.Len() != 1 {
		t.Fatalf("expected 1 clue, got %d", g.Len())
	}
}

func TestGraph_AddEmptyID(t *testing.T) {
	g := NewGraph()
	if err := g.Add(Clue{Name: "No ID"}); err == nil {
		t.Fatal("expected error for empty ID")
	}
}

func TestGraph_AddDuplicateID(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "a", Name: "A"})
	if err := g.Add(Clue{ID: "a", Name: "A2"}); err == nil {
		t.Fatal("expected error for duplicate ID")
	}
}

func TestGraph_AddDependency_MissingTarget(t *testing.T) {
	g := NewGraph()
	err := g.AddDependency(Dependency{ClueID: "missing", Prerequisites: nil, Mode: ModeAND})
	if err == nil {
		t.Fatal("expected error for missing target")
	}
}

func TestGraph_AddDependency_MissingPrereq(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "a", Name: "A"})
	err := g.AddDependency(Dependency{ClueID: "a", Prerequisites: []ClueID{"ghost"}, Mode: ModeAND})
	if err == nil {
		t.Fatal("expected error for missing prerequisite")
	}
}

func TestGraph_AddDependency_SelfLoop(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "a", Name: "A"})
	err := g.AddDependency(Dependency{ClueID: "a", Prerequisites: []ClueID{"a"}, Mode: ModeAND})
	if err == nil {
		t.Fatal("expected error for self-dependency")
	}
}

func TestGraph_AddDependency_InvalidMode(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "a", Name: "A"})
	g.Add(Clue{ID: "b", Name: "B"})
	err := g.AddDependency(Dependency{ClueID: "a", Prerequisites: []ClueID{"b"}, Mode: "XOR"})
	if err == nil {
		t.Fatal("expected error for invalid mode")
	}
}

func TestGraph_AddDependency_Duplicate(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "a", Name: "A"})
	g.Add(Clue{ID: "b", Name: "B"})
	g.AddDependency(Dependency{ClueID: "a", Prerequisites: []ClueID{"b"}, Mode: ModeAND})
	err := g.AddDependency(Dependency{ClueID: "a", Prerequisites: []ClueID{"b"}, Mode: ModeOR})
	if err == nil {
		t.Fatal("expected error for duplicate dependency")
	}
}

func TestGraph_Get(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "x", Name: "X"})
	c, ok := g.Get("x")
	if !ok || c.Name != "X" {
		t.Fatalf("expected clue X, got ok=%v name=%s", ok, c.Name)
	}
	_, ok = g.Get("missing")
	if ok {
		t.Fatal("expected not found")
	}
}

func TestGraph_Clues_InsertionOrder(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "c", Name: "C"})
	g.Add(Clue{ID: "a", Name: "A"})
	g.Add(Clue{ID: "b", Name: "B"})

	clues := g.Clues()
	if len(clues) != 3 {
		t.Fatalf("expected 3, got %d", len(clues))
	}
	if clues[0].ID != "c" || clues[1].ID != "a" || clues[2].ID != "b" {
		t.Fatalf("wrong order: %v %v %v", clues[0].ID, clues[1].ID, clues[2].ID)
	}
}

func TestGraph_Resolve_RootCluesAlwaysAvailable(t *testing.T) {
	g := buildSimpleGraph(t)
	// No clues discovered → root clues (knife, letter) available.
	result := g.Resolve(nil)
	ids := clueIDs(result)
	assertContains(t, ids, "knife")
	assertContains(t, ids, "letter")
	assertNotContains(t, ids, "motive")
	assertNotContains(t, ids, "alibi")
}

func TestGraph_Resolve_OR_OneSatisfied(t *testing.T) {
	g := buildSimpleGraph(t)
	discovered := map[ClueID]bool{"knife": true}
	result := g.Resolve(discovered)
	ids := clueIDs(result)
	assertContains(t, ids, "alibi")     // OR: knife is enough
	assertNotContains(t, ids, "motive") // AND: needs letter too
}

func TestGraph_Resolve_AND_AllSatisfied(t *testing.T) {
	g := buildSimpleGraph(t)
	discovered := map[ClueID]bool{"knife": true, "letter": true}
	result := g.Resolve(discovered)
	ids := clueIDs(result)
	assertContains(t, ids, "motive")
	assertContains(t, ids, "alibi")
}

func TestGraph_Resolve_DiscoveredIncluded(t *testing.T) {
	g := buildSimpleGraph(t)
	discovered := map[ClueID]bool{"motive": true}
	result := g.Resolve(discovered)
	ids := clueIDs(result)
	assertContains(t, ids, "motive")
}

func TestGraph_HasCycle_NoCycle(t *testing.T) {
	g := buildSimpleGraph(t)
	if g.HasCycle() {
		t.Fatal("expected no cycle")
	}
}

func TestGraph_HasCycle_WithCycle(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "a", Name: "A"})
	g.Add(Clue{ID: "b", Name: "B"})
	// a → b and b → a creates a cycle. We add deps directly to bypass validation.
	g.deps["a"] = Dependency{ClueID: "a", Prerequisites: []ClueID{"b"}, Mode: ModeAND}
	g.deps["b"] = Dependency{ClueID: "b", Prerequisites: []ClueID{"a"}, Mode: ModeAND}

	if !g.HasCycle() {
		t.Fatal("expected cycle")
	}
}

func TestGraph_DependenciesOf(t *testing.T) {
	g := buildSimpleGraph(t)
	dep, ok := g.DependenciesOf("motive")
	if !ok {
		t.Fatal("expected dependency for motive")
	}
	if dep.Mode != ModeAND {
		t.Fatalf("expected AND, got %s", dep.Mode)
	}
	_, ok = g.DependenciesOf("knife")
	if ok {
		t.Fatal("knife should have no dependency")
	}
}

func TestGraph_Resolve_EmptyGraph(t *testing.T) {
	g := NewGraph()
	result := g.Resolve(nil)
	if len(result) != 0 {
		t.Fatalf("expected 0, got %d", len(result))
	}
}

func TestGraph_Resolve_ChainDependency(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "a", Name: "A"})
	g.Add(Clue{ID: "b", Name: "B"})
	g.Add(Clue{ID: "c", Name: "C"})
	g.AddDependency(Dependency{ClueID: "b", Prerequisites: []ClueID{"a"}, Mode: ModeAND})
	g.AddDependency(Dependency{ClueID: "c", Prerequisites: []ClueID{"b"}, Mode: ModeAND})

	// Only a discovered → b available, c not yet.
	result := g.Resolve(map[ClueID]bool{"a": true})
	ids := clueIDs(result)
	assertContains(t, ids, "b")
	assertNotContains(t, ids, "c")

	// a + b discovered → c available.
	result = g.Resolve(map[ClueID]bool{"a": true, "b": true})
	ids = clueIDs(result)
	assertContains(t, ids, "c")
}

// --- helpers ---

func clueIDs(clues []Clue) map[ClueID]bool {
	m := make(map[ClueID]bool, len(clues))
	for _, c := range clues {
		m[c.ID] = true
	}
	return m
}

func assertContains(t *testing.T, ids map[ClueID]bool, id ClueID) {
	t.Helper()
	if !ids[id] {
		t.Errorf("expected %q in result set", id)
	}
}

func assertNotContains(t *testing.T, ids map[ClueID]bool, id ClueID) {
	t.Helper()
	if ids[id] {
		t.Errorf("expected %q NOT in result set", id)
	}
}
