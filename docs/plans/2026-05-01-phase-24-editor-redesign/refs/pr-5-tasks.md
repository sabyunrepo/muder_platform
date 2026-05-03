# Phase 24 PR-5 — Ending Branch Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결말 entity에 “분기 질문 + 매트릭스” 탭을 추가하고, 백엔드 `ending_branch` 모듈이 플레이어 응답을 받아 우선순위 규칙으로 최종 결말과 점수 breakdown을 계산하게 만든다.

**Architecture:** PR-4에서 결말 본문은 `flow_nodes(type=ending)`에 저장했고, PR-5는 결말 선택 규칙만 `modules.ending_branch.config`에 저장한다. 프론트는 비개발자 제작자가 이해할 수 있는 질문/조건 편집 UI를 제공하고, 백엔드는 typed config validation + evaluator를 순수 함수로 분리해 런타임 모듈과 테스트가 같은 계산기를 사용한다. JSONLogic은 외부 노출용 설명이 아니라 내부 평가 표현으로만 사용하며, UI에는 “질문 조건”, “아무 선택이나 허용”, “우선순위” 같은 제작자 언어만 표시한다.

**Tech Stack:** Go `internal/module/decision/ending_branch`, React + TypeScript, React Query config mutation, Vitest, Playwright + axe-core, Codecov patch coverage ≥70%.

---

## Scope

### 포함
- 결말 entity 안에 `목록` / `분기` 2단 구조 추가.
- 질문 에디터: 단일 선택, 다중 선택, 응답 대상, `결말 분기`/`점수 누적` 영향 선택.
- 매트릭스 UI: 행 추가/삭제, 우선순위 정렬, `+` 결합 조건, 와일드카드 `*`를 “상관없음”으로 표시.
- voting 모듈 결과 컬럼은 config에 이미 voting 모듈이 켜져 있을 때 읽기 전용 조건 소스로 표시.
- 백엔드 evaluator: per-choice threshold, branch/score impact, default ending, priority match.
- 게임 종료 public state: 공통 결말 + 캐릭터별 응답/점수 breakdown. 랭킹 UI는 제외.

### 제외
- 결말 본문 다국어/콘텐츠 테이블 분리.
- 실시간 투표 UI 전체 개편.
- 마이그레이션 sweep/legacy key drop — PR-6.

---

## Files

### Backend
- Modify: `apps/server/internal/module/decision/ending_branch/config.go` — typed config 확장/검증용 타입 유지.
- Modify: `apps/server/internal/module/decision/ending_branch/module.go` — `HandleMessage`, `BuildStateFor`, cleanup state, PublicStateMarker 제거.
- Create: `apps/server/internal/module/decision/ending_branch/evaluator.go` — 순수 평가 함수.
- Create: `apps/server/internal/module/decision/ending_branch/evaluator_test.go` — priority/default/threshold/score tests.
- Modify: `apps/server/internal/module/decision/ending_branch/module_test.go` — PR-5 런타임 state/message tests.

### Frontend
- Modify: `apps/web/src/features/editor/flowTypes.ts` — ending branch config TS type 추가 또는 별도 type export.
- Create: `apps/web/src/features/editor/components/design/endingBranchTypes.ts` — UI 전용 타입/기본값.
- Create: `apps/web/src/features/editor/components/design/EndingBranchSubTab.tsx` — 질문 + 매트릭스 orchestration.
- Create: `apps/web/src/features/editor/components/design/EndingQuestionEditor.tsx` — 질문 카드 CRUD.
- Create: `apps/web/src/features/editor/components/design/EndingMatrixEditor.tsx` — 규칙 행 CRUD.
- Create: `apps/web/src/features/editor/components/design/EndingBranchPreview.tsx` — 제작자용 검수/미리보기. 내부 JSON은 숨김.
- Modify: `apps/web/src/features/editor/components/design/EndingEntitySubTab.tsx` — `목록`/`분기` 내부 탭 연결.
- Tests: matching `__tests__/EndingBranch*.test.tsx`.
- E2E: `apps/web/e2e/editor-ending-branch.spec.ts`.

---

## Task 1 — Backend evaluator RED/GREEN

**Files:**
- Create: `apps/server/internal/module/decision/ending_branch/evaluator.go`
- Create: `apps/server/internal/module/decision/ending_branch/evaluator_test.go`

- [ ] **Step 1: Write failing evaluator tests**

```go
func TestEvaluate_PriorityMatrixSelectsFirstMatchingEnding(t *testing.T) {
	threshold := 0.5
	cfg := Config{
		Questions: []Question{{ID: "q1", Type: "single", Choices: []string{"자백", "침묵"}, Impact: "branch"}},
		Matrix: []MatrixRow{
			{Priority: 2, Conditions: map[string]any{"q1": "*"}, Ending: "ending-default-like"},
			{Priority: 1, Conditions: map[string]any{"q1": "자백"}, Ending: "ending-truth"},
		},
		DefaultEnding: "ending-fallback",
		MultiVoteThreshold: &threshold,
	}
	result, err := Evaluate(cfg, AnswerSet{"player-1": {"q1": []string{"자백"}}})
	require.NoError(t, err)
	assert.Equal(t, "ending-truth", result.Ending)
}

func TestEvaluate_MultiChoiceThresholdAndScoreBreakdown(t *testing.T) {
	threshold := 0.6
	cfg := Config{
		Questions: []Question{
			{ID: "q1", Type: "multi", Choices: []string{"A", "B"}, Impact: "branch"},
			{ID: "q2", Type: "single", Choices: []string{"선행", "악행"}, Impact: "score", ScoreMap: map[string]int{"선행": 2, "악행": -1}},
		},
		Matrix: []MatrixRow{{Priority: 1, Conditions: map[string]any{"q1": []any{"A", "B"}}, Ending: "ending-all"}},
		DefaultEnding: "ending-fallback",
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
}
```

- [ ] **Step 2: Run failing tests**

```bash
go test ./internal/module/decision/ending_branch -run 'TestEvaluate' -count=1
```

Expected: FAIL because `Evaluate`/`AnswerSet` are undefined.

- [ ] **Step 3: Implement minimal evaluator**

Implement:
- `type AnswerSet map[string]map[string][]string`
- `type EvaluationResult struct { Ending string; MatchedPriority int; TotalScore int; PlayerScores map[string]int; QuestionBreakdown map[string]map[string]int }`
- normalize threshold: nil → 0.5.
- branch aggregation: for each branch question, count choices across respondents; choice passes when `count/respondentCount >= threshold`.
- condition match:
  - `"*"` means ignore this question.
  - `string` means aggregated selected choice must include string.
  - `[]any`/`[]string` means all listed choices must pass.
- matrix sorted by ascending `Priority`; first match wins; no match → `DefaultEnding`.
- score questions: sum `ScoreMap[choice]` per player.

- [ ] **Step 4: Verify**

```bash
go test ./internal/module/decision/ending_branch -run 'TestEvaluate' -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/internal/module/decision/ending_branch/evaluator.go apps/server/internal/module/decision/ending_branch/evaluator_test.go
git commit -m "feat(ending_branch): add matrix evaluator"
```

---

## Task 2 — Backend runtime module state/messages

**Files:**
- Modify: `apps/server/internal/module/decision/ending_branch/module.go`
- Modify: `apps/server/internal/module/decision/ending_branch/module_test.go`

- [ ] **Step 1: Write failing module tests**

Add tests for:
- `HandleMessage(ctx, playerID, "ending_branch:submit_answer", payload)` stores answers.
- `BuildStateFor(playerID)` returns only that player’s answers plus public question metadata.
- `BuildStateFor(GM)` or public admin state returns `evaluation` after enough answers.
- `Cleanup` clears answers and evaluation.

Payload shape:

```json
{
  "questionId": "q1",
  "choices": ["자백"]
}
```

- [ ] **Step 2: Run failing tests**

```bash
go test ./internal/module/decision/ending_branch -run 'TestModule_.*PR5|TestModule_HandleMessage' -count=1
```

Expected: FAIL because stub still returns PR-5 error.

- [ ] **Step 3: Implement runtime**

Implementation boundary:
- Add `answers AnswerSet` and `evaluation EvaluationResult` under `mu`.
- Replace `PublicStateMarker` with player-aware state if engine supports `BuildStateFor`; if not, add the project’s equivalent player-aware interface used by other modules.
- Validate question id and choices against config before storing.
- Call `Evaluate` after each answer and keep latest result.

- [ ] **Step 4: Verify backend package**

```bash
go test ./internal/module/decision/ending_branch -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/internal/module/decision/ending_branch
git commit -m "feat(ending_branch): handle answers and expose evaluation state"
```

---

## Task 3 — Frontend config types and read/write helpers

**Files:**
- Create: `apps/web/src/features/editor/components/design/endingBranchTypes.ts`
- Test: `apps/web/src/features/editor/components/design/__tests__/EndingBranchTypes.test.ts`

- [ ] **Step 1: Write failing type/helper tests**

Test helpers:
- `createDefaultQuestion()` creates user-friendly Korean defaults, no internal IDs shown in labels.
- `createDefaultMatrixRow()` uses priority + wildcard conditions.
- `normalizeEndingBranchConfig(raw)` applies threshold 0.5 and stable arrays.
- `serializeEndingBranchConfig(config)` writes canonical shape for `modules.ending_branch.config`.

- [ ] **Step 2: Run failing tests**

```bash
pnpm --dir apps/web exec vitest run src/features/editor/components/design/__tests__/EndingBranchTypes.test.ts
```

Expected: FAIL because file is missing.

- [ ] **Step 3: Implement helpers**

Use UI labels:
- impact `branch` → “결말을 나누는 질문”
- impact `score` → “점수를 더하는 질문”
- wildcard `*` → “상관없음”

Do not render JSONLogic, module key, DB key, or raw config path in UI copy.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --dir apps/web exec vitest run src/features/editor/components/design/__tests__/EndingBranchTypes.test.ts
git add apps/web/src/features/editor/components/design/endingBranchTypes.ts apps/web/src/features/editor/components/design/__tests__/EndingBranchTypes.test.ts
git commit -m "feat(editor): add ending branch config helpers"
```

---

## Task 4 — Branch tab UI: questions + matrix

**Files:**
- Create: `EndingBranchSubTab.tsx`
- Create: `EndingQuestionEditor.tsx`
- Create: `EndingMatrixEditor.tsx`
- Create: `EndingBranchPreview.tsx`
- Modify: `EndingEntitySubTab.tsx`
- Tests: `EndingBranchSubTab.test.tsx`, `EndingQuestionEditor.test.tsx`, `EndingMatrixEditor.test.tsx`

- [ ] **Step 1: Write UI tests first**

Minimum assertions:
- “분기” tab appears next to “목록”.
- Add question shows text/choice inputs.
- Multi choice question can add 2+ choices.
- Score question shows score per choice fields.
- Matrix row can choose ending target and “상관없음”.
- Selected row has accessible state not color-only.
- Error/loading/empty state copy is user-friendly.

- [ ] **Step 2: Implement mobile-first UI**

Layout:
- Mobile: vertical sections — 질문 → 매트릭스 → 미리보기.
- Desktop: two columns max; no wide spreadsheet that hides content.
- Use buttons/cards/forms with visible labels. Do not expose system IDs.
- Save through `useUpdateConfigJson` and `writeModuleConfigPath(theme.config_json, "ending_branch", path, value)`.

- [ ] **Step 3: Verify frontend focused suite**

```bash
pnpm --dir apps/web exec vitest run \
  src/features/editor/components/design/__tests__/EndingBranchSubTab.test.tsx \
  src/features/editor/components/design/__tests__/EndingQuestionEditor.test.tsx \
  src/features/editor/components/design/__tests__/EndingMatrixEditor.test.tsx \
  src/features/editor/components/design/__tests__/EndingEntitySubTab.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/components/design/EndingBranch*.tsx apps/web/src/features/editor/components/design/EndingQuestionEditor.tsx apps/web/src/features/editor/components/design/EndingMatrixEditor.tsx apps/web/src/features/editor/components/design/EndingEntitySubTab.tsx apps/web/src/features/editor/components/design/__tests__/EndingBranch*.test.tsx apps/web/src/features/editor/components/design/__tests__/EndingQuestionEditor.test.tsx apps/web/src/features/editor/components/design/__tests__/EndingMatrixEditor.test.tsx
git commit -m "feat(editor): add ending branch matrix editor"
```

---

## Task 5 — E2E coverage and accessibility

**Files:**
- Create: `apps/web/e2e/editor-ending-branch.spec.ts`

- [ ] **Step 1: Write E2E**

Flow:
1. Open `/editor/${THEME_ID}/flow`.
2. Click `결말`.
3. Click `분기`.
4. Add question “누구를 믿었나요?” with choices “탐정”, “용의자”.
5. Add matrix row: condition “탐정” → ending “진실”.
6. Assert PUT/PATCH payload writes `modules.ending_branch.config.questions` and `matrix` canonical shape.
7. Run axe on `[data-testid="ending-branch-panel"]` with WCAG 2.1 A/AA tags, no global `disableRules`.

- [ ] **Step 2: Run E2E locally**

```bash
pids=$(lsof -ti tcp:3000 || true); if [ -n "$pids" ]; then kill $pids; fi
pnpm --dir apps/web exec playwright test e2e/editor-ending-branch.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/editor-ending-branch.spec.ts
git commit -m "test(e2e): cover ending branch editor"
```

---

## Task 6 — Full validation and PR

- [ ] **Step 1: Local validation**

```bash
go test ./internal/module/decision/ending_branch -count=1
pnpm --dir apps/web exec vitest run src/features/editor/components/design/__tests__/EndingBranchTypes.test.ts src/features/editor/components/design/__tests__/EndingBranchSubTab.test.tsx src/features/editor/components/design/__tests__/EndingQuestionEditor.test.tsx src/features/editor/components/design/__tests__/EndingMatrixEditor.test.tsx src/features/editor/components/design/__tests__/EndingEntitySubTab.test.tsx
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec eslint src/features/editor/components/design/EndingBranchSubTab.tsx src/features/editor/components/design/EndingQuestionEditor.tsx src/features/editor/components/design/EndingMatrixEditor.tsx src/features/editor/components/design/EndingBranchPreview.tsx src/features/editor/components/design/EndingEntitySubTab.tsx apps/web/e2e/editor-ending-branch.spec.ts
pids=$(lsof -ti tcp:3000 || true); if [ -n "$pids" ]; then kill $pids; fi
pnpm --dir apps/web exec playwright test e2e/editor-ending-branch.spec.ts --project=chromium
git diff --check
```

- [ ] **Step 2: PR creation**

Create PR in Korean. Do **not** add `ready-for-ci` yet.

- [ ] **Step 3: Review order**

1. CodeRabbit first review.
2. Resolve all valid actionable comments.
3. Push and wait for CodeRabbit re-review.
4. Repeat once more if new comments appear.
5. Confirm unresolved review threads = 0.
6. Only then add `ready-for-ci`.

- [ ] **Step 4: CI/Codecov**

- Required checks must pass.
- Codecov patch coverage must be ≥70%.
- If Codecov reports missing lines but patch coverage remains ≥70%, record it in PR summary; add tests only when the missing lines are behaviorally important.

---

## Completion Conditions

- [ ] 제작자는 결말 entity의 “분기” 탭에서 질문과 매트릭스를 모바일/데스크탑 모두에서 읽기 쉽게 편집할 수 있다.
- [ ] UI는 내부 module key, DB field, JSONLogic raw shape를 노출하지 않는다.
- [ ] `ending_branch` evaluator는 priority, wildcard, multi-choice threshold, score impact를 테스트로 보장한다.
- [ ] player-aware state redaction이 적용되어 다른 플레이어의 응답이 그대로 노출되지 않는다.
- [ ] E2E + axe 검사가 추가되어 결말 분기 편집 플로우를 커버한다.
- [ ] CodeRabbit unresolved 0, CI all pass, Codecov patch coverage ≥70% 후 merge한다.
