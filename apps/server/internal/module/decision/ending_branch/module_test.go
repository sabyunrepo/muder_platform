package ending_branch

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
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

// TestModule_BuildState_EmptyModule verifies BuildState returns valid JSON with
// zero-state metadata when the module has no config applied.
func TestModule_BuildState_EmptyModule(t *testing.T) {
	m := NewModule()
	raw, err := m.BuildState()
	require.NoError(t, err)
	require.NotEmpty(t, raw)

	// Must be valid JSON.
	var state map[string]any
	require.NoError(t, json.Unmarshal(raw, &state))
	assert.Equal(t, float64(0), state["questionCount"], "no questions loaded → count 0")
}

// TestModule_BuildState_WithConfig verifies BuildState reflects configured metadata.
func TestModule_BuildState_WithConfig(t *testing.T) {
	m := NewModule()
	cfg := json.RawMessage(`{
		"questions": [
			{"id": "q1", "text": "선택?", "type": "single", "choices": ["A","B"], "impact": "branch"},
			{"id": "q2", "text": "점수?", "type": "single", "choices": ["X","Y"], "impact": "score"}
		],
		"matrix": [],
		"defaultEnding": "좋은결말"
	}`)
	require.NoError(t, m.ApplyConfig(context.Background(), cfg))

	raw, err := m.BuildState()
	require.NoError(t, err)

	var state map[string]any
	require.NoError(t, json.Unmarshal(raw, &state))
	assert.Equal(t, float64(2), state["questionCount"])
	assert.Equal(t, "좋은결말", state["defaultEnding"])
}

func TestModule_HandleMessage_InvalidPayloadReturnsError(t *testing.T) {
	m := NewModule()
	err := m.HandleMessage(context.Background(), uuid.New(), "submit_answer", json.RawMessage(`{}`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "questionId is required")
}

// TestModule_Cleanup_ReturnsNil verifies Cleanup resets state and returns nil.
func TestModule_Cleanup_ReturnsNil(t *testing.T) {
	m := NewModule()
	cfg := json.RawMessage(`{
		"questions": [
			{"id": "q1", "text": "?", "type": "single", "choices": ["A"], "impact": "branch"}
		],
		"matrix": [], "defaultEnding": "end"
	}`)
	require.NoError(t, m.ApplyConfig(context.Background(), cfg))

	err := m.Cleanup(context.Background())
	require.NoError(t, err)

	// State must be zeroed after cleanup.
	raw, buildErr := m.BuildState()
	require.NoError(t, buildErr)
	var state map[string]any
	require.NoError(t, json.Unmarshal(raw, &state))
	assert.Equal(t, float64(0), state["questionCount"], "cleanup must zero question count")
}

// TestModule_Init_InvalidJSON_ReturnsError exercises the error path in Init
// (and the json.Unmarshal error branch in applyConfigLocked).
func TestModule_Init_InvalidJSON_ReturnsError(t *testing.T) {
	m := NewModule()
	err := m.Init(context.Background(), engine.ModuleDeps{}, json.RawMessage(`not valid json`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ending_branch: invalid config")
}

// TestModule_ApplyConfig_InvalidJSON_ReturnsError exercises the error path in
// ApplyConfig → applyConfigLocked with invalid JSON.
func TestModule_ApplyConfig_InvalidJSON_ReturnsError(t *testing.T) {
	m := NewModule()
	err := m.ApplyConfig(context.Background(), json.RawMessage(`{bad json`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ending_branch: invalid config")
}

// TestModule_ApplyConfig_EmptyObject covers the empty-JSON-object case (4 bytes).
// M9: review round-1 finding — nil-bytes and full config were tested but {} was not.
// Note: {} triggers the D-26 default: MultiVoteThreshold pointer is non-nil and 0.5.
func TestModule_ApplyConfig_EmptyObject(t *testing.T) {
	m := NewModule()

	// Applying {} must succeed with no error.
	err := m.ApplyConfig(context.Background(), json.RawMessage("{}"))
	require.NoError(t, err)

	// Config must be zero-valued except threshold (D-26 default 0.5).
	assert.Empty(t, m.cfg.Questions, "no questions after applying {}")
	assert.Empty(t, m.cfg.Matrix, "no matrix after applying {}")
	assert.Equal(t, "", m.cfg.DefaultEnding, "defaultEnding must be empty string after applying {}")
	require.NotNil(t, m.cfg.MultiVoteThreshold, "D-26: threshold pointer must be non-nil after applying {}")
	assert.Equal(t, 0.5, *m.cfg.MultiVoteThreshold, "D-26: default threshold must be 0.5 after applying {}")

	// BuildState must return valid JSON with zero-state shape.
	raw, err := m.BuildState()
	require.NoError(t, err)
	require.NotEmpty(t, raw)

	var state map[string]any
	require.NoError(t, json.Unmarshal(raw, &state))
	assert.Equal(t, float64(0), state["questionCount"], "zero-state: questionCount must be 0")
	assert.Equal(t, "", state["defaultEnding"], "zero-state: defaultEnding must be empty string")
}

// TestModule_ApplyConfig_MultiVoteThresholdDefault verifies D-26 runtime behaviour:
// absent → 0.5 default, explicit value kept, out-of-range → error.
func TestModule_ApplyConfig_MultiVoteThresholdDefault(t *testing.T) {
	cases := []struct {
		name            string
		input           string
		wantErr         bool
		wantErrContains string
		wantValue       float64
	}{
		{
			name:      "absent → default 0.5",
			input:     `{"questions":[],"matrix":[]}`,
			wantErr:   false,
			wantValue: 0.5,
		},
		{
			name:      "explicit 0.7 → kept",
			input:     `{"multiVoteThreshold":0.7}`,
			wantErr:   false,
			wantValue: 0.7,
		},
		{
			name:            "out of range 1.5 → error",
			input:           `{"multiVoteThreshold":1.5}`,
			wantErr:         true,
			wantErrContains: "multiVoteThreshold must be in [0, 1]",
		},
		{
			name:            "out of range -0.1 → error",
			input:           `{"multiVoteThreshold":-0.1}`,
			wantErr:         true,
			wantErrContains: "multiVoteThreshold must be in [0, 1]",
		},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			m := NewModule()
			err := m.ApplyConfig(context.Background(), json.RawMessage(tc.input))
			if tc.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErrContains)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, m.cfg.MultiVoteThreshold, "threshold pointer must be non-nil after apply")
			assert.Equal(t, tc.wantValue, *m.cfg.MultiVoteThreshold)
		})
	}
}

// TestModule_ApplyConfig_RejectsUnknownFields verifies the strict json.Decoder
// rejects payloads with unknown fields (round-2 CR finding).
func TestModule_ApplyConfig_RejectsUnknownFields(t *testing.T) {
	m := NewModule()
	err := m.ApplyConfig(context.Background(), json.RawMessage(`{"questions":[],"extraField":"x"}`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ending_branch: invalid config")
}

// TestModule_ApplyConfig_RejectsTrailingData verifies the strict json.Decoder
// rejects payloads with trailing data after the JSON value (round-2 CR finding).
func TestModule_ApplyConfig_RejectsTrailingData(t *testing.T) {
	m := NewModule()
	err := m.ApplyConfig(context.Background(), json.RawMessage(`{"questions":[]}{"trailing":"data"}`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "trailing data")
}

func TestModule_PR5_HandleMessageStoresOwnAnswerAndBuildStateForRedactsPeers(t *testing.T) {
	m := NewModule()
	threshold := 0.5
	cfg := Config{
		Questions:          []Question{{ID: "q1", Text: "누구를 믿나요?", Type: "single", Choices: []string{"탐정", "용의자"}, Impact: "branch"}},
		Matrix:             []MatrixRow{{Priority: 1, Conditions: map[string]any{"q1": "탐정"}, Ending: "ending-truth"}},
		DefaultEnding:      "ending-fallback",
		MultiVoteThreshold: &threshold,
	}
	data, err := json.Marshal(cfg)
	require.NoError(t, err)
	require.NoError(t, m.ApplyConfig(context.Background(), data))

	alice := uuid.New()
	bob := uuid.New()
	require.NoError(t, m.HandleMessage(context.Background(), alice, "ending_branch:submit_answer", json.RawMessage(`{"questionId":"q1","choices":["탐정"]}`)))
	require.NoError(t, m.HandleMessage(context.Background(), bob, "ending_branch:submit_answer", json.RawMessage(`{"questionId":"q1","choices":["용의자"]}`)))

	raw, err := m.BuildStateFor(alice)
	require.NoError(t, err)
	assert.Contains(t, string(raw), alice.String())
	assert.NotContains(t, string(raw), bob.String())
	assert.Contains(t, string(raw), "ending-truth")
}

func TestModule_PR5_HandleMessageRejectsUnknownQuestionAndChoice(t *testing.T) {
	m := NewModule()
	cfg := json.RawMessage(`{
		"questions":[{"id":"q1","text":"?","type":"single","choices":["A"],"impact":"branch"}],
		"matrix":[],
		"defaultEnding":"fallback"
	}`)
	require.NoError(t, m.ApplyConfig(context.Background(), cfg))

	playerID := uuid.New()
	err := m.HandleMessage(context.Background(), playerID, "ending_branch:submit_answer", json.RawMessage(`{"questionId":"missing","choices":["A"]}`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown question")

	err = m.HandleMessage(context.Background(), playerID, "ending_branch:submit_answer", json.RawMessage(`{"questionId":"q1","choices":["B"]}`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown choice")
}

func TestModule_PR5_CleanupClearsAnswersAndEvaluation(t *testing.T) {
	m := NewModule()
	require.NoError(t, m.ApplyConfig(context.Background(), json.RawMessage(`{
		"questions":[{"id":"q1","text":"?","type":"single","choices":["A"],"impact":"branch"}],
		"matrix":[{"priority":1,"conditions":{"q1":"A"},"ending":"ending-a"}],
		"defaultEnding":"fallback"
	}`)))
	playerID := uuid.New()
	require.NoError(t, m.HandleMessage(context.Background(), playerID, "ending_branch:submit_answer", json.RawMessage(`{"questionId":"q1","choices":["A"]}`)))

	require.NoError(t, m.Cleanup(context.Background()))
	raw, err := m.BuildStateFor(playerID)
	require.NoError(t, err)
	assert.NotContains(t, string(raw), playerID.String())
	assert.NotContains(t, string(raw), "ending-a")
}
