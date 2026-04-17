package clue

import (
	"encoding/json"
	"fmt"
)

// ClueID is a unique identifier for a clue.
type ClueID string

// Clue represents a discoverable piece of evidence in a game session.
type Clue struct {
	ID          ClueID          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Tags        []string        `json:"tags,omitempty"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
}

// DependencyMode controls how prerequisites are evaluated.
type DependencyMode string

const (
	ModeAND DependencyMode = "AND"
	ModeOR  DependencyMode = "OR"
)

// DependencyTrigger decides how prerequisites translate into unlocking.
//
//   - TriggerAUTO: target is auto-unlocked the moment prerequisites are
//     satisfied (by discovery or crafting). Matches the historical
//     clue_relations semantics.
//   - TriggerCRAFT: target stays hidden until an external agent (the
//     CombinationModule) explicitly adds it to the `crafted` set — the
//     graph never auto-unlocks CRAFT targets from prerequisites alone.
type DependencyTrigger string

const (
	TriggerAUTO  DependencyTrigger = "AUTO"
	TriggerCRAFT DependencyTrigger = "CRAFT"
)

// Dependency defines a prerequisite relationship: the target clue is unlockable
// when its prerequisites are satisfied (per Mode) and its Trigger allows it.
// Zero-value Trigger is treated as AUTO for backward compatibility with older
// fixtures that predate Phase 20.
type Dependency struct {
	ClueID        ClueID            `json:"clueId"`
	Prerequisites []ClueID          `json:"prerequisites"`
	Mode          DependencyMode    `json:"mode"`
	Trigger       DependencyTrigger `json:"trigger,omitempty"`
}

// Graph is a DAG of clues and their dependency relationships.
// All clues must be added before dependencies. Not thread-safe —
// callers must synchronise if building concurrently.
type Graph struct {
	clues map[ClueID]Clue
	deps  map[ClueID]Dependency
	order []ClueID
}

// NewGraph returns an empty graph ready for use.
func NewGraph() *Graph {
	return &Graph{
		clues: make(map[ClueID]Clue),
		deps:  make(map[ClueID]Dependency),
	}
}

// Add inserts a clue into the graph. Returns an error if the ID is empty
// or already registered.
func (g *Graph) Add(c Clue) error {
	if c.ID == "" {
		return fmt.Errorf("clue: empty ID")
	}
	if _, exists := g.clues[c.ID]; exists {
		return fmt.Errorf("clue: duplicate ID %q", c.ID)
	}
	g.clues[c.ID] = c
	g.order = append(g.order, c.ID)
	return nil
}

// AddDependency registers a prerequisite relationship for a clue.
// The clue and all prerequisites must already exist in the graph.
// Trigger defaults to AUTO when left empty.
func (g *Graph) AddDependency(dep Dependency) error {
	if _, exists := g.clues[dep.ClueID]; !exists {
		return fmt.Errorf("clue: dependency target %q not in graph", dep.ClueID)
	}
	if _, exists := g.deps[dep.ClueID]; exists {
		return fmt.Errorf("clue: dependency already defined for %q", dep.ClueID)
	}
	if dep.Mode != ModeAND && dep.Mode != ModeOR {
		return fmt.Errorf("clue: invalid dependency mode %q (must be AND or OR)", dep.Mode)
	}
	if dep.Trigger == "" {
		dep.Trigger = TriggerAUTO
	}
	if dep.Trigger != TriggerAUTO && dep.Trigger != TriggerCRAFT {
		return fmt.Errorf("clue: invalid dependency trigger %q (must be AUTO or CRAFT)", dep.Trigger)
	}
	if dep.Trigger == TriggerCRAFT && dep.Mode == ModeOR {
		return fmt.Errorf("clue: CRAFT trigger does not allow OR mode for %q", dep.ClueID)
	}
	for _, prereq := range dep.Prerequisites {
		if _, exists := g.clues[prereq]; !exists {
			return fmt.Errorf("clue: prerequisite %q not in graph", prereq)
		}
		if prereq == dep.ClueID {
			return fmt.Errorf("clue: self-dependency on %q", dep.ClueID)
		}
	}
	g.deps[dep.ClueID] = dep
	return nil
}

// Resolve returns all clues that are available given the discovered and
// crafted sets. `crafted` may be nil when callers do not model explicit
// crafting (e.g. legacy visibility paths before Phase 20 PR-5 wiring).
//
// A clue is available if:
//  1. It is in `discovered` (directly found).
//  2. It is in `crafted` (explicitly unlocked via combination).
//  3. It has no dependency — root clues are always available.
//  4. It has a dependency with Trigger=AUTO whose prerequisites are
//     satisfied per the AND/OR mode, treating discovery and crafting as
//     equivalent ways to satisfy a prerequisite.
//
// CRAFT-trigger dependencies are never auto-resolved: the engine must add
// the target to the `crafted` set when a valid `combine` input arrives.
func (g *Graph) Resolve(discovered, crafted map[ClueID]bool) []Clue {
	var result []Clue
	for _, id := range g.order {
		if discovered[id] || crafted[id] {
			result = append(result, g.clues[id])
			continue
		}
		dep, hasDep := g.deps[id]
		if !hasDep {
			result = append(result, g.clues[id])
			continue
		}
		if dep.Trigger == TriggerCRAFT {
			// Craft targets stay hidden until the engine adds them to `crafted`.
			continue
		}
		if g.isSatisfied(dep, discovered, crafted) {
			result = append(result, g.clues[id])
		}
	}
	return result
}

// Get returns a clue by ID, or false if not found.
func (g *Graph) Get(id ClueID) (Clue, bool) {
	c, ok := g.clues[id]
	return c, ok
}

// Clues returns all clues in insertion order.
func (g *Graph) Clues() []Clue {
	result := make([]Clue, 0, len(g.order))
	for _, id := range g.order {
		result = append(result, g.clues[id])
	}
	return result
}

// Len returns the number of clues in the graph.
func (g *Graph) Len() int {
	return len(g.clues)
}

// DependenciesOf returns the dependency for a clue, or false if none.
func (g *Graph) DependenciesOf(id ClueID) (Dependency, bool) {
	dep, ok := g.deps[id]
	return dep, ok
}

// HasCycle returns true if the dependency graph contains a cycle.
func (g *Graph) HasCycle() bool {
	// Kahn's algorithm: compute in-degrees and BFS.
	inDegree := make(map[ClueID]int, len(g.clues))
	for id := range g.clues {
		inDegree[id] = 0
	}
	adj := make(map[ClueID][]ClueID)
	for _, dep := range g.deps {
		for _, prereq := range dep.Prerequisites {
			adj[prereq] = append(adj[prereq], dep.ClueID)
			inDegree[dep.ClueID]++
		}
	}

	var queue []ClueID
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}

	visited := 0
	for len(queue) > 0 {
		node := queue[0]
		queue = queue[1:]
		visited++
		for _, next := range adj[node] {
			inDegree[next]--
			if inDegree[next] == 0 {
				queue = append(queue, next)
			}
		}
	}
	return visited != len(g.clues)
}

func (g *Graph) isSatisfied(dep Dependency, discovered, crafted map[ClueID]bool) bool {
	if len(dep.Prerequisites) == 0 {
		return true
	}
	has := func(id ClueID) bool { return discovered[id] || crafted[id] }
	switch dep.Mode {
	case ModeOR:
		for _, prereq := range dep.Prerequisites {
			if has(prereq) {
				return true
			}
		}
		return false
	default: // ModeAND
		for _, prereq := range dep.Prerequisites {
			if !has(prereq) {
				return false
			}
		}
		return true
	}
}
