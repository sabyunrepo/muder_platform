package ending_branch

import (
	"encoding/json"
	"fmt"

	"github.com/mmp-platform/server/internal/engine"
)

func validateConfig(cfg Config) error {
	seenQuestions := make(map[string]struct{}, len(cfg.Questions))
	for _, question := range cfg.Questions {
		if question.ID == "" {
			return fmt.Errorf("question id is required")
		}
		if _, dup := seenQuestions[question.ID]; dup {
			return fmt.Errorf("duplicate question id %q", question.ID)
		}
		seenQuestions[question.ID] = struct{}{}
		if question.Type != "single" && question.Type != "multi" {
			return fmt.Errorf("question %q has invalid type %q", question.ID, question.Type)
		}
		if question.Impact != "branch" && question.Impact != "score" {
			return fmt.Errorf("question %q has invalid impact %q", question.ID, question.Impact)
		}
		if len(question.Choices) == 0 {
			return fmt.Errorf("question %q requires at least one choice", question.ID)
		}
		if err := validateRespondents(question.ID, question.Respondents); err != nil {
			return err
		}
		if question.Impact == "score" {
			for _, choice := range question.Choices {
				if _, ok := question.ScoreMap[choice]; !ok {
					return fmt.Errorf("question %q scoreMap missing choice %q", question.ID, choice)
				}
			}
		}
	}
	for _, row := range cfg.Matrix {
		if row.Priority < 1 {
			return fmt.Errorf("matrix row priority must be >= 1")
		}
		if row.Ending == "" {
			return fmt.Errorf("matrix row ending is required")
		}
		if row.Conditions == nil {
			return fmt.Errorf("matrix row conditions are required")
		}
		if len(row.Conditions) > 0 {
			logic, err := json.Marshal(row.Conditions)
			if err != nil {
				return fmt.Errorf("matrix row %d conditions cannot be encoded", row.Priority)
			}
			if !engine.IsValid(logic) {
				return fmt.Errorf("matrix row %d conditions must be valid JSONLogic", row.Priority)
			}
		}
	}
	return nil
}

func validateRespondents(questionID string, respondents any) error {
	switch value := respondents.(type) {
	case nil:
		return nil
	case string:
		switch value {
		case "", "all":
			return nil
		case "some":
			return fmt.Errorf("question %q respondents value %q is not supported; use explicit player or target codes", questionID, value)
		default:
			return fmt.Errorf("question %q has invalid respondents value %q", questionID, value)
		}
	case []any:
		for _, item := range value {
			candidate, ok := item.(string)
			if !ok || candidate == "" {
				return fmt.Errorf("question %q respondents must contain non-empty strings", questionID)
			}
		}
		return nil
	case []string:
		for _, candidate := range value {
			if candidate == "" {
				return fmt.Errorf("question %q respondents must contain non-empty strings", questionID)
			}
		}
		return nil
	default:
		return fmt.Errorf("question %q has unsupported respondents type %T", questionID, respondents)
	}
}
