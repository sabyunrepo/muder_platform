package clue

import (
	"testing"
)

func TestValidate_ValidGraph(t *testing.T) {
	g := buildSimpleGraph(t)
	errs := Validate(g)
	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %v", errs)
	}
}

func TestValidate_EmptyGraph(t *testing.T) {
	g := NewGraph()
	errs := Validate(g)
	if len(errs) != 0 {
		t.Fatalf("expected no errors for empty graph, got %v", errs)
	}
}

func TestValidate_CycleDetected(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "a", Name: "A"})
	g.Add(Clue{ID: "b", Name: "B"})
	g.Add(Clue{ID: "c", Name: "C"})
	// a → b → c → a
	g.deps["a"] = Dependency{ClueID: "a", Prerequisites: []ClueID{"c"}, Mode: ModeAND}
	g.deps["b"] = Dependency{ClueID: "b", Prerequisites: []ClueID{"a"}, Mode: ModeAND}
	g.deps["c"] = Dependency{ClueID: "c", Prerequisites: []ClueID{"b"}, Mode: ModeAND}

	errs := Validate(g)
	found := findErrorType(errs, "cycle")
	if found == nil {
		t.Fatal("expected cycle error")
	}
	if len(found.ClueIDs) != 3 {
		t.Fatalf("expected 3 cycle members, got %d: %v", len(found.ClueIDs), found.ClueIDs)
	}
}

func TestValidate_PartialCycle(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "root", Name: "Root"})
	g.Add(Clue{ID: "a", Name: "A"})
	g.Add(Clue{ID: "b", Name: "B"})
	// a → b → a (cycle), root is fine
	g.deps["a"] = Dependency{ClueID: "a", Prerequisites: []ClueID{"b"}, Mode: ModeAND}
	g.deps["b"] = Dependency{ClueID: "b", Prerequisites: []ClueID{"a"}, Mode: ModeAND}

	errs := Validate(g)
	found := findErrorType(errs, "cycle")
	if found == nil {
		t.Fatal("expected cycle error")
	}
	// root should not be in cycle members
	for _, id := range found.ClueIDs {
		if id == "root" {
			t.Fatal("root should not be in cycle")
		}
	}
}

func TestValidate_Unreachable_AND(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "root", Name: "Root"})
	g.Add(Clue{ID: "a", Name: "A"})
	g.Add(Clue{ID: "b", Name: "B"})
	// a → b → a (cycle), root depends on a (AND)
	g.deps["a"] = Dependency{ClueID: "a", Prerequisites: []ClueID{"b"}, Mode: ModeAND}
	g.deps["b"] = Dependency{ClueID: "b", Prerequisites: []ClueID{"a"}, Mode: ModeAND}

	// root needs a, but a is in a cycle
	g.Add(Clue{ID: "dead", Name: "Dead"})
	g.deps["dead"] = Dependency{ClueID: "dead", Prerequisites: []ClueID{"a"}, Mode: ModeAND}

	errs := Validate(g)
	found := findErrorType(errs, "unreachable")
	if found == nil {
		t.Fatal("expected unreachable error")
	}
	hasID := false
	for _, id := range found.ClueIDs {
		if id == "dead" {
			hasID = true
		}
	}
	if !hasID {
		t.Fatalf("expected 'dead' in unreachable, got %v", found.ClueIDs)
	}
}

func TestValidate_OR_OnePathReachable(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "root", Name: "Root"})
	g.Add(Clue{ID: "a", Name: "A"})
	g.Add(Clue{ID: "b", Name: "B"})
	// b is a cycle with itself (injected directly)
	g.deps["b"] = Dependency{ClueID: "b", Prerequisites: []ClueID{"b"}, Mode: ModeAND}
	// a needs root OR b (OR mode) → root is reachable, so a is reachable
	g.deps["a"] = Dependency{ClueID: "a", Prerequisites: []ClueID{"root", "b"}, Mode: ModeOR}

	errs := Validate(g)
	for _, e := range errs {
		if e.Type == "unreachable" {
			for _, id := range e.ClueIDs {
				if id == "a" {
					t.Fatal("'a' should be reachable via OR path through root")
				}
			}
		}
	}
}

func TestValidate_NoRootClues(t *testing.T) {
	g := NewGraph()
	g.Add(Clue{ID: "a", Name: "A"})
	g.Add(Clue{ID: "b", Name: "B"})
	g.deps["a"] = Dependency{ClueID: "a", Prerequisites: []ClueID{"b"}, Mode: ModeAND}
	g.deps["b"] = Dependency{ClueID: "b", Prerequisites: []ClueID{"a"}, Mode: ModeAND}

	errs := Validate(g)
	if len(errs) == 0 {
		t.Fatal("expected validation errors for graph with no roots")
	}
}

// --- helpers ---

func findErrorType(errs []ValidationError, typ string) *ValidationError {
	for i := range errs {
		if errs[i].Type == typ {
			return &errs[i]
		}
	}
	return nil
}
