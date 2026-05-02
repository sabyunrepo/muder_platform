# PR-1 Stage I·J — ending_branch 모듈 (Tasks 10-11)

> 부모: `pr-1-tasks.md` · 이전: `pr-1-integration.md` · 다음: 인덱스 §Task 12-13

## §A · Task 10 — ending_branch 모듈 skeleton (D-23/D-24)

- [ ] **Step 48**: 디렉토리 생성

```bash
mkdir -p apps/server/internal/module/decision/ending_branch
```

- [ ] **Step 49**: 테스트 작성 — `module_test.go`

```go
package ending_branch

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
		_ = m.Init(context.Background(), nil) // nil hub OK for skeleton
	})
}

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
```

- [ ] **Step 50**: 테스트 실행 → FAIL (`undefined: NewModule`)

- [ ] **Step 51**: `module.go` 작성

```go
package ending_branch

import (
	"context"
	"encoding/json"

	"github.com/mmp-platform/server/internal/engine"
)

// Module implements engine.Module + engine.ConfigSchema for the Phase 24
// 결말 분기 시스템 (D-23). Matrix evaluator (JSONLogic-based) is added in PR-5.
type Module struct {
	cfg Config
}

func NewModule() *Module {
	return &Module{}
}

func (m *Module) Name() string { return "ending_branch" }

func (m *Module) Init(_ context.Context, _ *engine.EventBus) error {
	return nil
}

func (m *Module) ApplyConfig(_ context.Context, raw json.RawMessage) error {
	if len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, &m.cfg)
}

// Schema implements engine.ConfigSchema — D-23 + D-24 + D-26 합본.
//
// `questions[]` 배열은 분기(impact: "branch")와 점수(impact: "score") 두 종류 통합.
// `scoreMap`은 impact:"score" 케이스에 보기→점수 매핑 (D-24 embed).
// `multiVoteThreshold`는 D-26 per-choice threshold (default 0.5).
func (m *Module) Schema() json.RawMessage {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"questions": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"id":          map[string]any{"type": "string"},
						"text":        map[string]any{"type": "string"},
						"type":        map[string]any{"type": "string", "enum": []string{"single", "multi"}},
						"choices":     map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
						"respondents": map[string]any{}, // []string | "all" | "some" — runtime validate
						"impact":      map[string]any{"type": "string", "enum": []string{"branch", "score"}},
						"scoreMap": map[string]any{
							"type":                 "object",
							"additionalProperties": map[string]any{"type": "integer"},
						},
					},
					"required":             []string{"id", "text", "type", "choices", "impact"},
					"additionalProperties": false,
				},
			},
			"matrix": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"priority":   map[string]any{"type": "integer", "minimum": 1},
						"conditions": map[string]any{"type": "object"},
						"ending":     map[string]any{"type": "string"},
					},
					"required":             []string{"priority", "conditions", "ending"},
					"additionalProperties": false,
				},
			},
			"defaultEnding": map[string]any{"type": "string"},
			"multiVoteThreshold": map[string]any{
				"type":    "number",
				"minimum": 0,
				"maximum": 1,
				"default": 0.5,
			},
		},
		"additionalProperties": false,
	}
	data, _ := json.Marshal(schema)
	return data
}

// Compile-time interface assertions.
var (
	_ engine.Module       = (*Module)(nil)
	_ engine.ConfigSchema = (*Module)(nil)
)
```

- [ ] **Step 52**: `config.go` 작성 (typed config — Schema와 일치)

```go
package ending_branch

// Question represents one editor-defined question (D-12 + D-24).
// Impact is "branch" (matrix-driving) OR "score" (per-respondent accumulation).
type Question struct {
	ID          string         `json:"id"`
	Text        string         `json:"text"`
	Type        string         `json:"type"` // "single" | "multi"
	Choices     []string       `json:"choices"`
	Respondents any            `json:"respondents,omitempty"` // []string | "all"
	Impact      string         `json:"impact"` // "branch" | "score"
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
```

- [ ] **Step 53**: 테스트 ALL PASS

- [ ] **Step 54**: Commit

```bash
git add apps/server/internal/module/decision/ending_branch/
git commit -m "feat(ending_branch): module + Schema skeleton (D-23/D-24/D-26)"
```

---

## §B · Task 11 — Registry 등록 (boot panic 게이트)

- [ ] **Step 55**: `decision/register.go` 수정 — ending_branch import 추가

```go
package decision

import (
	_ "github.com/mmp-platform/server/internal/module/decision/accusation"
	_ "github.com/mmp-platform/server/internal/module/decision/ending_branch"
	_ "github.com/mmp-platform/server/internal/module/decision/hidden_mission"
	_ "github.com/mmp-platform/server/internal/module/decision/voting"
)
```

- [ ] **Step 56**: `ending_branch/module.go` 에 init() 추가 — registry 등록

```go
import (
	"github.com/mmp-platform/server/internal/engine"
	"github.com/mmp-platform/server/internal/module/registry"
)

func init() {
	registry.Register("ending_branch", func() engine.Module { return NewModule() })
}
```

(주의: 다른 모듈의 init() 패턴 참조 — `module/decision/voting/voting.go` 등)

- [ ] **Step 57**: 통합 테스트 — registry boot 시 ending_branch 등록 확인

```go
// apps/server/internal/module/registry/registry_test.go (또는 새 _integration_test.go)
func TestRegistry_EndingBranchRegistered(t *testing.T) {
	mods := registry.AllNames()
	assert.Contains(t, mods, "ending_branch", "ending_branch must be registered after decision import")
}
```

- [ ] **Step 58**: `go test ./apps/server/internal/module/registry/ -v` PASS

- [ ] **Step 59**: Commit

```bash
git commit -am "feat(ending_branch): register module in decision package (boot panic gate)"
```

다음 → `pr-1-tasks.md` Task 12-13 (coverage gate + 4-agent 리뷰 + PR 생성).
