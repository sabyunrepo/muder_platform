package ending_branch

// Question represents one editor-defined question (D-12 + D-24).
// Impact is "branch" (matrix-driving) OR "score" (per-respondent accumulation).
type Question struct {
	ID          string         `json:"id"`
	Text        string         `json:"text"`
	Type        string         `json:"type"`              // "single" | "multi"
	Choices     []string       `json:"choices"`
	Respondents any            `json:"respondents,omitempty"` // []string | "all" | "some" — runtime validate
	Impact      string         `json:"impact"`            // "branch" | "score"
	ScoreMap    map[string]int `json:"scoreMap,omitempty"`
}

// MatrixRow is one priority-ordered branching rule. JSONLogic evaluator (PR-5)
// converts conditions to a JSONLogic AST.
type MatrixRow struct {
	Priority   int            `json:"priority"`
	Conditions map[string]any `json:"conditions"`
	Ending     string         `json:"ending"`
}

// Config is the typed shape of module_configs.ending_branch.
type Config struct {
	Questions          []Question  `json:"questions"`
	Matrix             []MatrixRow `json:"matrix"`
	DefaultEnding      string      `json:"defaultEnding,omitempty"`
	MultiVoteThreshold float64     `json:"multiVoteThreshold,omitempty"` // D-26 default 0.5
}
