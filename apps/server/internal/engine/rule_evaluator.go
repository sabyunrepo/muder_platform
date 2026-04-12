package engine

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/diegoholiveira/jsonlogic/v3"
)

// RuleEvaluator evaluates JSON Logic expressions against game state context.
// It caches parsed context per session lifetime to avoid repeated marshalling.
type RuleEvaluator struct {
	mu          sync.RWMutex
	contextJSON json.RawMessage // cached marshalled context
}

// NewRuleEvaluator creates a new evaluator instance. One per session.
func NewRuleEvaluator() *RuleEvaluator {
	return &RuleEvaluator{}
}

// EvalResult holds the outcome of a rule evaluation.
type EvalResult struct {
	// Value is the raw JSON output from the evaluation.
	Value json.RawMessage
	// Bool is the boolean interpretation of the result.
	Bool bool
}

// SetContext updates the cached evaluation context from a GameState.
// Call this whenever game state changes (after Apply, phase transition, etc.).
func (re *RuleEvaluator) SetContext(state GameState) error {
	ctx := stateToContext(state)
	data, err := json.Marshal(ctx)
	if err != nil {
		return fmt.Errorf("rule_evaluator: marshal context: %w", err)
	}
	re.mu.Lock()
	re.contextJSON = data
	re.mu.Unlock()
	return nil
}

// SetContextRaw sets the evaluation context from pre-marshalled JSON.
// Useful when the caller already has the context as JSON.
func (re *RuleEvaluator) SetContextRaw(data json.RawMessage) {
	re.mu.Lock()
	re.contextJSON = data
	re.mu.Unlock()
}

// Evaluate runs a JSON Logic expression against the current context.
// Returns EvalResult with the raw output and its boolean interpretation.
func (re *RuleEvaluator) Evaluate(logic json.RawMessage) (EvalResult, error) {
	if len(logic) == 0 {
		return EvalResult{Bool: true, Value: jsonTrue}, nil
	}

	re.mu.RLock()
	ctx := re.contextJSON
	re.mu.RUnlock()

	if len(ctx) == 0 {
		ctx = jsonEmptyObj
	}

	result, err := jsonlogic.ApplyRaw(logic, ctx)
	if err != nil {
		return EvalResult{}, fmt.Errorf("rule_evaluator: %w", err)
	}

	return EvalResult{
		Value: result,
		Bool:  toBool(result),
	}, nil
}

// EvaluateRule is a convenience that evaluates a Rule's Logic field.
func (re *RuleEvaluator) EvaluateRule(rule Rule) (EvalResult, error) {
	return re.Evaluate(rule.Logic)
}

// EvaluateAll evaluates all rules from a RuleProvider and returns results
// keyed by rule ID. Stops on first error.
func (re *RuleEvaluator) EvaluateAll(provider RuleProvider) (map[string]EvalResult, error) {
	rules := provider.GetRules()
	results := make(map[string]EvalResult, len(rules))
	for _, r := range rules {
		res, err := re.EvaluateRule(r)
		if err != nil {
			return nil, fmt.Errorf("rule %q: %w", r.ID, err)
		}
		results[r.ID] = res
	}
	return results, nil
}

// IsValid checks whether the given JSON Logic expression is syntactically valid.
func IsValid(logic json.RawMessage) bool {
	var parsed any
	if err := json.Unmarshal(logic, &parsed); err != nil {
		return false
	}
	return jsonlogic.ValidateJsonLogic(parsed)
}

// stateToContext converts a GameState into a flat map for JSON Logic var resolution.
// Result shape: {"sessionId": "...", "phase": "...", "modules": {"modName": {...}}}
func stateToContext(state GameState) map[string]any {
	ctx := map[string]any{
		"sessionId": state.SessionID.String(),
		"phase":     string(state.Phase),
	}

	if len(state.Modules) > 0 {
		modules := make(map[string]any, len(state.Modules))
		for k, v := range state.Modules {
			var parsed any
			if err := json.Unmarshal(v, &parsed); err != nil {
				// Keep raw string on unmarshal failure.
				modules[k] = string(v)
				continue
			}
			modules[k] = parsed
		}
		ctx["modules"] = modules
	}

	return ctx
}

// toBool interprets a JSON value as a boolean following JSON Logic truthiness:
// false, null, 0, "", [], {} are falsy; everything else is truthy.
func toBool(raw json.RawMessage) bool {
	s := string(raw)
	switch s {
	case "true":
		return true
	case "false", "null", "0", `""`, "[]", "{}":
		return false
	}

	// Number check: 0 and 0.0 are falsy.
	var n float64
	if err := json.Unmarshal(raw, &n); err == nil {
		return n != 0
	}

	// Empty array/object check.
	var arr []any
	if err := json.Unmarshal(raw, &arr); err == nil {
		return len(arr) > 0
	}

	// Non-empty string or object → truthy.
	return len(raw) > 0
}

var (
	jsonTrue     = json.RawMessage(`true`)
	jsonEmptyObj = json.RawMessage(`{}`)
)
