package editor

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalize_ModulesArrayToMap(t *testing.T) {
	input := json.RawMessage(`{
		"modules": [
			{"id": "voting", "config": {"mode": "open"}},
			{"id": "audio"}
		]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods, ok := cfg["modules"].(map[string]any)
	require.True(t, ok, "modules must be object map after normalize")

	voting := mods["voting"].(map[string]any)
	assert.Equal(t, true, voting["enabled"])
	assert.Equal(t, map[string]any{"mode": "open"}, voting["config"])

	audio := mods["audio"].(map[string]any)
	assert.Equal(t, true, audio["enabled"])
	_, hasConfig := audio["config"]
	assert.False(t, hasConfig, "missing inline config must NOT inject empty config key")
}

func TestNormalize_ModulesStringListPlusConfigsMap(t *testing.T) {
	input := json.RawMessage(`{
		"modules": ["voting", "audio"],
		"module_configs": {
			"voting": {"mode": "open", "minParticipation": 75}
		}
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods := cfg["modules"].(map[string]any)
	voting := mods["voting"].(map[string]any)
	assert.Equal(t, true, voting["enabled"])
	assert.Equal(t, float64(75), voting["config"].(map[string]any)["minParticipation"])

	audio := mods["audio"].(map[string]any)
	assert.Equal(t, true, audio["enabled"])
	_, hasConfig := audio["config"]
	assert.False(t, hasConfig)

	_, hasOldKey := cfg["module_configs"]
	assert.False(t, hasOldKey, "module_configs key must be removed after normalize")
}

func TestNormalize_CluePlacementToLocations(t *testing.T) {
	input := json.RawMessage(`{
		"clue_placement": {"c1": "library", "c2": "study_room"},
		"locations": [
			{"id": "library"},
			{"id": "study_room"}
		]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	locs := cfg["locations"].([]any)
	library := locs[0].(map[string]any)
	libraryClueCfg := library["locationClueConfig"].(map[string]any)
	assert.Equal(t, []any{"c1"}, libraryClueCfg["clueIds"])

	study := locs[1].(map[string]any)
	studyClueCfg := study["locationClueConfig"].(map[string]any)
	assert.Equal(t, []any{"c2"}, studyClueCfg["clueIds"])

	_, hasOldKey := cfg["clue_placement"]
	assert.False(t, hasOldKey, "clue_placement key must be removed after normalize")
}

func TestNormalize_DeadKeyUnion_PriorityCluePlacement(t *testing.T) {
	// c1: clue_placement says library, dead key says study_room → CONFLICT (placement wins)
	// c5: only in dead key → study_room (보충)
	// c9: only in clue_placement → library
	input := json.RawMessage(`{
		"clue_placement": {"c1": "library", "c9": "library"},
		"locations": [
			{"id": "library"},
			{"id": "study_room", "clueIds": ["c1", "c5"]}
		]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	locs := cfg["locations"].([]any)

	library := locs[0].(map[string]any)
	libraryIDs := library["locationClueConfig"].(map[string]any)["clueIds"].([]any)
	assert.ElementsMatch(t, []any{"c1", "c9"}, libraryIDs, "placement wins for c1; c9 placement-only included")

	study := locs[1].(map[string]any)
	studyIDs := study["locationClueConfig"].(map[string]any)["clueIds"].([]any)
	assert.ElementsMatch(t, []any{"c5"}, studyIDs, "c5 dead-key-only preserved; c1 NOT here (conflict resolved to library)")

	_, hasDeadKey := study["clueIds"]
	assert.False(t, hasDeadKey, "locations[].clueIds dead key must be removed after normalize")
}

func TestNormalize_CharacterCluesToStartingClueModule(t *testing.T) {
	input := json.RawMessage(`{
		"character_clues": {"김철수": ["c1", "c2"], "박민수": ["c3"]},
		"modules": ["starting_clue"]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods := cfg["modules"].(map[string]any)
	startingClue := mods["starting_clue"].(map[string]any)
	startingMap := startingClue["config"].(map[string]any)["startingClues"].(map[string]any)

	assert.Equal(t, []any{"c1", "c2"}, startingMap["김철수"])
	assert.Equal(t, []any{"c3"}, startingMap["박민수"])

	_, hasOldKey := cfg["character_clues"]
	assert.False(t, hasOldKey)
}

func TestNormalize_NoOpOnNewShape(t *testing.T) {
	input := json.RawMessage(`{
		"modules": {
			"voting": {"enabled": true, "config": {"mode": "open"}},
			"audio":  {"enabled": false}
		},
		"locations": [{"id": "study_room", "locationClueConfig": {"clueIds": ["c1"]}}]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var gotMap, wantMap map[string]any
	require.NoError(t, json.Unmarshal(got, &gotMap))
	require.NoError(t, json.Unmarshal(input, &wantMap))
	assert.Equal(t, wantMap, gotMap, "new shape input must round-trip unchanged")
}
