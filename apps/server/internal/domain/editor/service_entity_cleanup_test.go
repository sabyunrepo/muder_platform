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
		"modules": {
			"location": {
				"enabled": true,
				"config": {
					"locations": [
						{"id": "%s", "name": "삭제 장소"},
						{"id": "%s", "name": "남길 장소"}
					],
					"discoveries": [
						{"locationId": "%s", "clueId": "clue-1"},
						{"locationId": "%s", "clueId": "clue-2"}
					]
				}
			},
			"event_progression": {
				"enabled": true,
				"config": {
					"Triggers": [
						{"id":"deleted-location-trigger","placement":{"kind":"location","entityId":"%s"},"actions":[{"type":"OPEN_VOTING"}]},
						{"id":"kept-location-trigger","placement":{"kind":"location","entityId":"%s"},"actions":[{"type":"MUTE_CHAT"}]}
					]
				}
			}
		},
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
	}`, locationID, keptLocationID, locationID, keptLocationID, locationID, keptLocationID, locationID, keptLocationID, locationID, locationID, keptLocationID, locationID, keptLocationID))

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
	modules := root["modules"].(map[string]any)
	locationModule := modules["location"].(map[string]any)
	locationConfig := locationModule["config"].(map[string]any)
	discoveries := locationConfig["discoveries"].([]any)
	if len(discoveries) != 1 {
		t.Fatalf("expected only discovery with deleted locationId to be removed, got %#v", discoveries)
	}
	eventModule := modules["event_progression"].(map[string]any)
	eventConfig := eventModule["config"].(map[string]any)
	triggers := eventConfig["Triggers"].([]any)
	if len(triggers) != 1 {
		t.Fatalf("expected trigger placed on deleted location to be removed, got %#v", triggers)
	}
	keptTrigger := triggers[0].(map[string]any)
	if keptTrigger["id"] != "kept-location-trigger" {
		t.Fatalf("unexpected kept trigger: %#v", keptTrigger)
	}
	keptDiscovery := discoveries[0].(map[string]any)
	if keptDiscovery["locationId"] != keptLocationID.String() {
		t.Fatalf("unexpected kept discovery: %#v", keptDiscovery)
	}
	if _, exists := root["nullable"]; !exists || root["nullable"] != nil {
		t.Fatalf("json null must be preserved, got %#v", root["nullable"])
	}
}

func TestRemoveLocationReferencesFromConfigJSON_IgnoresMalformedDiscoveryWithoutPanic(t *testing.T) {
	locationID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	raw := json.RawMessage(`{
		"modules": {
			"location": {
				"enabled": true,
				"config": {
					"discoveries": [
						{"locationId":["33333333-3333-3333-3333-333333333333"],"clueId":"clue-1"},
						{"locationId":"44444444-4444-4444-4444-444444444444","clueId":"clue-2"}
					]
				}
			}
		}
	}`)

	cleaned, changed, err := removeLocationReferencesFromConfigJSON(raw, locationID)
	if err != nil {
		t.Fatalf("removeLocationReferencesFromConfigJSON: %v", err)
	}
	if !changed {
		t.Fatal("expected nested location id string to be removed without deleting malformed discovery")
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
