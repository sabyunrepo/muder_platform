package clue

// RoundRange models the reveal/hide window for a clue (or from/until for
// a location). A nil bound means "unbounded on that side".
//
// The semantic is inclusive on both ends:
//   - reveal_round=2, hide_round=5 → visible for rounds 2..5
//   - reveal_round=nil             → visible from round 1
//   - hide_round=nil               → visible forever
type RoundRange struct {
	Reveal *int32
	Hide   *int32
}

// InWindow reports whether the given round lies inside the range.
func (r RoundRange) InWindow(currentRound int32) bool {
	if r.Reveal != nil && currentRound < *r.Reveal {
		return false
	}
	if r.Hide != nil && currentRound > *r.Hide {
		return false
	}
	return true
}

// FilterByRound returns the subset of the input clue slice that is visible
// at `currentRound`. Clues without an entry in `rounds` are treated as
// always visible (range fully open). Pass rounds=nil to keep every clue.
func FilterByRound(clues []Clue, currentRound int32, rounds map[ClueID]RoundRange) []Clue {
	if len(rounds) == 0 {
		return clues
	}
	out := make([]Clue, 0, len(clues))
	for _, c := range clues {
		rr, ok := rounds[c.ID]
		if !ok {
			out = append(out, c)
			continue
		}
		if rr.InWindow(currentRound) {
			out = append(out, c)
		}
	}
	return out
}
