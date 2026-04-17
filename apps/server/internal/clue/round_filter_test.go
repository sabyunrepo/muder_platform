package clue

import "testing"

func pInt32(v int32) *int32 { return &v }

func TestRoundRange_InWindow(t *testing.T) {
	cases := []struct {
		name         string
		reveal       *int32
		hide         *int32
		currentRound int32
		want         bool
	}{
		{"both nil — always visible", nil, nil, 1, true},
		{"both nil — always visible (high round)", nil, nil, 99, true},
		{"reveal only, before window", pInt32(3), nil, 2, false},
		{"reveal only, at window start", pInt32(3), nil, 3, true},
		{"reveal only, after window start", pInt32(3), nil, 10, true},
		{"hide only, before hide", nil, pInt32(5), 3, true},
		{"hide only, at hide", nil, pInt32(5), 5, true},
		{"hide only, after hide", nil, pInt32(5), 6, false},
		{"closed range, before", pInt32(2), pInt32(5), 1, false},
		{"closed range, on lower", pInt32(2), pInt32(5), 2, true},
		{"closed range, middle", pInt32(2), pInt32(5), 3, true},
		{"closed range, on upper", pInt32(2), pInt32(5), 5, true},
		{"closed range, after", pInt32(2), pInt32(5), 6, false},
		{"single round (reveal==hide), hit", pInt32(3), pInt32(3), 3, true},
		{"single round (reveal==hide), miss before", pInt32(3), pInt32(3), 2, false},
		{"single round (reveal==hide), miss after", pInt32(3), pInt32(3), 4, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := RoundRange{Reveal: tc.reveal, Hide: tc.hide}
			if got := r.InWindow(tc.currentRound); got != tc.want {
				t.Fatalf("InWindow(%d) = %v, want %v", tc.currentRound, got, tc.want)
			}
		})
	}
}

func TestFilterByRound_NilMap_KeepsEverything(t *testing.T) {
	clues := []Clue{{ID: "a"}, {ID: "b"}}
	got := FilterByRound(clues, 5, nil)
	if len(got) != 2 {
		t.Fatalf("expected all 2 clues, got %d", len(got))
	}
}

func TestFilterByRound_EmptyMap_KeepsEverything(t *testing.T) {
	clues := []Clue{{ID: "a"}, {ID: "b"}}
	got := FilterByRound(clues, 5, map[ClueID]RoundRange{})
	if len(got) != 2 {
		t.Fatalf("expected all 2 clues, got %d", len(got))
	}
}

func TestFilterByRound_MixedVisibility(t *testing.T) {
	clues := []Clue{{ID: "always"}, {ID: "early"}, {ID: "late"}, {ID: "window"}}
	rounds := map[ClueID]RoundRange{
		// "always" has no entry → kept
		"early":  {Hide: pInt32(2)},   // visible rounds 1..2
		"late":   {Reveal: pInt32(5)}, // visible 5..∞
		"window": {Reveal: pInt32(2), Hide: pInt32(4)},
	}

	// Round 3: always + window visible; early expired, late not yet
	got := FilterByRound(clues, 3, rounds)
	ids := map[ClueID]bool{}
	for _, c := range got {
		ids[c.ID] = true
	}
	if !ids["always"] || !ids["window"] {
		t.Fatalf("expected always+window visible at round 3, got %v", ids)
	}
	if ids["early"] || ids["late"] {
		t.Fatalf("expected early+late hidden at round 3, got %v", ids)
	}
}
