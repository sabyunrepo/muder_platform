package clue

// VisibilityScope defines who can see a clue.
type VisibilityScope string

const (
	ScopeAll    VisibilityScope = "all"
	ScopeRole   VisibilityScope = "role"
	ScopeTeam   VisibilityScope = "team"
	ScopePlayer VisibilityScope = "player"
)

// VisibilityRule controls clue visibility for specific scopes.
// Hidden=true explicitly hides a clue that would otherwise be visible.
type VisibilityRule struct {
	ClueID ClueID          `json:"clueId"`
	Scope  VisibilityScope `json:"scope"`
	Target string          `json:"target"` // role name, team name, or player ID
	Hidden bool            `json:"hidden"`
}

// PlayerContext provides the player's identity for visibility resolution.
type PlayerContext struct {
	PlayerID string
	Role     string
	Team     string
}

// ComputeVisible returns the set of clue IDs visible to the player.
// Evaluation order:
//  1. Start with available clues (resolved from graph + discovered set)
//  2. Apply visibility rules: explicit grants and explicit hides
//  3. Clues with no rules default to visible (scope "all")
//
// Hidden rules take precedence over grant rules at the same specificity.
// More specific scopes (player > role > team > all) override less specific ones.
func ComputeVisible(g *Graph, discovered map[ClueID]bool, rules []VisibilityRule, player PlayerContext) map[ClueID]bool {
	available := g.Resolve(discovered)
	availSet := make(map[ClueID]bool, len(available))
	for _, c := range available {
		availSet[c.ID] = true
	}

	// Index rules by clue ID.
	rulesByClue := make(map[ClueID][]VisibilityRule)
	for _, r := range rules {
		rulesByClue[r.ClueID] = append(rulesByClue[r.ClueID], r)
	}

	visible := make(map[ClueID]bool, len(available))

	for _, c := range available {
		clueRules := rulesByClue[c.ID]
		if len(clueRules) == 0 {
			visible[c.ID] = true
			continue
		}
		if evaluateRules(clueRules, player) {
			visible[c.ID] = true
		}
	}

	return visible
}

// evaluateRules determines if a clue is visible to the player.
// Finds the most specific matching rule. Hidden takes precedence at same specificity.
func evaluateRules(rules []VisibilityRule, player PlayerContext) bool {
	bestPriority := -1
	bestVisible := true

	for _, r := range rules {
		if !ruleMatches(r, player) {
			continue
		}
		pri := scopePriority(r.Scope)
		if pri > bestPriority {
			bestPriority = pri
			bestVisible = !r.Hidden
		} else if pri == bestPriority && r.Hidden {
			bestVisible = false
		}
	}

	if bestPriority == -1 {
		return false
	}
	return bestVisible
}

func ruleMatches(r VisibilityRule, player PlayerContext) bool {
	switch r.Scope {
	case ScopeAll:
		return true
	case ScopeRole:
		return r.Target == player.Role
	case ScopeTeam:
		return r.Target == player.Team
	case ScopePlayer:
		return r.Target == player.PlayerID
	default:
		return false
	}
}

func scopePriority(s VisibilityScope) int {
	switch s {
	case ScopeAll:
		return 0
	case ScopeTeam:
		return 1
	case ScopeRole:
		return 2
	case ScopePlayer:
		return 3
	default:
		return -1
	}
}
