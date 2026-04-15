package session

import "testing"

// TestShouldRelay verifies the prefix filter that decides which engine events
// reach WS clients. Covers both colon and dot naming conventions currently
// in use across the codebase (M-3).
func TestShouldRelay(t *testing.T) {
	cases := []struct {
		typ  string
		want bool
	}{
		{"phase:entered", true},
		{"phase:exiting", true},
		{"phase.advanced", true},
		{"clue:found", true},
		{"clue.acquired", true},
		{"vote:tallied", true},
		{"vote.cast", true},
		{"game:end", true},
		{"game.start", true},
		{"player:joined", true},
		{"player.left", true},
		{"module:state", true},
		{"module.event", true},
		{"ready.all_ready", true},
		{"ready.status_changed", true},
		{"reading.advance", true},
		{"ending.revealed", true},
		// Negatives — internal/debug types not relayed.
		{"internal.metric", false},
		{"debug.trace", false},
		{"", false},
		{"snapshot.persisted", false},
	}
	for _, c := range cases {
		got := shouldRelay(c.typ)
		if got != c.want {
			t.Errorf("shouldRelay(%q) = %v, want %v", c.typ, got, c.want)
		}
	}
}
