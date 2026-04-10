# PR D-6: JSON Logic Rule Editor

> Phase D | 의존: D-5 | Wave: W4

---

## 목표
시각적 JSON Logic 규칙 편집기. 클라이언트(jsonlogic-js) 미리보기.
서버(diegoholiveira/jsonlogic)와 동일 평가 체계.

## 변경 파일

**신규**
```
apps/web/src/features/editor/
  components/RightPanel/RuleEditor.tsx       # JSON Logic 시각적 편집기
  components/RightPanel/rule/
    RuleBuilder.tsx                          # 규칙 트리 빌더
    OperatorSelector.tsx                     # 연산자 선택
    VariablePicker.tsx                       # 변수 참조 선택
    RulePreview.tsx                          # jsonlogic-js 미리보기
  hooks/useRuleEvaluation.ts                 # 클라이언트 평가
  utils/ruleSerializer.ts                    # 시각적 트리 ↔ JSON Logic
```

## RuleEditor 구조

```
┌─ 조건 편집 ─────────────────────────┐
│ [AND ▾]                               │
│ ┌────────────────────────────────┐   │
│ │ [>]                             │   │
│ │ 좌: [var: phase.timer.remaining]│   │
│ │ 우: [0          ]               │   │
│ └────────────────────────────────┘   │
│ JSON: {"and":[{">":[...]}]}           │
│ 미리보기: ✓ true                       │
│ [+ 조건 추가]  [+ 그룹 추가]          │
└───────────────────────────────────────┘
```

## 지원 연산자

| 카테고리 | 연산자 |
|----------|--------|
| 논리 | `and`, `or`, `not` |
| 비교 | `==`, `!=`, `>`, `<`, `>=`, `<=` |
| 산술 | `+`, `-`, `*`, `/`, `%` |
| 배열 | `in`, `all`, `some`, `every`, `filter`, `map` |
| 기타 | `var`, `if`, `missing`, `missing_some` |

## VariablePicker

```typescript
const AVAILABLE_VARIABLES = {
  phase: { 'phase.round': '현재 라운드', 'phase.timer.remaining': '남은 시간(초)' },
  players: { 'players.alive': '생존자 수', 'players.total': '전체 참가자 수' },
  votes: { 'votes.count': '투표 수', 'votes.total': '투표 가능 수' },
  clues: { 'clues.discovered': '발견 단서 수', 'clues.total': '전체 단서 수' },
};
```

## 직렬화

```typescript
// 시각적 트리 → JSON Logic
function serializeRule(node: RuleNode): JsonLogicRule {
  if (['and', 'or'].includes(node.operator))
    return { [node.operator]: node.children.map(serializeRule) };
  return { [node.operator]: [serializeOperand(node.left), serializeOperand(node.right)] };
}

// JSON Logic → 시각적 트리
function deserializeRule(rule: JsonLogicRule): RuleNode { ... }
```

## 클라이언트 미리보기

```typescript
import { apply } from 'jsonlogic-js';

function useRuleEvaluation(rule: JsonLogicRule, data: Record<string, unknown>) {
  return useMemo(() => {
    try { return { result: apply(rule, data), error: null }; }
    catch (err) { return { result: null, error: err.message }; }
  }, [rule, data]);
}
```

## 테스트

- `RuleEditor.test.tsx`: 규칙 빌드, 직렬화, 미리보기
- `ruleSerializer.test.ts`: round-trip (20+ 케이스)
- `useRuleEvaluation.test.ts`: jsonlogic-js 정확성
- **크로스 엔진 패리티**: 100개 식이 클라이언트/서버 동일 결과
