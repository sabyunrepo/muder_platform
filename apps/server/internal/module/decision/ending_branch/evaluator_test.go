package ending_branch

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEvaluate_PriorityMatrixSelectsFirstMatchingEnding(t *testing.T) {
	threshold := 0.5
	cfg := Config{
		Questions: []Question{{ID: "q1", Type: "single", Choices: []string{"자백", "침묵"}, Impact: "branch"}},
		Matrix: []MatrixRow{
			{Priority: 2, Conditions: map[string]any{"q1": "*"}, Ending: "ending-default-like"},
			{Priority: 1, Conditions: map[string]any{"q1": "자백"}, Ending: "ending-truth"},
		},
		DefaultEnding:      "ending-fallback",
		MultiVoteThreshold: &threshold,
	}

	result, err := Evaluate(cfg, AnswerSet{"player-1": {"q1": []string{"자백"}}})

	require.NoError(t, err)
	assert.Equal(t, "ending-truth", result.Ending)
	assert.Equal(t, 1, result.MatchedPriority)
}

func TestEvaluate_MultiChoiceThresholdAndScoreBreakdown(t *testing.T) {
	threshold := 0.6
	cfg := Config{
		Questions: []Question{
			{ID: "q1", Type: "multi", Choices: []string{"A", "B"}, Impact: "branch"},
			{ID: "q2", Type: "single", Choices: []string{"선행", "악행"}, Impact: "score", ScoreMap: map[string]int{"선행": 2, "악행": -1}},
		},
		Matrix:             []MatrixRow{{Priority: 1, Conditions: map[string]any{"q1": []any{"A", "B"}}, Ending: "ending-all"}},
		DefaultEnding:      "ending-fallback",
		MultiVoteThreshold: &threshold,
	}
	answers := AnswerSet{
		"p1": {"q1": []string{"A", "B"}, "q2": []string{"선행"}},
		"p2": {"q1": []string{"A"}, "q2": []string{"악행"}},
		"p3": {"q1": []string{"A", "B"}, "q2": []string{"선행"}},
	}

	result, err := Evaluate(cfg, answers)

	require.NoError(t, err)
	assert.Equal(t, "ending-all", result.Ending)
	assert.Equal(t, 3, result.TotalScore)
	assert.Equal(t, 2, result.PlayerScores["p1"])
	assert.Equal(t, -1, result.PlayerScores["p2"])
	assert.Equal(t, map[string]int{"A": 3, "B": 2}, result.QuestionBreakdown["q1"])
}

func TestEvaluate_NoMatrixMatchFallsBackToDefaultEnding(t *testing.T) {
	cfg := Config{
		Questions:     []Question{{ID: "q1", Type: "single", Choices: []string{"A", "B"}, Impact: "branch"}},
		Matrix:        []MatrixRow{{Priority: 1, Conditions: map[string]any{"q1": "B"}, Ending: "ending-b"}},
		DefaultEnding: "ending-fallback",
	}

	result, err := Evaluate(cfg, AnswerSet{"p1": {"q1": []string{"A"}}})

	require.NoError(t, err)
	assert.Equal(t, "ending-fallback", result.Ending)
	assert.Equal(t, 0, result.MatchedPriority)
}

func TestEvaluate_InvalidConditionTypeReturnsError(t *testing.T) {
	cfg := Config{
		Questions: []Question{{ID: "q1", Type: "single", Choices: []string{"A"}, Impact: "branch"}},
		Matrix:    []MatrixRow{{Priority: 1, Conditions: map[string]any{"q1": 123}, Ending: "ending-a"}},
	}

	_, err := Evaluate(cfg, AnswerSet{"p1": {"q1": []string{"A"}}})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported condition")
}
