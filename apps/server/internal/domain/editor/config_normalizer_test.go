package editor

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/rs/zerolog"
	zerologlog "github.com/rs/zerolog/log"
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

func TestLegacyConfigAxes(t *testing.T) {
	input := json.RawMessage(`{
		"modules": ["voting"],
		"module_configs": {"voting": {"mode": "open"}},
		"clue_placement": {"clue-secret": "library"},
		"locations": [{"id": "library", "clueIds": ["clue-secret"]}],
		"character_clues": {"alice": ["clue-secret"]}
	}`)

	assert.ElementsMatch(t, []string{
		"modules_array",
		"module_configs",
		"clue_placement",
		"locations_clueIds",
		"character_clues",
	}, legacyConfigAxes(input))
}

func TestLegacyConfigAxes_NewShapeIsEmpty(t *testing.T) {
	input := json.RawMessage(`{
		"modules": {"starting_clue": {"enabled": true, "config": {"startingClues": {}}}},
		"locations": [{"id": "library", "locationClueConfig": {"clueIds": ["clue-secret"]}}]
	}`)

	assert.Empty(t, legacyConfigAxes(input))
}

func TestLegacyConfigAxes_MixedLocationShapesDetectsDeadKey(t *testing.T) {
	input := json.RawMessage(`{
		"locations": [
			{"id": "library", "locationClueConfig": {"clueIds": ["c1"]}},
			{"id": "study_room", "clueIds": ["c2"]}
		]
	}`)

	assert.ElementsMatch(t, []string{"locations_clueIds"}, legacyConfigAxes(input))
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

// TestNormalize_ModulesAlreadyMap_WithLegacyModuleConfigs covers Thread-2
// (CodeRabbit): when modules is already a map but module_configs is still
// present (partial-migration state), module_configs must be absorbed and deleted.
func TestNormalize_ModulesAlreadyMap_WithLegacyModuleConfigs(t *testing.T) {
	input := json.RawMessage(`{
		"modules": {
			"voting": {"enabled": true}
		},
		"module_configs": {
			"voting": {"mode": "open"},
			"audio":  {"volume": 0.8}
		}
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods := cfg["modules"].(map[string]any)

	// voting already had an entry; module_configs.voting should be merged only if
	// no "config" key exists.
	voting := mods["voting"].(map[string]any)
	assert.Equal(t, true, voting["enabled"])
	votingCfg, _ := voting["config"].(map[string]any)
	require.NotNil(t, votingCfg, "module_configs.voting must be merged into modules.voting.config")
	assert.Equal(t, "open", votingCfg["mode"])

	// audio was absent in modules; it must be created from module_configs.
	audio, ok := mods["audio"].(map[string]any)
	require.True(t, ok, "audio entry must be created from module_configs")
	assert.Equal(t, true, audio["enabled"])
	audioCfg, _ := audio["config"].(map[string]any)
	require.NotNil(t, audioCfg)
	assert.Equal(t, float64(0.8), audioCfg["volume"])

	_, hasOldKey := cfg["module_configs"]
	assert.False(t, hasOldKey, "module_configs key must be deleted after absorption")
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

// TestNormalize_DeadKeyOnly_NoPlacement covers the Thread-1 (CodeRabbit) fix:
// locations[].clueIds present but no clue_placement key at all.
// Before the fix, hasLegacyKeys() did not sniff "clueIds" so the normalizer
// returned the blob unchanged and the dead key was never removed.
func TestNormalize_DeadKeyOnly_NoPlacement(t *testing.T) {
	input := json.RawMessage(`{
		"locations": [
			{"id": "library", "clueIds": ["c1", "c2"]},
			{"id": "study_room", "clueIds": ["c3"]}
		]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	locs := cfg["locations"].([]any)

	library := locs[0].(map[string]any)
	_, hasDeadKey := library["clueIds"]
	assert.False(t, hasDeadKey, "dead-key clueIds must be removed from locations[]")
	libraryClueCfg, _ := library["locationClueConfig"].(map[string]any)
	require.NotNil(t, libraryClueCfg, "locationClueConfig must be created")
	assert.ElementsMatch(t, []any{"c1", "c2"}, libraryClueCfg["clueIds"])

	study := locs[1].(map[string]any)
	_, hasDeadKey2 := study["clueIds"]
	assert.False(t, hasDeadKey2, "dead-key clueIds must be removed from locations[]")
	studyClueCfg, _ := study["locationClueConfig"].(map[string]any)
	require.NotNil(t, studyClueCfg, "locationClueConfig must be created")
	assert.ElementsMatch(t, []any{"c3"}, studyClueCfg["clueIds"])

	_, hasPlacement := cfg["clue_placement"]
	assert.False(t, hasPlacement, "clue_placement must not appear in output")
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
	got, err := NormalizeConfigJSON(json.RawMessage{})
	require.NoError(t, err)
	assert.Empty(t, got, "empty input must be returned as-is")
}

// TestNormalize_InvalidJSON exercises the json.Unmarshal error path in NormalizeConfigJSON.
func TestNormalize_InvalidJSON(t *testing.T) {
	got, err := NormalizeConfigJSON(json.RawMessage(`not json`))
	require.Error(t, err)
	assert.Nil(t, got)
}

// TestNormalize_ModulesArrayWithNonStringNonMapItem exercises the fall-through
// continue inside the backend-preset loop when an array item is neither string
// nor map[string]any (e.g. a raw number).
func TestNormalize_ModulesArrayWithNonStringNonMapItem(t *testing.T) {
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

// TestNormalize_DeadKeyUnion_EmitsDebugLog asserts that the D-21 conflict
// resolution path emits a structured debug log containing the expected fields.
// H4: review round-1 finding — conflict path was exercised but log never asserted.
func TestNormalize_DeadKeyUnion_EmitsDebugLog(t *testing.T) {
	// Replace global zerolog logger with one writing to buf, restore on cleanup.
	var buf bytes.Buffer
	orig := zerologlog.Logger
	zerologlog.Logger = zerolog.New(&buf).Level(zerolog.DebugLevel)
	origLevel := zerolog.GlobalLevel()
	zerolog.SetGlobalLevel(zerolog.DebugLevel)
	t.Cleanup(func() {
		zerologlog.Logger = orig
		zerolog.SetGlobalLevel(origLevel)
	})

	// c1 is in clue_placement → library, but study_room dead key also claims c1.
	// This is the conflict: placement wins (D-21) → debug log must fire.
	input := json.RawMessage(`{
		"clue_placement": {"c1": "library"},
		"locations": [
			{"id": "library"},
			{"id": "study_room", "clueIds": ["c1", "c5"]}
		]
	}`)

	_, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	out := buf.String()

	// Assert message substring.
	assert.True(t, strings.Contains(out, "clue_placement conflict"),
		"log must contain 'clue_placement conflict', got: %s", out)

	// Assert structured fields.
	assert.True(t, strings.Contains(out, `"clueId"`),
		"log must contain clueId field, got: %s", out)
	assert.True(t, strings.Contains(out, `"placement"`),
		"log must contain placement field, got: %s", out)
	assert.True(t, strings.Contains(out, `"deadKeyLocation"`),
		"log must contain deadKeyLocation field, got: %s", out)
}

// TestNormalize_Idempotent_DoublePass asserts that applying NormalizeConfigJSON
// twice yields the same result as applying it once (true idempotence).
// M6: review round-1 finding — double-normalize case was not covered.
func TestNormalize_Idempotent_DoublePass(t *testing.T) {
	// Realistic legacy fixture covering all three migration axes simultaneously:
	//   - modules as array (D-20)
	//   - clue_placement present (D-21)
	//   - character_clues present (D-19)
	legacy := json.RawMessage(`{
		"modules": [
			{"id": "voting", "config": {"mode": "open"}},
			{"id": "starting_clue"}
		],
		"clue_placement": {"c1": "library", "c2": "study_room"},
		"locations": [
			{"id": "library"},
			{"id": "study_room"}
		],
		"character_clues": {"alice": ["c1"], "bob": ["c2"]}
	}`)

	firstPass, err := NormalizeConfigJSON(legacy)
	require.NoError(t, err, "first pass must not error")

	secondPass, err := NormalizeConfigJSON(firstPass)
	require.NoError(t, err, "second pass must not error")

	// Both passes must produce identical JSON structures.
	assert.JSONEq(t, string(firstPass), string(secondPass),
		"NormalizeConfigJSON must be idempotent: double-pass must equal single-pass")
}

// TestNormalize_BackendPreset_EnabledFalseIsIgnored asserts that a legacy
// backend-preset array with enabled:false normalizes to enabled:true.
// M7: review round-1 finding — this intentional policy was undocumented in tests.
//
// Policy: legacy array = "all enrolled". Any "enabled":false in old shape is
// silently dropped — this is intentional per D-20 migration semantics.
func TestNormalize_BackendPreset_EnabledFalseIsIgnored(t *testing.T) {
	input := json.RawMessage(`{
		"modules": [{"id": "voting", "enabled": false}]
	}`)

	got, err := NormalizeConfigJSON(input)
	require.NoError(t, err)

	var cfg map[string]any
	require.NoError(t, json.Unmarshal(got, &cfg))

	mods, ok := cfg["modules"].(map[string]any)
	require.True(t, ok, "modules must be object map after normalize")

	voting, ok := mods["voting"].(map[string]any)
	require.True(t, ok, "voting must be present in normalized modules")

	// Policy: legacy array = "all enrolled". enabled:false in legacy is intentionally ignored.
	assert.Equal(t, true, voting["enabled"],
		"legacy enabled:false must be dropped — D-20 migration semantics: legacy array = all enrolled")
}
