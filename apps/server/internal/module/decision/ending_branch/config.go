package ending_branch

import (
	"encoding/json"
	"fmt"
)

// Question represents one editor-defined question (D-12 + D-24).
// Impact is "branch" (matrix-driving) OR "score" (per-respondent accumulation).
type Question struct {
	ID          string          `json:"id"`
	Text        string          `json:"text"`
	Type        string          `json:"type"` // "single" | "multi"
	Choices     []string        `json:"choices"`
	Respondents any             `json:"respondents,omitempty"` // []string | "all" — validated at config apply
	Target      *QuestionTarget `json:"target,omitempty"`
	Impact      string          `json:"impact"` // "branch" | "score"
	ScoreMap    map[string]int  `json:"scoreMap,omitempty"`
}

type QuestionTarget struct {
	Type         string   `json:"type"`
	CharacterIDs []string `json:"characterIds,omitempty"`
}

// MatrixRow is one priority-ordered branching rule. Runtime evaluation passes
// Conditions to the shared JSONLogic evaluator.
type MatrixRow struct {
	ID         string         `json:"id,omitempty"`
	Priority   int            `json:"priority"`
	Conditions map[string]any `json:"conditions"`
	Ending     string         `json:"ending"`
}

func (r *MatrixRow) UnmarshalJSON(data []byte) error {
	type matrixRowAlias MatrixRow
	var raw struct {
		matrixRowAlias
		Condition map[string]any `json:"condition"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	*r = MatrixRow(raw.matrixRowAlias)
	if r.Conditions != nil && raw.Condition != nil {
		return fmt.Errorf("matrix row cannot contain both conditions and legacy condition")
	}
	if r.Conditions == nil {
		r.Conditions = raw.Condition
	}
	return nil
}

// Config is the typed shape of module_configs.ending_branch.
type Config struct {
	Questions          []Question  `json:"questions"`
	Matrix             []MatrixRow `json:"matrix"`
	DefaultEnding      string      `json:"defaultEnding,omitempty"`
	MultiVoteThreshold *float64    `json:"multiVoteThreshold,omitempty"` // D-26 default 0.5; nil → apply default at runtime
}
