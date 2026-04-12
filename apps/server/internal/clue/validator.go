package clue

import "fmt"

// ValidationError describes a graph integrity issue.
type ValidationError struct {
	Type    string   `json:"type"`
	ClueIDs []ClueID `json:"clueIds"`
	Message string   `json:"message"`
}

func (e ValidationError) Error() string {
	return e.Message
}

// Validate checks graph integrity and returns all issues found.
// Checks: orphan prerequisites, cycles, unreachable clues.
func Validate(g *Graph) []ValidationError {
	var errs []ValidationError

	// 1. Orphan prerequisites: referenced in dependencies but not in graph.
	for _, dep := range g.deps {
		for _, prereq := range dep.Prerequisites {
			if _, exists := g.clues[prereq]; !exists {
				errs = append(errs, ValidationError{
					Type:    "orphan",
					ClueIDs: []ClueID{prereq},
					Message: fmt.Sprintf("prerequisite %q referenced by %q not in graph", prereq, dep.ClueID),
				})
			}
		}
	}

	// 2. Cycle detection.
	if g.HasCycle() {
		cycle := detectCycleMembers(g)
		errs = append(errs, ValidationError{
			Type:    "cycle",
			ClueIDs: cycle,
			Message: fmt.Sprintf("dependency cycle detected involving %v", cycle),
		})
	}

	// 3. Unreachable clues: clues with dependencies whose prerequisites can
	//    never be satisfied because every path leads to a cycle or missing node.
	unreachable := findUnreachable(g)
	if len(unreachable) > 0 {
		errs = append(errs, ValidationError{
			Type:    "unreachable",
			ClueIDs: unreachable,
			Message: fmt.Sprintf("clues %v can never be unlocked", unreachable),
		})
	}

	return errs
}

// detectCycleMembers returns the clue IDs that participate in a cycle.
func detectCycleMembers(g *Graph) []ClueID {
	const (
		white = 0
		gray  = 1
		black = 2
	)
	color := make(map[ClueID]int, len(g.clues))
	adj := make(map[ClueID][]ClueID)
	for _, dep := range g.deps {
		for _, prereq := range dep.Prerequisites {
			adj[prereq] = append(adj[prereq], dep.ClueID)
		}
	}

	inCycle := make(map[ClueID]bool)
	var stack []ClueID

	var dfs func(node ClueID) bool
	dfs = func(node ClueID) bool {
		color[node] = gray
		stack = append(stack, node)
		for _, next := range adj[node] {
			if color[next] == gray {
				// Mark all nodes from the cycle start to current.
				for i := len(stack) - 1; i >= 0; i-- {
					inCycle[stack[i]] = true
					if stack[i] == next {
						break
					}
				}
				return true
			}
			if color[next] == white {
				if dfs(next) {
					// Don't short-circuit — continue finding all cycles.
				}
			}
		}
		stack = stack[:len(stack)-1]
		color[node] = black
		return false
	}

	for id := range g.clues {
		if color[id] == white {
			dfs(id)
		}
	}

	var result []ClueID
	for _, id := range g.order {
		if inCycle[id] {
			result = append(result, id)
		}
	}
	return result
}

// findUnreachable returns clues that have AND-mode dependencies where at least
// one prerequisite is itself unreachable or in a cycle. Only reports clues that
// are NOT roots and NOT in the cycle set (cycle members are reported separately).
func findUnreachable(g *Graph) []ClueID {
	if !g.HasCycle() && len(g.deps) == 0 {
		return nil
	}

	cycleMembers := make(map[ClueID]bool)
	if g.HasCycle() {
		for _, id := range detectCycleMembers(g) {
			cycleMembers[id] = true
		}
	}

	// A clue is reachable if it has no deps, or all its AND prereqs are
	// reachable (OR only needs one reachable prereq).
	reachable := make(map[ClueID]bool, len(g.clues))

	changed := true
	for changed {
		changed = false
		for _, id := range g.order {
			if reachable[id] || cycleMembers[id] {
				continue
			}
			dep, hasDep := g.deps[id]
			if !hasDep {
				reachable[id] = true
				changed = true
				continue
			}
			if canReach(dep, reachable) {
				reachable[id] = true
				changed = true
			}
		}
	}

	var result []ClueID
	for _, id := range g.order {
		if !reachable[id] && !cycleMembers[id] {
			result = append(result, id)
		}
	}
	return result
}

func canReach(dep Dependency, reachable map[ClueID]bool) bool {
	switch dep.Mode {
	case ModeOR:
		for _, prereq := range dep.Prerequisites {
			if reachable[prereq] {
				return true
			}
		}
		return false
	default: // ModeAND
		for _, prereq := range dep.Prerequisites {
			if !reachable[prereq] {
				return false
			}
		}
		return true
	}
}
