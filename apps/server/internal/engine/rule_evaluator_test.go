package engine

import (
	"encoding/json"
	"sync"
	"testing"

	"github.com/google/uuid"
)

func TestEvaluate_BasicOperators(t *testing.T) {
	re := NewRuleEvaluator()

	tests := []struct {
		name  string
		logic string
		want  bool
	}{
		{"equals true", `{"==":[1,1]}`, true},
		{"equals false", `{"==":[1,2]}`, false},
		{"not equals", `{"!=":[1,2]}`, true},
		{"less than", `{"<":[1,2]}`, true},
		{"greater than", `{">":[2,1]}`, true},
		{"less or equal", `{"<=":[2,2]}`, true},
		{"greater or equal", `{">=":[3,2]}`, true},
		{"and true", `{"and":[true,true]}`, true},
		{"and false", `{"and":[true,false]}`, false},
		{"or true", `{"or":[false,true]}`, true},
		{"or false", `{"or":[false,false]}`, false},
		{"not true", `{"!":[true]}`, false},
		{"not false", `{"!":[false]}`, true},
		{"if true branch", `{"if":[true,"yes","no"]}`, true},
		{"if false branch", `{"if":[false,"yes","no"]}`, true}, // "no" is truthy (non-empty string)
		{"if false returns zero", `{"if":[false,1,0]}`, false},
		{"add", `{"+":[1,2]}`, true},
		{"multiply", `{"*":[3,4]}`, true},
		{"subtract zero", `{"-":[5,5]}`, false},
		{"in array", `{"in":["a",["a","b","c"]]}`, true},
		{"not in array", `{"in":["d",["a","b","c"]]}`, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := re.Evaluate(json.RawMessage(tt.logic))
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Bool != tt.want {
				t.Errorf("got Bool=%v, want %v (raw=%s)", res.Bool, tt.want, res.Value)
			}
		})
	}
}

func TestEvaluate_VarResolution(t *testing.T) {
	re := NewRuleEvaluator()
	re.SetContextRaw(json.RawMessage(`{
		"phase": "voting",
		"modules": {
			"decision": {"votesCount": 5, "threshold": 3},
			"cluedist": {"revealed": ["clue1", "clue2"]}
		}
	}`))

	tests := []struct {
		name  string
		logic string
		want  bool
	}{
		{"phase equals", `{"==": [{"var": "phase"}, "voting"]}`, true},
		{"phase not equals", `{"==": [{"var": "phase"}, "discussion"]}`, false},
		{"nested var", `{">": [{"var": "modules.decision.votesCount"}, 3]}`, true},
		{"nested var equal", `{"==": [{"var": "modules.decision.threshold"}, 3]}`, true},
		{"array length via in", `{"in": ["clue1", {"var": "modules.cluedist.revealed"}]}`, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := re.Evaluate(json.RawMessage(tt.logic))
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Bool != tt.want {
				t.Errorf("got Bool=%v, want %v (raw=%s)", res.Bool, tt.want, res.Value)
			}
		})
	}
}

func TestEvaluate_SetContext(t *testing.T) {
	re := NewRuleEvaluator()
	sid := uuid.New()

	state := GameState{
		SessionID: sid,
		Phase:     "introduction",
		Modules: map[string]json.RawMessage{
			"core": json.RawMessage(`{"playerCount": 6}`),
		},
	}

	if err := re.SetContext(state); err != nil {
		t.Fatalf("SetContext: %v", err)
	}

	// Check phase var
	res, err := re.Evaluate(json.RawMessage(`{"==": [{"var": "phase"}, "introduction"]}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Bool {
		t.Error("expected true for phase==introduction")
	}

	// Check module var
	res, err = re.Evaluate(json.RawMessage(`{">": [{"var": "modules.core.playerCount"}, 4]}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Bool {
		t.Error("expected true for playerCount > 4")
	}

	// Check sessionId
	res, err = re.Evaluate(json.RawMessage(`{"==": [{"var": "sessionId"}, "` + sid.String() + `"]}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Bool {
		t.Error("expected true for sessionId match")
	}
}

func TestEvaluate_EmptyLogic(t *testing.T) {
	re := NewRuleEvaluator()
	res, err := re.Evaluate(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Bool {
		t.Error("empty logic should return true")
	}
}

func TestEvaluate_EmptyContext(t *testing.T) {
	re := NewRuleEvaluator()
	res, err := re.Evaluate(json.RawMessage(`{"==": [1, 1]}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Bool {
		t.Error("context-free rule should still evaluate")
	}
}

func TestEvaluate_MissingVar(t *testing.T) {
	re := NewRuleEvaluator()
	re.SetContextRaw(json.RawMessage(`{"phase": "voting"}`))

	// Missing var with default
	res, err := re.Evaluate(json.RawMessage(`{"var": ["nonexistent", "fallback"]}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(res.Value) != `"fallback"` {
		t.Errorf("expected fallback, got %s", res.Value)
	}
}

func TestEvaluate_DeepNest(t *testing.T) {
	re := NewRuleEvaluator()

	// 5 levels of nested and/or
	logic := `{"and": [
		{"or": [
			{"==": [1, 1]},
			{"and": [
				{"<": [2, 3]},
				{">": [5, 4]}
			]}
		]},
		{"!": [false]}
	]}`

	res, err := re.Evaluate(json.RawMessage(logic))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Bool {
		t.Error("deep nested expression should be true")
	}
}

func TestEvaluateRule(t *testing.T) {
	re := NewRuleEvaluator()
	re.SetContextRaw(json.RawMessage(`{"phase": "voting"}`))

	rule := Rule{
		ID:    "check-phase",
		Logic: json.RawMessage(`{"==": [{"var": "phase"}, "voting"]}`),
	}

	res, err := re.EvaluateRule(rule)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.Bool {
		t.Error("rule should evaluate to true")
	}
}

type mockRuleProvider struct {
	rules []Rule
}

func (m *mockRuleProvider) GetRules() []Rule { return m.rules }

func TestEvaluateAll(t *testing.T) {
	re := NewRuleEvaluator()
	re.SetContextRaw(json.RawMessage(`{"phase": "voting", "modules": {"decision": {"votes": 5}}}`))

	provider := &mockRuleProvider{
		rules: []Rule{
			{ID: "phase-check", Logic: json.RawMessage(`{"==": [{"var": "phase"}, "voting"]}`)},
			{ID: "votes-enough", Logic: json.RawMessage(`{">": [{"var": "modules.decision.votes"}, 3]}`)},
			{ID: "always-false", Logic: json.RawMessage(`{"==": [1, 2]}`)},
		},
	}

	results, err := re.EvaluateAll(provider)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}
	if !results["phase-check"].Bool {
		t.Error("phase-check should be true")
	}
	if !results["votes-enough"].Bool {
		t.Error("votes-enough should be true")
	}
	if results["always-false"].Bool {
		t.Error("always-false should be false")
	}
}

func TestIsValid(t *testing.T) {
	tests := []struct {
		name  string
		logic string
		want  bool
	}{
		{"valid eq", `{"==":[1,1]}`, true},
		{"valid var", `{"var":"x"}`, true},
		{"just value", `true`, true},
		{"number", `42`, true},
		{"invalid json", `{bad`, false},
		{"empty", ``, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValid(json.RawMessage(tt.logic))
			if got != tt.want {
				t.Errorf("IsValid(%s) = %v, want %v", tt.logic, got, tt.want)
			}
		})
	}
}

func TestToBool(t *testing.T) {
	tests := []struct {
		raw  string
		want bool
	}{
		{`true`, true},
		{`false`, false},
		{`null`, false},
		{`0`, false},
		{`1`, true},
		{`-1`, true},
		{`0.0`, false},
		{`3.14`, true},
		{`""`, false},
		{`"hello"`, true},
		{`[]`, false},
		{`[1]`, true},
		{`{}`, false},
	}

	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			got := toBool(json.RawMessage(tt.raw))
			if got != tt.want {
				t.Errorf("toBool(%s) = %v, want %v", tt.raw, got, tt.want)
			}
		})
	}
}

func TestEvaluate_ConcurrentSafe(t *testing.T) {
	re := NewRuleEvaluator()
	re.SetContextRaw(json.RawMessage(`{"x": 10}`))

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := re.Evaluate(json.RawMessage(`{">": [{"var": "x"}, 5]}`))
			if err != nil {
				t.Errorf("concurrent eval error: %v", err)
			}
			if !res.Bool {
				t.Error("concurrent eval should be true")
			}
		}()
	}
	wg.Wait()
}

func TestEvaluate_ConcurrentSetAndEval(t *testing.T) {
	re := NewRuleEvaluator()

	var wg sync.WaitGroup

	// Writer goroutine
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			re.SetContextRaw(json.RawMessage(`{"x": 10}`))
		}
	}()

	// Reader goroutines
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				_, _ = re.Evaluate(json.RawMessage(`{"==": [1, 1]}`))
			}
		}()
	}

	wg.Wait()
}

func TestStateToContext(t *testing.T) {
	sid := uuid.New()
	state := GameState{
		SessionID: sid,
		Phase:     "discussion",
		Modules: map[string]json.RawMessage{
			"chat":    json.RawMessage(`{"muted": false}`),
			"invalid": json.RawMessage(`{bad json`),
		},
	}

	ctx := stateToContext(state)

	if ctx["sessionId"] != sid.String() {
		t.Errorf("sessionId: got %v, want %v", ctx["sessionId"], sid.String())
	}
	if ctx["phase"] != "discussion" {
		t.Errorf("phase: got %v, want discussion", ctx["phase"])
	}

	modules, ok := ctx["modules"].(map[string]any)
	if !ok {
		t.Fatal("modules should be map[string]any")
	}

	chat, ok := modules["chat"].(map[string]any)
	if !ok {
		t.Fatal("chat module should parse to map")
	}
	if chat["muted"] != false {
		t.Error("chat.muted should be false")
	}

	// Invalid JSON falls back to string
	if _, ok := modules["invalid"].(string); !ok {
		t.Error("invalid module should fall back to string")
	}
}

func TestStateToContext_EmptyModules(t *testing.T) {
	state := GameState{
		SessionID: uuid.New(),
		Phase:     "intro",
	}

	ctx := stateToContext(state)
	if _, exists := ctx["modules"]; exists {
		t.Error("empty modules should not appear in context")
	}
}
