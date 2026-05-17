# Ending Condition Groups Design and Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` if the user explicitly approves subagents, otherwise use `superpowers:executing-plans` or execute task-by-task in the main session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ending branch rules so each ending owns multiple condition groups, and each group can combine question results with system death/survival state.

**Architecture:** Keep the existing `ending_branch.matrix` and JSONLogic persistence contract. Change the editor view model so matrix rows are presented as condition groups under each ending, with row `ending` inferred from the parent ending card. Extend runtime evaluation context with character alive state so JSONLogic conditions can branch without asking an extra question.

**Tech Stack:** React, TypeScript, Vitest, Go, JSONLogic, existing MMP editor adapter/runtime module patterns.

---

## Design Plan

### Current Problem

The current modal creates one flat matrix row by asking for:

- question
- answer
- aggregation
- destination ending

This makes the creator choose "보여줄 결말" inside every condition. That is backwards for the requested UX because the creator is already editing conditions under a specific ending.

### Target UX

Show ending cards first. Each ending card owns condition groups.

```text
결말 1
  조건 그룹 A
    범인 질문에서 "고동"이 설정 비율 이상
    양지가 사망
  조건 그룹 B
    모두 생존
    범인 질문에서 "양지"가 가장 많이 선택

결말 2
  조건 그룹 A
    고동 사망
    양지 생존
```

Rules:

- Condition groups under the same ending behave as OR.
- Conditions inside one group behave as AND.
- The modal does not show "보여줄 결말"; the parent ending card decides it.
- Existing flat matrix rows are still valid; the UI groups them by `row.ending`.

### Condition Types

First implementation supports:

- Question answer threshold: answer appears in `answers.<questionId>.choices`.
- Question answer winning: answer equals `answers.<questionId>.winning`.
- Character dead: `characters.<characterId>.alive == false`.
- Character alive: `characters.<characterId>.alive == true`.
- Everyone alive: all playable characters have `alive == true`.

Deferred:

- Arbitrary nested OR inside one group.
- Everyone dead.
- N or more dead.
- Custom formula editor.

### Persistence Shape

Do not introduce a new backend config shape in this PR. Continue writing:

```json
{
  "matrix": [
    {
      "priority": 1,
      "ending": "ending-node-id",
      "conditions": {
        "and": [
          { "in": ["고동", { "var": "answers.q1.choices" }] },
          { "==": [{ "var": "characters.yangji.alive" }, false] }
        ]
      }
    }
  ]
}
```

This preserves backward compatibility with existing `matrix[].ending` and `matrix[].conditions`.

### Runtime Semantics

The backend evaluates matrix rows in priority order, as it does today. Because condition groups under the same ending are stored as separate matrix rows, they naturally behave as OR: the first matching row wins.

The runtime must add `characters` to the evaluation context:

```json
{
  "answers": {},
  "scores": {},
  "characters": {
    "character-id": { "alive": true },
    "another-character-id": { "alive": false }
  }
}
```

If a character cannot be resolved to a current player/runtime state, the condition should evaluate as false for dead checks and true only when explicit runtime data says alive. This avoids accidentally routing to a death ending when state is missing.

### Warning Design

Add a summary warning area near ending rules:

- Default ending is missing.
- An ending has no condition group.
- A condition group references a missing question, answer, or character.
- A system death/survival condition exists but runtime cannot resolve character state.

Warnings should guide creators without blocking save unless the row is structurally invalid.

---

## File Ownership

### Frontend Adapter

- Modify: `apps/web/src/features/editor/entities/ending/endingBranchAdapter.ts`
  - Add parsed condition union types.
  - Add builders for question, character alive/dead, everyone alive, and AND groups.
  - Add grouping helper: matrix rows by ending ID.
  - Preserve existing `readChoiceCondition` exports or wrap them for backward compatibility.

- Modify: `apps/web/src/features/editor/entities/ending/__tests__/endingBranchAdapter.test.ts`
  - Cover new condition builders/readers.
  - Cover existing answer conditions still parsing.
  - Cover grouped matrix rows by ending.

### Frontend UI

- Modify: `apps/web/src/features/editor/components/design/EndingBranchOutcomeRules.tsx`
  - Replace flat `MatrixRulesCard` list with ending cards.
  - Remove destination ending select from modal.
  - Add condition group editor with AND-only list.
  - Allow adding multiple groups to one ending.
  - Render readable summaries for mixed question/death conditions.

- Modify: `apps/web/src/features/editor/components/design/EndingBranchRulesPanel.tsx`
  - Adjust `canAddRule` logic so system-state rules can be created without a branch question.
  - Pass character/module context if not already available.

- Modify: `apps/web/src/features/editor/components/design/__tests__/EndingEntitySubTab.test.tsx`
  - Cover adding a condition group under a selected ending.
  - Cover no "보여줄 결말" select in the modal.
  - Cover question + dead condition saved as one `and` JSONLogic row.
  - Cover default warning when an ending has no condition group.

### Backend Runtime

- Modify: `apps/server/internal/module/decision/ending_branch/runtime.go`
  - Extend `evaluationContextLocked` to include `characters`.
  - Read alive state from existing player runtime info provider/deps.
  - Keep `answers` and `scores` shape unchanged.

- Modify: `apps/server/internal/module/decision/ending_branch/module_test.go`
  - Add runtime evaluation test where a dead character routes to the matching ending.
  - Add runtime evaluation test where all characters alive routes to matching ending.
  - Add regression test for existing answer-only rule.

### Backend Contracts, If Needed

- Inspect before editing:
  - `apps/server/internal/engine/condition_contract.go`
  - `apps/server/internal/session/player_status.go`
  - `apps/server/internal/session/starter_test.go`

Only modify these if ending branch cannot access alive state through existing module deps.

---

## Coverage Plan

- Frontend adapter unit tests:
  - `buildQuestionCondition`
  - `buildCharacterAliveCondition`
  - `buildEveryoneAliveCondition`
  - `buildConditionGroup`
  - `readEndingConditionGroup`
  - legacy `readChoiceCondition`

- Frontend component tests:
  - render ending cards with grouped rules
  - create group under ending without choosing destination ending
  - add mixed question + character-dead conditions
  - warn for endings with no groups

- Backend unit tests:
  - answer-only matrix remains valid
  - character dead matrix matches
  - character alive matrix matches
  - everyone alive matrix matches
  - missing alive state does not produce a false-positive death match

---

## Implementation Plan

### Task 1: Add Adapter Condition Builders and Readers

**Files:**

- Modify: `apps/web/src/features/editor/entities/ending/endingBranchAdapter.ts`
- Test: `apps/web/src/features/editor/entities/ending/__tests__/endingBranchAdapter.test.ts`

- [ ] **Step 1: Add failing adapter tests**

Add tests that assert these JSONLogic shapes:

```ts
expect(buildCharacterAliveCondition("yangji", false)).toEqual({
  "==": [{ var: "characters.yangji.alive" }, false],
});

expect(buildConditionGroup([
  buildChoiceCondition("q1", "고동"),
  buildCharacterAliveCondition("yangji", false),
])).toEqual({
  and: [
    { in: ["고동", { var: "answers.q1.choices" }] },
    { "==": [{ var: "characters.yangji.alive" }, false] },
  ],
});
```

- [ ] **Step 2: Run adapter tests and confirm failure**

Run:

```bash
pnpm --filter @mmp/web test -- src/features/editor/entities/ending/__tests__/endingBranchAdapter.test.ts
```

Expected: fail because new builder/parser functions do not exist.

- [ ] **Step 3: Implement builder functions**

Add exported helpers:

```ts
export type EndingConditionAtom =
  | { kind: "question_choice"; questionId: string; choices: string[]; aggregation: EndingBranchAggregation }
  | { kind: "character_alive"; characterId: string; alive: boolean }
  | { kind: "everyone_alive"; characterIds: string[] }
  | { kind: "unsupported"; condition: EditorConfig };

export function buildCharacterAliveCondition(characterId: string, alive: boolean): EditorConfig {
  return { "==": [{ var: `characters.${characterId}.alive` }, alive] };
}

export function buildEveryoneAliveCondition(characterIds: string[]): EditorConfig {
  return {
    and: uniqueChoices(characterIds).map((characterId) => buildCharacterAliveCondition(characterId, true)),
  };
}

export function buildConditionGroup(conditions: EditorConfig[]): EditorConfig {
  const normalized = conditions.filter((condition) => Object.keys(condition).length > 0);
  if (normalized.length === 0) return {};
  if (normalized.length === 1) return normalized[0] ?? {};
  return { and: normalized };
}
```

- [ ] **Step 4: Implement readers**

Add a reader that can parse:

- legacy `in`
- legacy `winning`
- `characters.<id>.alive == true/false`
- top-level `and` as a condition group

Keep `readChoiceCondition` working for existing callers.

- [ ] **Step 5: Run adapter tests**

Run:

```bash
pnpm --filter @mmp/web test -- src/features/editor/entities/ending/__tests__/endingBranchAdapter.test.ts
```

Expected: pass.

### Task 2: Rebuild Ending Rules UI Around Ending Cards

**Files:**

- Modify: `apps/web/src/features/editor/components/design/EndingBranchOutcomeRules.tsx`
- Modify: `apps/web/src/features/editor/components/design/EndingBranchRulesPanel.tsx`
- Test: `apps/web/src/features/editor/components/design/__tests__/EndingEntitySubTab.test.tsx`

- [ ] **Step 1: Add failing component tests**

Test expectations:

- The modal opened from `결말 1` does not render `보여줄 결말`.
- Saving a condition under `결말 1` writes `matrix[0].ending` as the `결말 1` node id.
- A second group under the same ending writes a second matrix row with the same ending id.
- A mixed group saves as top-level `and`.

- [ ] **Step 2: Run component tests and confirm failure**

Run:

```bash
pnpm --filter @mmp/web test -- src/features/editor/components/design/__tests__/EndingEntitySubTab.test.tsx
```

Expected: fail because the UI is still flat and the modal still has destination ending select.

- [ ] **Step 3: Replace flat rules card with ending-grouped cards**

Create internal render structure:

```ts
type EndingRuleGroup = {
  endingId: string;
  endingName: string;
  rows: EndingBranchMatrixRow[];
};
```

Use `endingNodes.map(...)` as the source of visible cards so endings with no rule still appear.

- [ ] **Step 4: Change modal ownership**

Pass `endingId` from the parent card into `EndingConditionModal`.

Remove:

```tsx
<span>보여줄 결말</span>
<select value={endingId} ... />
```

Save with:

```ts
const base = initialRow ?? createEndingBranchMatrixRow(draft, endingId);
onSave({ ...base, ending: endingId, condition: buildConditionGroup(conditionParts) });
```

- [ ] **Step 5: Add condition list UI**

Inside the modal, render condition rows:

- condition source: `질문 답변`, `캐릭터 상태`, `모두 생존`
- question condition settings when source is question
- character and alive/dead settings when source is character state
- no OR selector inside a group

Copy should say:

```text
이 조건 그룹의 항목을 모두 만족하면 이 결말로 보냅니다.
다른 경로가 필요하면 같은 결말에 조건 그룹을 하나 더 추가하세요.
```

- [ ] **Step 6: Add warning summary**

Show warnings for:

- no default ending
- ending card has no condition group
- condition references missing question/answer/character

- [ ] **Step 7: Run component tests**

Run:

```bash
pnpm --filter @mmp/web test -- src/features/editor/components/design/__tests__/EndingEntitySubTab.test.tsx
```

Expected: pass.

### Task 3: Add Runtime Character Alive Context

**Files:**

- Modify: `apps/server/internal/module/decision/ending_branch/runtime.go`
- Test: `apps/server/internal/module/decision/ending_branch/module_test.go`

- [ ] **Step 1: Add failing backend tests**

Add cases:

```go
func TestEndingBranch_EvaluatesDeadCharacterCondition(t *testing.T) {
  // configure matrix condition:
  // {"==":[{"var":"characters.yangji.alive"}, false]}
  // seed runtime info so yangji is dead
  // assert selected ending is dead-ending
}

func TestEndingBranch_EvaluatesEveryoneAliveCondition(t *testing.T) {
  // configure matrix condition:
  // {"and":[
  //   {"==":[{"var":"characters.godong.alive"}, true]},
  //   {"==":[{"var":"characters.yangji.alive"}, true]}
  // ]}
  // seed runtime info so both are alive
  // assert selected ending is alive-ending
}
```

- [ ] **Step 2: Run backend tests and confirm failure**

Run:

```bash
cd apps/server && go test ./internal/module/decision/ending_branch -count=1
```

Expected: fail because `characters` is missing from evaluation context.

- [ ] **Step 3: Implement character context**

Extend `evaluationContextLocked` so it returns:

```go
return map[string]any{
  "answers": answers,
  "scores": scores,
  "characters": m.characterAliveContextLocked(),
}
```

Implement `characterAliveContextLocked` using existing player runtime info provider/deps. Keep the function local to `ending_branch` unless another module already exposes a canonical helper.

- [ ] **Step 4: Missing state behavior**

If the runtime cannot resolve a character:

- do not mark it dead automatically
- omit it or set `alive` only when known
- ensure dead condition does not match from missing data

- [ ] **Step 5: Run backend tests**

Run:

```bash
cd apps/server && go test ./internal/module/decision/ending_branch -count=1
```

Expected: pass.

### Task 4: Integration Verification

**Files:**

- Existing modified files only.

- [ ] **Step 1: Typecheck web**

Run:

```bash
pnpm --filter @mmp/web exec tsc --noEmit --pretty false
```

Expected: pass.

- [ ] **Step 2: Run focused web tests**

Run:

```bash
pnpm --filter @mmp/web test -- src/features/editor/entities/ending/__tests__/endingBranchAdapter.test.ts src/features/editor/components/design/__tests__/EndingEntitySubTab.test.tsx
```

Expected: pass.

- [ ] **Step 3: Run focused backend tests**

Run:

```bash
cd apps/server && go test ./internal/module/decision/ending_branch -count=1
```

Expected: pass.

- [ ] **Step 4: Run local quick validation if preparing PR**

Run:

```bash
scripts/mmp-local-ci.sh quick
```

Expected: pass, or report exact blocker with failing command and first useful error.

### Task 5: PR Preparation

**Files:**

- All changed frontend/backend files.

- [ ] **Step 1: Review diff**

Run:

```bash
git diff -- apps/web/src/features/editor/entities/ending apps/web/src/features/editor/components/design apps/server/internal/module/decision/ending_branch
```

Expected: diff only includes ending condition group work.

- [ ] **Step 2: Create PR using project wrapper**

Run:

```bash
scripts/pr-create-guard.sh
```

PR body must include:

- Coverage Plan
- Local validation commands and results
- Backward compatibility note for existing `matrix` rows
- Runtime note for `characters.<id>.alive`

---

## Self-Review

- Spec coverage: The plan covers destination removal, ending-owned groups, AND inside groups, OR across groups, question conditions, death/survival conditions, warnings, runtime context, and tests.
- Placeholder scan: No implementation step depends on undefined future work. Deferred items are explicitly out of scope.
- Type consistency: Existing `EndingBranchMatrixRow`, `EndingBranchConfig`, JSONLogic, and `ending_branch.matrix` remain the persistence contract.
- Scope check: This is one coherent vertical slice because frontend UI changes require backend runtime context for the new system-state condition to actually work.

