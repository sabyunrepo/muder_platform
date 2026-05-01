---
name: optimistic rollback snapshot은 진짜 pre-edit 시점에 캡처
description: 두 layer optimistic 패턴 (schedule-time mirror + flush-time applyOptimistic) 사용 시 rollback snapshot은 첫 schedule 시점에 별도 ref로 캡처해야 진짜 pre-edit 상태 복원 가능.
type: feedback
---

debounce + optimistic 합성 훅에서 schedule 시점에 cache mirror를 쓰고 flush 시점에도 `applyOptimistic`이 cache write를 하면, **rollback snapshot은 첫 schedule 시점에 별도 ref로 캡처**해야 한다. flush 시점에 `queryClient.getQueryData(cacheKey)`로 캡처하면 이미 schedule-time mirror된 상태를 `previous`로 잡아 rollback이 schedule-time-applied 상태로만 복원 — silent data divergence.

**Why**: `flushMutation` 안에서 `getQueryData`를 호출하는 시점은 정의상 schedule-time mirror가 이미 적용된 후. 그 cache 상태는 진짜 pre-edit이 아니라 mirror 적용된 상태. mutation 실패 시 rollback closure가 그 상태를 "이전"으로 복원하므로 화면은 사용자 편집이 그대로 남고 토스트만 뜸. PR #184 round-2 N-1 + CodeRabbit이 동시 지적.

**How to apply**:
1. **CharacterAssignPanel 패턴** (이중 layer 필요한 panel):
   ```ts
   const pendingSnapshotRef = useRef<EditorThemeResponse | undefined>(undefined);

   const debouncer = useDebouncedMutation({
     mutate: (body, opts) =>
       updateConfig.mutate(body, {
         onSuccess: () => { ...; pendingSnapshotRef.current = undefined; },
         onError: (err) => { opts.onError(err); pendingSnapshotRef.current = undefined; },
       }),
     applyOptimistic: () => {
       const previous = pendingSnapshotRef.current;
       if (!previous) return null;
       return () => queryClient.setQueryData(cacheKey, previous);  // 진짜 pre-edit
     },
   });

   const saveConfig = (updates) => {
     // 1) 첫 schedule 시점에만 진짜 pre-edit snapshot 캡처
     if (!pendingSnapshotRef.current) {
       pendingSnapshotRef.current = queryClient.getQueryData(cacheKey);
     }
     // 2) schedule-time mirror (UX 즉시 반응)
     queryClient.setQueryData(cacheKey, mirror);
     // 3) schedule
     debouncer.schedule(updates, ...);
   };
   ```

2. **PhaseNodePanel 패턴** (단일 layer — flush 시점만 cache write):
   ```ts
   const debouncer = useDebouncedMutation({
     applyOptimistic: (body) => {
       const previous = queryClient.getQueryData(cacheKey);  // flush 시점, 진짜 pre-edit (mirror 없음)
       queryClient.setQueryData(cacheKey, patched);
       return () => queryClient.setQueryData(cacheKey, previous);
     },
   });
   ```
   이 패턴에서는 schedule 시점 cache write 없으므로 flush 시점 `getQueryData`가 진짜 pre-edit. 별도 ref 불필요.

3. PR review 체크리스트: "두 layer optimistic 패턴 사용 시 rollback snapshot이 진짜 pre-edit인가? `pendingSnapshotRef` 패턴 사용?" — `feedback_code_review_patterns.md`.

**관련 PR**: #184 round-3 (commit 7aacc3e). `CharacterAssignPanel.tsx:46-55` `pendingSnapshotRef` + `apps/web/src/features/editor/components/design/__tests__/CharacterAssignPanel.test.tsx` "rollback이 진짜 pre-edit snapshot으로 복원한다" 회귀 테스트.

**관련 카논**: `feedback_optimistic_apply_timing.md`, MISTAKES 2026-05-01 entry.
