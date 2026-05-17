package ending_branch

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/engine"
)

type submittedAnswer struct {
	QuestionID string   `json:"question_id"`
	Choice     string   `json:"choice,omitempty"`
	Choices    []string `json:"choices,omitempty"`
}

type evaluationResult struct {
	SelectedEnding  string          `json:"selectedEnding"`
	MatchedRuleID   string          `json:"matchedRuleId,omitempty"`
	MatchedPriority *int            `json:"matchedPriority,omitempty"`
	Fallback        bool            `json:"fallback"`
	AnswerSummary   []answerSummary `json:"answerSummary,omitempty"`
	Scores          map[string]int  `json:"scores,omitempty"`
}

type answerSummary struct {
	QuestionID       string         `json:"questionId"`
	Answered         int            `json:"answered"`
	Counts           map[string]int `json:"counts"`
	WinningChoice    string         `json:"winningChoice,omitempty"`
	ThresholdChoices []string       `json:"thresholdChoices,omitempty"`
}

func (m *Module) submitAnswer(ctx context.Context, playerID uuid.UUID, payload json.RawMessage) error {
	var input submittedAnswer
	if err := json.Unmarshal(payload, &input); err != nil {
		return fmt.Errorf("ending_branch: invalid answer payload: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	question, ok := findQuestion(m.cfg.Questions, input.QuestionID)
	if !ok {
		return fmt.Errorf("ending_branch: unknown question %q", input.QuestionID)
	}
	if !respondentAllowed(ctx, m.deps, question, playerID) {
		return fmt.Errorf("ending_branch: player is not allowed to answer question %q", input.QuestionID)
	}
	choices, err := normalizeAnswerChoices(question, input)
	if err != nil {
		return err
	}
	if m.answers == nil {
		m.answers = make(map[string]map[uuid.UUID][]string)
	}
	if m.answers[question.ID] == nil {
		m.answers[question.ID] = make(map[uuid.UUID][]string)
	}
	m.answers[question.ID][playerID] = choices
	m.result = nil
	return nil
}

func (m *Module) evaluateLocked(ctx context.Context) (*evaluationResult, error) {
	evalCtx := m.evaluationContextLocked(ctx)
	ctxJSON, err := json.Marshal(evalCtx)
	if err != nil {
		return nil, fmt.Errorf("ending_branch: marshal evaluation context: %w", err)
	}
	evaluator := engine.NewRuleEvaluator()
	evaluator.SetContextRaw(ctxJSON)

	rows := append([]MatrixRow(nil), m.cfg.Matrix...)
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].Priority < rows[j].Priority })
	for _, row := range rows {
		logic, err := json.Marshal(row.Conditions)
		if err != nil {
			return nil, fmt.Errorf("ending_branch: marshal matrix row %d: %w", row.Priority, err)
		}
		res, err := evaluator.Evaluate(logic)
		if err != nil {
			return nil, fmt.Errorf("ending_branch: evaluate matrix row %d: %w", row.Priority, err)
		}
		if res.Bool {
			priority := row.Priority
			return &evaluationResult{
				SelectedEnding:  row.Ending,
				MatchedRuleID:   row.ID,
				MatchedPriority: &priority,
				Fallback:        false,
				AnswerSummary:   m.answerSummariesLocked(),
				Scores:          scoreTotals(evalCtx),
			}, nil
		}
	}
	return &evaluationResult{
		SelectedEnding: m.cfg.DefaultEnding,
		Fallback:       true,
		AnswerSummary:  m.answerSummariesLocked(),
		Scores:         scoreTotals(evalCtx),
	}, nil
}

func (m *Module) evaluationContextLocked(ctx context.Context) map[string]any {
	answers := make(map[string]any, len(m.cfg.Questions))
	scores := make(map[string]int)
	for _, question := range m.cfg.Questions {
		byPlayer := m.answers[question.ID]
		counts := make(map[string]int, len(question.Choices))
		for playerID, choices := range byPlayer {
			for _, choice := range choices {
				counts[choice]++
				if question.Impact == "score" {
					scores[playerID.String()] += question.ScoreMap[choice]
				}
			}
		}
		answers[question.ID] = map[string]any{
			"counts":   counts,
			"winning":  winningChoice(counts),
			"choices":  thresholdChoices(counts, len(byPlayer), m.thresholdLocked()),
			"answered": len(byPlayer),
		}
	}
	return map[string]any{"answers": answers, "scores": scores, "characters": m.characterAliveContextLocked(ctx)}
}

func (m *Module) characterAliveContextLocked(ctx context.Context) map[string]any {
	provider, ok := m.deps.PlayerInfoProvider.(engine.PlayerRuntimeRosterProvider)
	if !ok || provider == nil {
		return map[string]any{}
	}
	players := provider.PlayerRuntimeRoster(ctx)
	characters := make(map[string]any, len(players))
	for _, player := range players {
		if player.TargetCode == "" {
			continue
		}
		characters[player.TargetCode] = map[string]any{"alive": player.IsAlive}
	}
	return characters
}

func scoreTotals(ctx map[string]any) map[string]int {
	scores, ok := ctx["scores"].(map[string]int)
	if !ok || len(scores) == 0 {
		return nil
	}
	out := make(map[string]int, len(scores))
	for k, v := range scores {
		out[k] = v
	}
	return out
}

func (m *Module) answerSummariesLocked() []answerSummary {
	if len(m.cfg.Questions) == 0 {
		return nil
	}
	summaries := make([]answerSummary, 0, len(m.cfg.Questions))
	threshold := m.thresholdLocked()
	for _, question := range m.cfg.Questions {
		byPlayer := m.answers[question.ID]
		counts := make(map[string]int, len(question.Choices))
		for _, choices := range byPlayer {
			for _, choice := range choices {
				counts[choice]++
			}
		}
		summaries = append(summaries, answerSummary{
			QuestionID:       question.ID,
			Answered:         len(byPlayer),
			Counts:           counts,
			WinningChoice:    winningChoice(counts),
			ThresholdChoices: thresholdChoices(counts, len(byPlayer), threshold),
		})
	}
	return summaries
}

func findQuestion(questions []Question, questionID string) (Question, bool) {
	for _, question := range questions {
		if question.ID == questionID {
			return question, true
		}
	}
	return Question{}, false
}

func normalizeAnswerChoices(question Question, input submittedAnswer) ([]string, error) {
	choices := input.Choices
	if input.Choice != "" {
		choices = append([]string{input.Choice}, choices...)
	}
	if question.Type == "single" && len(choices) != 1 {
		return nil, fmt.Errorf("ending_branch: question %q expects exactly one choice", question.ID)
	}
	if len(choices) == 0 {
		return nil, fmt.Errorf("ending_branch: question %q requires at least one choice", question.ID)
	}
	allowed := make(map[string]struct{}, len(question.Choices))
	for _, choice := range question.Choices {
		allowed[choice] = struct{}{}
	}
	seen := make(map[string]struct{}, len(choices))
	out := make([]string, 0, len(choices))
	for _, choice := range choices {
		if _, ok := allowed[choice]; !ok {
			return nil, fmt.Errorf("ending_branch: invalid choice %q for question %q", choice, question.ID)
		}
		if _, dup := seen[choice]; dup {
			continue
		}
		seen[choice] = struct{}{}
		out = append(out, choice)
	}
	return out, nil
}

func respondentAllowed(ctx context.Context, deps engine.ModuleDeps, question Question, playerID uuid.UUID) bool {
	if question.Target != nil {
		switch question.Target.Type {
		case "all_players", "":
			return true
		case "specific_players":
			items := make([]any, len(question.Target.CharacterIDs))
			for i, item := range question.Target.CharacterIDs {
				items[i] = item
			}
			return respondentListAllows(ctx, deps, items, playerID)
		default:
			return false
		}
	}

	switch respondents := question.Respondents.(type) {
	case nil:
		return true
	case string:
		if respondents == "some" && deps.Logger != nil {
			deps.Logger.Printf("ending_branch: unsupported respondents value %q", respondents)
		}
		if respondents == "" || respondents == "all" {
			return true
		}
		return respondentListAllows(ctx, deps, []any{respondents}, playerID)
	case []any:
		return respondentListAllows(ctx, deps, respondents, playerID)
	case []string:
		items := make([]any, len(respondents))
		for i, item := range respondents {
			items[i] = item
		}
		return respondentListAllows(ctx, deps, items, playerID)
	default:
		return false
	}
}

func respondentListAllows(ctx context.Context, deps engine.ModuleDeps, respondents []any, playerID uuid.UUID) bool {
	for _, item := range respondents {
		candidate, ok := item.(string)
		if !ok || candidate == "" {
			continue
		}
		if candidate == playerID.String() {
			return true
		}
		if deps.PlayerInfoProvider != nil {
			if resolved, ok := deps.PlayerInfoProvider.ResolvePlayerID(ctx, candidate); ok && resolved == playerID {
				return true
			}
		}
	}
	return false
}

func winningChoice(counts map[string]int) string {
	bestChoice := ""
	bestCount := 0
	for choice, count := range counts {
		if count > bestCount || (count == bestCount && count > 0 && (bestChoice == "" || choice < bestChoice)) {
			bestChoice = choice
			bestCount = count
		}
	}
	return bestChoice
}

func thresholdChoices(counts map[string]int, respondentCount int, threshold float64) []string {
	if respondentCount == 0 {
		return nil
	}
	out := make([]string, 0, len(counts))
	for choice, count := range counts {
		if float64(count)/float64(respondentCount) >= threshold {
			out = append(out, choice)
		}
	}
	sort.Strings(out)
	return out
}

func (m *Module) thresholdLocked() float64 {
	if m.cfg.MultiVoteThreshold == nil {
		return 0.5
	}
	return *m.cfg.MultiVoteThreshold
}

func (m *Module) stateLocked(playerID *uuid.UUID) (json.RawMessage, error) {
	state := map[string]any{
		"questionCount": len(m.cfg.Questions),
		"defaultEnding": m.cfg.DefaultEnding,
		"evaluated":     m.result != nil,
	}
	if m.result != nil {
		state["selectedEnding"] = m.result.SelectedEnding
		state["fallback"] = m.result.Fallback
		if m.result.MatchedPriority != nil {
			state["matchedPriority"] = *m.result.MatchedPriority
		}
		result := map[string]any{
			"selectedEnding": m.result.SelectedEnding,
			"fallback":       m.result.Fallback,
			"answerSummary":  m.result.AnswerSummary,
		}
		if m.result.MatchedRuleID != "" {
			result["matchedRuleId"] = m.result.MatchedRuleID
		}
		if m.result.MatchedPriority != nil {
			result["matchedPriority"] = *m.result.MatchedPriority
		}
		if playerID == nil {
			result["scores"] = copyScores(m.result.Scores)
		} else if score, ok := m.result.Scores[playerID.String()]; ok {
			result["myScore"] = score
			state["myScore"] = score
		}
		state["result"] = result
	}
	if playerID != nil {
		myAnswers := make(map[string][]string)
		for questionID, byPlayer := range m.answers {
			if choices, ok := byPlayer[*playerID]; ok {
				myAnswers[questionID] = append([]string(nil), choices...)
			}
		}
		state["myAnswers"] = myAnswers
	}
	return json.Marshal(state)
}

func copyScores(scores map[string]int) map[string]int {
	if len(scores) == 0 {
		return nil
	}
	out := make(map[string]int, len(scores))
	for playerID, score := range scores {
		out[playerID] = score
	}
	return out
}
