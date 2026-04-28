package ws_test

import (
	"testing"

	"github.com/mmp-platform/server/internal/ws"
)

// TestCatalog_Coverage surfaces aggregate counts that downstream tooling
// (frontend codegen, PR review) can sanity-check against. Updates the
// baseline numbers whenever Catalog entries are intentionally added — if
// the counts fall unexpectedly, we have likely dropped an event by accident.
//
// Baseline locked at Phase 19 PR-1 (2026-04-18). Observed: total=123,
// c2s=72, s2c=44, bidi=7, stubs=6. The asserted minima sit a few entries
// below observed so minor re-categorisation doesn't trip the gate, while
// an accidental drop of a whole namespace still fails loudly.
//
//	>= 120 total
//	>= 70  C2S   (legacy module actions, one colon namespace each)
//	>= 40  S2C   (handler-direct colon + engine-origin dot)
//	>= 5   Bidi  (voice:*, sound:play, ping, pong)
//	>= 6   Stub  (auth.* reserved for PR-9)
func TestCatalog_Coverage(t *testing.T) {
	var c2s, s2c, bidi, stubs int
	for _, d := range ws.Catalog {
		if d.Status == ws.StatusStub {
			stubs++
		}
		switch d.Direction {
		case ws.DirC2S:
			c2s++
		case ws.DirS2C:
			s2c++
		case ws.DirBidi:
			bidi++
		}
	}

	total := len(ws.Catalog)
	t.Logf("Catalog coverage: total=%d c2s=%d s2c=%d bidi=%d stubs=%d",
		total, c2s, s2c, bidi, stubs)

	cases := []struct {
		name string
		got  int
		min  int
	}{
		{"total", total, 120},
		{"c2s", c2s, 70},
		{"s2c", s2c, 40},
		{"bidi", bidi, 5},
		{"stubs", stubs, 6},
	}
	for _, tc := range cases {
		if tc.got < tc.min {
			t.Errorf("%s: got %d, want >= %d (regression risk: event dropped?)",
				tc.name, tc.got, tc.min)
		}
	}
}

// TestCatalog_NoDuplicateTypes guards against copy-paste errors in
// catalog files: each canonical Type string must appear exactly once.
func TestCatalog_NoDuplicateTypes(t *testing.T) {
	seen := make(map[string]int, len(ws.Catalog))
	for _, d := range ws.Catalog {
		seen[d.Type]++
	}
	for typ, n := range seen {
		if n > 1 {
			t.Errorf("duplicate Catalog entry: %q appears %d times", typ, n)
		}
	}
}
