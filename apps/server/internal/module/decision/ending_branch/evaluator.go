package ending_branch

import (
	"fmt"
	"sort"
)

const defaultMultiVoteThreshold = 0.5

// AnswerSet stores player answers by player id then question id.
// Each answer is a list so single-choice and multi-choice questions share one shape.
type AnswerSet map[string]map[string][]string

// EvaluationResult is the runtime outcome of the ending_branch matrix.
type EvaluationResult struct {
	Ending            string                    `json:"ending"`
	MatchedPriority   int                       `json:"matchedPriority,omitempty"`
	TotalScore        int                       `json:"totalScore"`
	PlayerScores      map[string]int            `json:"playerScores"`
	QuestionBreakdown map[string]map[string]int `json:"questionBreakdown"`
}

// Evaluate applies configured score questions and priority-ordered branch matrix.
func Evaluate(cfg Config, answers AnswerSet) (EvaluationResult, error) {
	threshold := defaultMultiVoteThreshold
	if cfg.MultiVoteThreshold != nil {
		threshold = *cfg.MultiVoteThreshold
	}

	result := EvaluationResult{
		Ending:            cfg.DefaultEnding,
		PlayerScores:      map[string]int{},
		QuestionBreakdown: map[string]map[string]int{},
	}

	questionByID := map[string]Question{}
	for _, question := range cfg.Questions {
		questionByID[question.ID] = question
		result.QuestionBreakdown[question.ID] = map[string]int{}
	}

	for playerID, byQuestion := range answers {
		if _, ok := result.PlayerScores[playerID]; !ok {
			result.PlayerScores[playerID] = 0
		}
		for questionID, choices := range byQuestion {
			question, ok := questionByID[questionID]
			if !ok {
				continue
			}
			for _, choice := range choices {
				if result.QuestionBreakdown[questionID] == nil {
					result.QuestionBreakdown[questionID] = map[string]int{}
				}
				result.QuestionBreakdown[questionID][choice]++
				if question.Impact == "score" {
					result.PlayerScores[playerID] += question.ScoreMap[choice]
					result.TotalScore += question.ScoreMap[choice]
				}
			}
		}
	}

	selected := aggregateBranchSelections(cfg.Questions, result.QuestionBreakdown, len(answers), threshold)
	rows := append([]MatrixRow(nil), cfg.Matrix...)
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].Priority < rows[j].Priority })
	for _, row := range rows {
		matched, err := matchConditions(row.Conditions, selected)
		if err != nil {
			return EvaluationResult{}, err
		}
		if matched {
			result.Ending = row.Ending
			result.MatchedPriority = row.Priority
			return result, nil
		}
	}

	return result, nil
}

func aggregateBranchSelections(
	questions []Question,
	breakdown map[string]map[string]int,
	respondentCount int,
	threshold float64,
) map[string]map[string]bool {
	selected := map[string]map[string]bool{}
	if respondentCount == 0 {
		return selected
	}
	for _, question := range questions {
		if question.Impact != "branch" {
			continue
		}
		selected[question.ID] = map[string]bool{}
		for choice, count := range breakdown[question.ID] {
			if float64(count)/float64(respondentCount) >= threshold {
				selected[question.ID][choice] = true
			}
		}
	}
	return selected
}

func matchConditions(conditions map[string]any, selected map[string]map[string]bool) (bool, error) {
	for questionID, condition := range conditions {
		matched, err := matchCondition(questionID, condition, selected)
		if err != nil || !matched {
			return matched, err
		}
	}
	return true, nil
}

func matchCondition(questionID string, condition any, selected map[string]map[string]bool) (bool, error) {
	switch typed := condition.(type) {
	case string:
		if typed == "*" {
			return true, nil
		}
		return selected[questionID][typed], nil
	case []string:
		return allChoicesSelected(questionID, typed, selected), nil
	case []any:
		choices := make([]string, 0, len(typed))
		for _, raw := range typed {
			choice, ok := raw.(string)
			if !ok {
				return false, fmt.Errorf("ending_branch: unsupported condition value for %q: %T", questionID, raw)
			}
			if choice == "*" {
				continue
			}
			choices = append(choices, choice)
		}
		return allChoicesSelected(questionID, choices, selected), nil
	default:
		return false, fmt.Errorf("ending_branch: unsupported condition for %q: %T", questionID, condition)
	}
}

func allChoicesSelected(questionID string, choices []string, selected map[string]map[string]bool) bool {
	for _, choice := range choices {
		if choice == "*" {
			continue
		}
		if !selected[questionID][choice] {
			return false
		}
	}
	return true
}
