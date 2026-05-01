package ending_branch

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mmp-platform/server/internal/engine"
)

func TestModule_Name(t *testing.T) {
	m := NewModule()
	assert.Equal(t, "ending_branch", m.Name())
}

func TestModule_Schema_HasQuestionsAndMatrix(t *testing.T) {
	m := NewModule()
	schema := m.Schema()
	require.NotEmpty(t, schema)

	var s map[string]any
	require.NoError(t, json.Unmarshal(schema, &s))

	props := s["properties"].(map[string]any)
	assert.Contains(t, props, "questions")
	assert.Contains(t, props, "matrix")
	assert.Contains(t, props, "defaultEnding")
	assert.Contains(t, props, "multiVoteThreshold")
}

func TestModule_Schema_QuestionImpactEnum(t *testing.T) {
	m := NewModule()
	var s map[string]any
	require.NoError(t, json.Unmarshal(m.Schema(), &s))

	props := s["properties"].(map[string]any)
	questions := props["questions"].(map[string]any)
	items := questions["items"].(map[string]any)
	itemProps := items["properties"].(map[string]any)
	impact := itemProps["impact"].(map[string]any)
	enum := impact["enum"].([]any)
	assert.ElementsMatch(t, []any{"branch", "score"}, enum, "D-24: impact must be branch|score")
}

func TestModule_Schema_MultiVoteThresholdDefault(t *testing.T) {
	m := NewModule()
	var s map[string]any
	require.NoError(t, json.Unmarshal(m.Schema(), &s))

	props := s["properties"].(map[string]any)
	threshold := props["multiVoteThreshold"].(map[string]any)
	assert.Equal(t, float64(0.5), threshold["default"], "D-26: default 50% threshold")
	assert.Equal(t, float64(0), threshold["minimum"])
	assert.Equal(t, float64(1), threshold["maximum"])
}

func TestModule_Init_NoPanic(t *testing.T) {
	m := NewModule()
	require.NotPanics(t, func() {
		// Pass nil config (zero deps, nil raw config) — skeleton accepts both.
		err := m.Init(context.Background(), engine.ModuleDeps{}, nil)
		require.NoError(t, err)
	})
}

// TestModule_ApplyConfig_ParsesQuestions tests the internal ApplyConfig helper.
// ApplyConfig is not part of engine.Module; it is a typed-config convenience
// method on *Module that the session manager calls explicitly for ending_branch.
func TestModule_ApplyConfig_ParsesQuestions(t *testing.T) {
	m := NewModule()
	cfg := json.RawMessage(`{
		"questions": [
			{"id": "q1", "text": "용서?", "type": "single", "choices": ["예","아니오"], "impact": "branch"}
		],
		"matrix": [],
		"defaultEnding": "미해결"
	}`)
	require.NoError(t, m.ApplyConfig(context.Background(), cfg))
	require.Len(t, m.cfg.Questions, 1)
	assert.Equal(t, "q1", m.cfg.Questions[0].ID)
	assert.Equal(t, "branch", m.cfg.Questions[0].Impact)
}
