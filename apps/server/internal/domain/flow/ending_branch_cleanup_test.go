package flow

import (
	"bytes"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/google/uuid"
)

func TestRemoveEndingReferencesFromConfigJSON_CleansEndingBranchConfig(t *testing.T) {
	deletedEndingID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	keptEndingID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	raw := json.RawMessage(fmt.Sprintf(`{
		"modules": {
			"ending_branch": {
				"enabled": true,
				"config": {
					"defaultEnding": "%s",
					"matrix": [
						{"priority": 1, "ending": "%s", "condition": {"var": "deleted"}},
						{"priority": 2, "ending": "%s", "condition": {"var": "kept"}},
						{"priority": 3, "ending": 42, "condition": {"var": "malformed"}}
					],
					"questions": [{"id": "q1"}],
					"multiVoteThreshold": 0.5
				}
			},
			"event_progression": {
				"enabled": true,
				"config": {"endingId": "%s", "largeOrder": 9007199254740993}
			}
		}
	}`, deletedEndingID, deletedEndingID, keptEndingID, deletedEndingID))

	cleaned, changed, err := removeEndingReferencesFromConfigJSON(raw, deletedEndingID)
	if err != nil {
		t.Fatalf("removeEndingReferencesFromConfigJSON: %v", err)
	}
	if !changed {
		t.Fatal("expected config to change")
	}

	var decoded map[string]any
	if err := json.Unmarshal(cleaned, &decoded); err != nil {
		t.Fatalf("unmarshal cleaned config: %v", err)
	}

	modules := decoded["modules"].(map[string]any)
	endingBranch := modules["ending_branch"].(map[string]any)
	config := endingBranch["config"].(map[string]any)
	if _, exists := config["defaultEnding"]; exists {
		t.Fatalf("defaultEnding should be removed, got %#v", config["defaultEnding"])
	}

	matrix := config["matrix"].([]any)
	if len(matrix) != 2 {
		t.Fatalf("expected one referenced matrix row to be removed, got %#v", matrix)
	}
	if !jsonValueContainsStringOrKey(config, keptEndingID.String()) {
		t.Fatalf("kept ending id was removed: %s", string(cleaned))
	}
	eventProgression := modules["event_progression"].(map[string]any)
	if !jsonValueContainsStringOrKey(eventProgression, deletedEndingID.String()) {
		t.Fatalf("unrelated module references should be preserved: %s", string(cleaned))
	}
	if !bytes.Contains(cleaned, []byte(`"largeOrder":9007199254740993`)) {
		t.Fatalf("unrelated numeric config should preserve precision: %s", string(cleaned))
	}
}

func TestRemoveEndingReferencesFromConfigJSON_PreservesUnchangedConfig(t *testing.T) {
	deletedEndingID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	raw := json.RawMessage(`{"modules":{"ending_branch":{"enabled":true,"config":{"defaultEnding":"kept","matrix":[]}}}}`)

	cleaned, changed, err := removeEndingReferencesFromConfigJSON(raw, deletedEndingID)
	if err != nil {
		t.Fatalf("removeEndingReferencesFromConfigJSON: %v", err)
	}
	if changed {
		t.Fatal("expected config to remain unchanged")
	}
	if string(cleaned) != string(raw) {
		t.Fatalf("unchanged config should preserve original bytes, got %s", string(cleaned))
	}
}

func TestRemoveEndingReferencesFromConfigJSON_CleansLegacyDirectModuleShape(t *testing.T) {
	deletedEndingID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	raw := json.RawMessage(fmt.Sprintf(`{
		"modules": {
			"ending_branch": {
				"defaultEnding": "%s",
				"matrix": [{"priority": 1, "ending": "%s"}]
			}
		}
	}`, deletedEndingID, deletedEndingID))

	cleaned, changed, err := removeEndingReferencesFromConfigJSON(raw, deletedEndingID)
	if err != nil {
		t.Fatalf("removeEndingReferencesFromConfigJSON: %v", err)
	}
	if !changed {
		t.Fatal("expected legacy module shape to change")
	}
	if jsonValueContainsStringOrKey(mustDecodeJSON(t, cleaned), deletedEndingID.String()) {
		t.Fatalf("deleted ending id still present: %s", string(cleaned))
	}
}

func mustDecodeJSON(t *testing.T, raw json.RawMessage) any {
	t.Helper()
	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatalf("unmarshal json: %v", err)
	}
	return decoded
}

func jsonValueContainsStringOrKey(value any, target string) bool {
	switch v := value.(type) {
	case string:
		return v == target
	case []any:
		for _, item := range v {
			if jsonValueContainsStringOrKey(item, target) {
				return true
			}
		}
	case map[string]any:
		for key, child := range v {
			if key == target || jsonValueContainsStringOrKey(child, target) {
				return true
			}
		}
	}
	return false
}
