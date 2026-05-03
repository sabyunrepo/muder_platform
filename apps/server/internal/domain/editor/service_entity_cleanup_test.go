package editor

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/google/uuid"
)

func TestRemoveCharacterReferencesFromConfigJSON(t *testing.T) {
	charID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	keptCharID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	raw := json.RawMessage(fmt.Sprintf(`{
		"modules": {
			"starting_clue": {
				"enabled": true,
				"config": {
					"startingClues": {
						"%s": ["clue-1"],
						"%s": ["clue-2"]
					}
				}
			}
		},
		"character_missions": {
			"%s": [{"id":"m1","targetCharacterId":"%s"}],
			"%s": [{"id":"m2"}]
		},
		"character_clues": {
			"%s": ["legacy-clue"],
			"%s": ["kept-legacy"]
		},
		"nullable": null
	}`, charID, keptCharID, charID, charID, keptCharID, charID, keptCharID))

	cleaned, changed, err := removeCharacterReferencesFromConfigJSON(raw, charID)
	if err != nil {
		t.Fatalf("removeCharacterReferencesFromConfigJSON: %v", err)
	}
	if !changed {
		t.Fatal("expected config to change")
	}

	var decoded any
	if err := json.Unmarshal(cleaned, &decoded); err != nil {
		t.Fatalf("unmarshal cleaned config: %v", err)
	}
	if jsonConfigContainsStringOrKey(decoded, charID.String()) {
		t.Fatalf("deleted character id still present: %s", string(cleaned))
	}
	if !jsonConfigContainsStringOrKey(decoded, keptCharID.String()) {
		t.Fatalf("kept character id was removed: %s", string(cleaned))
	}

	root, ok := decoded.(map[string]any)
	if !ok {
		t.Fatalf("expected root config to be map[string]any, got %T", decoded)
	}
	if _, exists := root["nullable"]; !exists || root["nullable"] != nil {
		t.Fatalf("json null must be preserved, got %#v", root["nullable"])
	}
}

func TestRemoveLocationReferencesFromConfigJSON(t *testing.T) {
	locationID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	keptLocationID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	raw := json.RawMessage(fmt.Sprintf(`{
		"locations": [
			{"id": "%s", "name": "삭제 장소", "locationClueConfig": {"clueIds": ["clue-1"]}},
			{"id": "%s", "name": "남길 장소", "locationClueConfig": {"clueIds": ["clue-2"]}}
		],
		"locationMeta": {
			"%s": {"entryMessage": "삭제"},
			"child": {"parentLocationId": "%s", "entryMessage": "자식"},
			"%s": {"entryMessage": "남김"}
		},
		"clue_placement": {
			"legacy-clue": "%s",
			"kept-clue": "%s"
		},
		"nullable": null
	}`, locationID, keptLocationID, locationID, locationID, keptLocationID, locationID, keptLocationID))

	cleaned, changed, err := removeLocationReferencesFromConfigJSON(raw, locationID)
	if err != nil {
		t.Fatalf("removeLocationReferencesFromConfigJSON: %v", err)
	}
	if !changed {
		t.Fatal("expected config to change")
	}

	var decoded any
	if err := json.Unmarshal(cleaned, &decoded); err != nil {
		t.Fatalf("unmarshal cleaned config: %v", err)
	}
	if jsonConfigContainsStringOrKey(decoded, locationID.String()) {
		t.Fatalf("deleted location id still present: %s", string(cleaned))
	}
	if !jsonConfigContainsStringOrKey(decoded, keptLocationID.String()) {
		t.Fatalf("kept location id was removed: %s", string(cleaned))
	}

	root, ok := decoded.(map[string]any)
	if !ok {
		t.Fatalf("expected root config to be map[string]any, got %T", decoded)
	}
	if _, exists := root["nullable"]; !exists || root["nullable"] != nil {
		t.Fatalf("json null must be preserved, got %#v", root["nullable"])
	}
}

func jsonConfigContainsStringOrKey(value any, target string) bool {
	switch v := value.(type) {
	case string:
		return v == target
	case []any:
		for _, item := range v {
			if jsonConfigContainsStringOrKey(item, target) {
				return true
			}
		}
	case map[string]any:
		for key, child := range v {
			if key == target || jsonConfigContainsStringOrKey(child, target) {
				return true
			}
		}
	}
	return false
}
