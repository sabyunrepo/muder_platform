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
