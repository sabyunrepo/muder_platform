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

// Dependency defines a prerequisite relationship: the target clue is unlockable
// when its prerequisites are satisfied according to Mode.
type Dependency struct {
	ClueID        ClueID         `json:"clueId"`
	Prerequisites []ClueID       `json:"prerequisites"`
	Mode          DependencyMode `json:"mode"`
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

// Resolve returns all clues that are available given the discovered set.
// A clue is available if:
//  1. It has no dependencies (root clue), OR
//  2. Its dependency prerequisites are satisfied per the AND/OR mode.
//
// Already-discovered clues are included in the result.
func (g *Graph) Resolve(discovered map[ClueID]bool) []Clue {
	var result []Clue
	for _, id := range g.order {
		if discovered[id] {
			result = append(result, g.clues[id])
			continue
		}
		dep, hasDep := g.deps[id]
		if !hasDep {
			result = append(result, g.clues[id])
			continue
		}
		if g.isSatisfied(dep, discovered) {
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

func (g *Graph) isSatisfied(dep Dependency, discovered map[ClueID]bool) bool {
	if len(dep.Prerequisites) == 0 {
		return true
	}
	switch dep.Mode {
	case ModeOR:
		for _, prereq := range dep.Prerequisites {
			if discovered[prereq] {
				return true
			}
		}
		return false
	default: // ModeAND
		for _, prereq := range dep.Prerequisites {
			if !discovered[prereq] {
				return false
			}
		}
		return true
	}
}
