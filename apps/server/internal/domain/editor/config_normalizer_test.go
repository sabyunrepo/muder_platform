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

// TestNormalize_EmptyRaw exercises the len(raw)==0 early return in NormalizeConfigJSON.
func TestNormalize_EmptyRaw(t *testing.T) {
	t.Helper()
	got, err := NormalizeConfigJSON(json.RawMessage{})
	require.NoError(t, err)
	assert.Empty(t, got, "empty input must be returned as-is")
}

// TestNormalize_InvalidJSON exercises the json.Unmarshal error path in NormalizeConfigJSON.
func TestNormalize_InvalidJSON(t *testing.T) {
	t.Helper()
	got, err := NormalizeConfigJSON(json.RawMessage(`not json`))
	require.Error(t, err)
	assert.Nil(t, got)
}

// TestNormalize_ModulesArrayWithNonStringNonMapItem exercises the fall-through
// continue inside the backend-preset loop when an array item is neither string
// nor map[string]any (e.g. a raw number).
func TestNormalize_ModulesArrayWithNonStringNonMapItem(t *testing.T) {
	t.Helper()
	// The first element is a map (triggers the "backend preset" branch),
	// the second is a number — the `item.(map[string]any)` assertion fails → continue.
	input := json.RawMessage(`{
		"modules": [
			{"id": "voting"},
			42
		]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods, ok := cfg["modules"].(map[string]any)
	require.True(t, ok)
	// Only "voting" survives; the integer item is silently dropped.
	assert.Contains(t, mods, "voting")
	assert.Len(t, mods, 1)
}

// TestNormalize_ClueLocations_NonMapItem exercises the `locRaw.(map[string]any)
// ok==false` continue inside normalizeClueLocations.
func TestNormalize_ClueLocations_NonMapItem(t *testing.T) {
	t.Helper()
	// locations contains a non-object item (string); the ok==false branch fires
	// and the item is skipped without panic.
	input := json.RawMessage(`{
		"clue_placement": {"c1": "lib"},
		"locations": ["not-a-map", {"id": "lib"}]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	locs := cfg["locations"].([]any)
	// First item (string) is passed through unchanged; second (map) is normalized.
	assert.Equal(t, "not-a-map", locs[0])
	lib := locs[1].(map[string]any)
	libClueCfg := lib["locationClueConfig"].(map[string]any)
	assert.Equal(t, []any{"c1"}, libClueCfg["clueIds"])
}

// TestNormalize_CharacterClues_NoModulesKey exercises the `cfg["modules"]` not
// present (or not a map) early return in normalizeCharacterClues.
func TestNormalize_CharacterClues_NoModulesKey(t *testing.T) {
	t.Helper()
	// character_clues is present but modules is absent → function returns early,
	// character_clues is NOT migrated and NOT deleted (nothing to merge into).
	input := json.RawMessage(`{
		"character_clues": {"alice": ["c1"]}
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	// character_clues should remain untouched (no modules map to migrate into).
	assert.Contains(t, cfg, "character_clues")
}

// TestNormalize_Modules_NotArrayNotMap exercises the normalizeModules early return
// when cfg["modules"] is neither an array nor a map (e.g. a JSON number).
func TestNormalize_Modules_NotArrayNotMap(t *testing.T) {
	t.Helper()
	// modules is a number — the arr, ok type assertion fails → return early.
	input := json.RawMessage(`{"modules": 42}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	// modules stays untouched as a number.
	assert.Equal(t, float64(42), cfg["modules"])
}

// TestNormalize_ModulesStringList_EmptyStringItem exercises the `if id == ""`
// continue in the string-list branch of normalizeModules.
func TestNormalize_ModulesStringList_EmptyStringItem(t *testing.T) {
	t.Helper()
	// Empty string in the string list is silently dropped.
	input := json.RawMessage(`{
		"modules": ["voting", "", "audio"]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods := cfg["modules"].(map[string]any)
	assert.Contains(t, mods, "voting")
	assert.Contains(t, mods, "audio")
	assert.Len(t, mods, 2, "empty-string item must be dropped")
}

// TestNormalize_ModulesBackendPreset_EmptyIDItem exercises the `if id == ""`
// continue in the backend-preset (object array) branch of normalizeModules.
func TestNormalize_ModulesBackendPreset_EmptyIDItem(t *testing.T) {
	t.Helper()
	// Object with empty "id" field is silently dropped in the backend-preset branch.
	input := json.RawMessage(`{
		"modules": [
			{"id": "voting"},
			{"id": ""}
		]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods := cfg["modules"].(map[string]any)
	assert.Contains(t, mods, "voting")
	assert.Len(t, mods, 1, "empty-id object item must be dropped")
}

// TestNormalize_CluePlacement_NonStringValue exercises the `if !ok { continue }`
// in the clue_placement range loop when locVal is not a string.
func TestNormalize_CluePlacement_NonStringValue(t *testing.T) {
	t.Helper()
	// clue_placement has a non-string value for one entry → that entry is skipped.
	input := json.RawMessage(`{
		"clue_placement": {"c1": "library", "c2": 99},
		"locations": [
			{"id": "library"}
		]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	locs := cfg["locations"].([]any)
	lib := locs[0].(map[string]any)
	libClueCfg := lib["locationClueConfig"].(map[string]any)
	// Only c1 (valid string) is placed; c2 (integer value) is skipped.
	assert.Equal(t, []any{"c1"}, libClueCfg["clueIds"])
}

// TestNormalize_ClueLocations_DeadKeyNonStringItem exercises the inner `!ok continue`
// when an item inside locations[].clueIds is not a string.
func TestNormalize_ClueLocations_DeadKeyNonStringItem(t *testing.T) {
	t.Helper()
	// clueIds contains a non-string item (number); that item must be silently dropped.
	input := json.RawMessage(`{
		"clue_placement": {"c1": "library"},
		"locations": [
			{"id": "library", "clueIds": ["c1", 42, "c2"]}
		]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	locs := cfg["locations"].([]any)
	lib := locs[0].(map[string]any)
	libClueCfg := lib["locationClueConfig"].(map[string]any)
	clueIDs := libClueCfg["clueIds"].([]any)
	// c1 from placement + c2 from dead key; integer 42 is dropped.
	assert.ElementsMatch(t, []any{"c1", "c2"}, clueIDs)
}

// TestNormalize_CharacterClues_StartingClueNotMap exercises the `startingClueEntry == nil`
// path in normalizeCharacterClues when mods["starting_clue"] is not a map[string]any.
func TestNormalize_CharacterClues_StartingClueNotMap(t *testing.T) {
	t.Helper()
	// modules is already a map, but starting_clue key is absent → entry created fresh.
	input := json.RawMessage(`{
		"character_clues": {"alice": ["c1"]},
		"modules": {"voting": {"enabled": true}}
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods := cfg["modules"].(map[string]any)
	startingClue, ok := mods["starting_clue"].(map[string]any)
	require.True(t, ok, "starting_clue must be created when absent")
	conf := startingClue["config"].(map[string]any)
	assert.Contains(t, conf, "startingClues")

	_, hasOldKey := cfg["character_clues"]
	assert.False(t, hasOldKey)
}
