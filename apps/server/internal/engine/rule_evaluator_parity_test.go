package engine

import (
	"encoding/json"
	"os"
	"testing"
)

// parityFixture mirrors the JSON fixture format shared with the frontend
// json-logic-js engine. Same input → same output guarantees cross-engine parity.
type parityFixture struct {
	Name     string          `json:"name"`
	Rule     json.RawMessage `json:"rule"`
	Data     json.RawMessage `json:"data"`
	Expected json.RawMessage `json:"expected"`
}

func TestParity_GoldenFixtures(t *testing.T) {
	raw, err := os.ReadFile("testdata/rule_parity_fixtures.json")
	if err != nil {
		t.Fatalf("failed to read fixtures: %v", err)
	}

	var fixtures []parityFixture
	if err := json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatalf("failed to parse fixtures: %v", err)
	}

	if len(fixtures) == 0 {
		t.Fatal("no fixtures loaded")
	}

	re := NewRuleEvaluator()

	for _, f := range fixtures {
		t.Run(f.Name, func(t *testing.T) {
			re.SetContextRaw(f.Data)

			res, err := re.Evaluate(f.Rule)
			if err != nil {
				t.Fatalf("evaluate error: %v", err)
			}

			// Compare JSON values for exact parity.
			// Normalise both sides through json.Marshal(Unmarshal(...)).
			var got, want any
			if err := json.Unmarshal(res.Value, &got); err != nil {
				t.Fatalf("unmarshal result: %v (raw=%s)", err, res.Value)
			}
			if err := json.Unmarshal(f.Expected, &want); err != nil {
				t.Fatalf("unmarshal expected: %v", err)
			}

			gotJSON, _ := json.Marshal(got)
			wantJSON, _ := json.Marshal(want)

			if string(gotJSON) != string(wantJSON) {
				t.Errorf("parity mismatch:\n  rule:     %s\n  data:     %s\n  got:      %s\n  expected: %s",
					f.Rule, f.Data, gotJSON, wantJSON)
			}
		})
	}
}

func TestParity_FixtureCount(t *testing.T) {
	raw, err := os.ReadFile("testdata/rule_parity_fixtures.json")
	if err != nil {
		t.Fatalf("failed to read fixtures: %v", err)
	}

	var fixtures []parityFixture
	if err := json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatalf("failed to parse fixtures: %v", err)
	}

	// Ensure we have a meaningful number of fixtures covering all operator categories.
	const minFixtures = 40
	if len(fixtures) < minFixtures {
		t.Errorf("expected at least %d fixtures, got %d", minFixtures, len(fixtures))
	}
}
