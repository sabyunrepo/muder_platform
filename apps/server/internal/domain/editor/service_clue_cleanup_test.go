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
			"clue_action": {"enabled": true, "config": {"targetClueId": "11111111-1111-1111-1111-111111111111", "rewards": ["11111111-1111-1111-1111-111111111111", "44444444-4444-4444-4444-444444444444"]}},
			"location": {"enabled": true, "config": {"discoveries": [
				{"locationId":"loc-1","clueId":"11111111-1111-1111-1111-111111111111","requiredClueIds":["22222222-2222-2222-2222-222222222222"]},
				{"locationId":"loc-1","clueId":"55555555-5555-5555-5555-555555555555","requiredClueIds":["11111111-1111-1111-1111-111111111111","22222222-2222-2222-2222-222222222222"]}
			]}}
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

	var decoded map[string]any
	if err := json.Unmarshal(cleaned, &decoded); err != nil {
		t.Fatalf("unmarshal cleaned config: %v", err)
	}
	modules := decoded["modules"].(map[string]any)
	locationModule := modules["location"].(map[string]any)
	locationConfig := locationModule["config"].(map[string]any)
	discoveries := locationConfig["discoveries"].([]any)
	if len(discoveries) != 1 {
		t.Fatalf("expected only discovery with deleted clueId to be removed, got %#v", discoveries)
	}
	keptDiscovery := discoveries[0].(map[string]any)
	if keptDiscovery["clueId"] != "55555555-5555-5555-5555-555555555555" {
		t.Fatalf("unexpected kept discovery: %#v", keptDiscovery)
	}
	required := keptDiscovery["requiredClueIds"].([]any)
	if len(required) != 1 || required[0] != "22222222-2222-2222-2222-222222222222" {
		t.Fatalf("deleted required clue id should be removed from kept discovery: %#v", required)
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

func TestRemoveClueReferencesFromConfigJSON_IgnoresMalformedDiscoveryWithoutPanic(t *testing.T) {
	clueID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	raw := json.RawMessage(`{
		"modules": {
			"location": {
				"enabled": true,
				"config": {
					"discoveries": [
						{"locationId":"loc-1","clueId":["11111111-1111-1111-1111-111111111111"]},
						{"locationId":"loc-1","clueId":"22222222-2222-2222-2222-222222222222"}
					]
				}
			}
		}
	}`)

	cleaned, changed, err := removeClueReferencesFromConfigJSON(raw, clueID)
	if err != nil {
		t.Fatalf("removeClueReferencesFromConfigJSON: %v", err)
	}
	if !changed {
		t.Fatal("expected nested clue id string to be removed without deleting malformed discovery")
	}
	var decoded map[string]any
	if err := json.Unmarshal(cleaned, &decoded); err != nil {
		t.Fatalf("unmarshal cleaned config: %v", err)
	}
	modules := decoded["modules"].(map[string]any)
	locationModule := modules["location"].(map[string]any)
	locationConfig := locationModule["config"].(map[string]any)
	discoveries := locationConfig["discoveries"].([]any)
	if len(discoveries) != 2 {
		t.Fatalf("malformed discovery should be preserved, got %#v", discoveries)
	}
}
