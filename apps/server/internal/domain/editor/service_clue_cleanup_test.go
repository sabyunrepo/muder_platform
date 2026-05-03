package editor

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestRemoveClueReferencesFromConfigJSON(t *testing.T) {
	clueID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	raw := json.RawMessage(`{
		"locations": [{"id":"loc-1","name":"서재","locationClueConfig":{"clueIds":["11111111-1111-1111-1111-111111111111","22222222-2222-2222-2222-222222222222"]}}],
		"modules": {
			"starting_clue": {"enabled": true, "config": {"startingClues": {"char-1": ["11111111-1111-1111-1111-111111111111", "33333333-3333-3333-3333-333333333333"]}}},
			"clue_action": {"enabled": true, "config": {"targetClueId": "11111111-1111-1111-1111-111111111111", "rewards": ["11111111-1111-1111-1111-111111111111", "44444444-4444-4444-4444-444444444444"]}}
		}
	}`)

	cleaned, changed, err := removeClueReferencesFromConfigJSON(raw, clueID)
	if err != nil {
		t.Fatalf("removeClueReferencesFromConfigJSON: %v", err)
	}
	if !changed {
		t.Fatal("expected changed=true")
	}
	if strings.Contains(string(cleaned), clueID.String()) {
		t.Fatalf("deleted clue id still present in cleaned config: %s", string(cleaned))
	}
}

func TestRemoveClueReferencesFromConfigJSON_PreservesNullValues(t *testing.T) {
	clueID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	raw := json.RawMessage(`{
		"nullableField": null,
		"items": [null, "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"],
		"nested": {"keepNull": null, "removeMe": "11111111-1111-1111-1111-111111111111"}
	}`)

	cleaned, changed, err := removeClueReferencesFromConfigJSON(raw, clueID)
	if err != nil {
		t.Fatalf("removeClueReferencesFromConfigJSON: %v", err)
	}
	if !changed {
		t.Fatal("expected changed=true")
	}

	var decoded map[string]any
	if err := json.Unmarshal(cleaned, &decoded); err != nil {
		t.Fatalf("unmarshal cleaned config: %v", err)
	}
	if _, ok := decoded["nullableField"]; !ok {
		t.Fatal("top-level null field was removed")
	}
	if decoded["nullableField"] != nil {
		t.Fatalf("top-level null field changed: %#v", decoded["nullableField"])
	}
	items := decoded["items"].([]any)
	if len(items) != 2 || items[0] != nil {
		t.Fatalf("array null should be preserved while clue id is removed: %#v", items)
	}
	nested := decoded["nested"].(map[string]any)
	if _, ok := nested["keepNull"]; !ok || nested["keepNull"] != nil {
		t.Fatalf("nested null should be preserved: %#v", nested)
	}
}
