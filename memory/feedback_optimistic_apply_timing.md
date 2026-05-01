---
name: applyOptimistic 호출 시점 — schedule 아닌 flush
description: debounced mutation 훅의 applyOptimistic은 flush 시점에만 호출. schedule 시점 즉시 UI 반영은 호출자가 직접 setQueryData 책임.
type: feedback
---

debounce + optimistic update 합성 훅의 `applyOptimistic` 콜백은 **flush 시점**에만 호출되어야 한다. schedule 시점 호출은 빠른 타이핑(N keystroke) 시 cache subscriber (예: FlowCanvas)가 N회 re-render되는 회귀를 만든다.

**Why**: React Query `setQueryData`는 reference 비교로 subscriber notify. 매 schedule마다 새 객체 spread → N notify. 1500ms debounce 윈도우 안 15자 입력 + 20 노드 graph = 300 node spread + 15 canvas re-render. 300ms 이상 frame drop 가능. PR #184 round-1 perf-H2에서 발견 → round-2에서 flush 시점 호출로 회복.

**How to apply**:
1. `useDebouncedMutation` 또는 유사한 합성 훅의 `applyOptimistic`은 timer callback (`flushMutation`) 안에서만 호출. `schedulePending` 안에서는 절대 호출 X — 단순 큐잉만.
2. **schedule 시점 즉시 UI 반영이 필요한 panel** (예: `CharacterAssignPanel`의 토글/체크박스 UX) — 호출자가 `saveConfig` 안에서 직접 `queryClient.setQueryData`를 별도로 호출 (mirror). hook의 `applyOptimistic`은 flush 시점에 rollback closure 캡처용으로만 사용. **두 layer 패턴**.
3. 두 layer 패턴 채택 시 **rollback snapshot identity** 주의 — `feedback_optimistic_rollback_snapshot.md` 참조.

**예시** (`apps/web/src/hooks/useDebouncedMutation.ts:34-44` JSDoc):

```ts
// Schedule 시점: 큐잉만, side-effect 없음.
debouncer.schedule(body);

// Flush 시점 (timer fire 또는 명시 flush): applyOptimistic 호출 + rollback 캡처 + mutate.
const rollback = applyOptimistic?.(body) ?? null;
mutate(body, { onError: () => rollback?.() });
```

**관련 PR**: #184 (commit e283586 round-2 / 7aacc3e round-3).

**관련 카논**: `feedback_optimistic_rollback_snapshot.md`, `feedback_code_review_patterns.md` React Query 섹션, MISTAKES 2026-05-01 "이중 layer → pendingSnapshot 오염".
