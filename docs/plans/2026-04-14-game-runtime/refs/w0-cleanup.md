# W0 / PR-0 — Phase 17.5 Cleanup

> Wave 0 | 의존: 없음 | Branch: `feat/phase-18.0/PR-0-cleanup`

## 목적

Phase 17.5 코드 리뷰(2026-04-15)에서 identified된 MEDIUM/LOW 이슈 중
Phase 17.5 범위 외로 미룬 7건을 Phase 18.0 시작 전 정리.

---

## 출처

- **리뷰 리포트**: 2026-04-15 세션 (4 병렬 리뷰어: security/perf/arch/test)
- **기존 HIGH 수정**: `749517b merge: Phase 17.5 review fixes`
- **잔여 followup**: 아래 7 tasks

---

## Tasks

### Task 1 — types.go 분리 (Architecture)
**From**: `clue_relation_service.go:15-27`
**Issue**: `ClueRelationRequest/Response`가 service 파일에 정의됨. 다른 타입은 `service.go`에 있음 → 컨벤션 불일치.
**Fix**:
- 신규 `apps/server/internal/domain/editor/types.go` 생성
- `ClueRelationRequest`, `ClueRelationResponse` 이동
- 여력 되면 `CreateThemeRequest` 등도 함께 이동 (선택)

### Task 2 — debounce 일원화 (Performance)
**From**: `useClueGraphData.ts:117-151`
**Issue**: `onConnect` 내부에 autoSave와 별개의 debounce setTimeout 중복 구현. 서로 다른 snapshot으로 race 가능.
**Fix**: `onConnect`가 `autoSave(next)` 호출하도록 수정. revert-on-error는 mutation 옵션으로 분리.

### Task 3 — 크로스 invalidation (Data Consistency)
**From**: `ClueListView.tsx` 또는 `useDeleteClue` 구현부
**Issue**: clue 삭제 시 FK cascade로 DB는 정리되지만 `clueRelationKeys` 캐시는 stale.
**Fix**: `useDeleteClue` onSuccess에 `queryClient.invalidateQueries({ queryKey: clueRelationKeys.relations(themeId) })` 추가.

### Task 4 — Hook 단위 테스트 (Test Coverage)
**Issue**: `useClueGraphData`의 debounce/rollback 로직 테스트 0건.
**Fix**: 신규 `apps/web/src/features/editor/hooks/__tests__/useClueGraphData.test.ts`
- `vi.useFakeTimers()` + debounce coalescing
- onConnect optimistic revert (mutation reject → edge 제거)
- onError toast 분기 (CYCLE_DETECTED vs 기타)

### Task 5 — 서비스 통합 테스트 (Test Coverage)
**Issue**: FK cascade, TX rollback, 교차 테마 insert 테스트 부재.
**Fix**: 신규 `apps/server/internal/domain/editor/clue_relation_service_test.go` (testcontainers-go)
- FK cascade: clue 삭제 → clue_relations cascade 확인
- TX rollback: 두 번째 insert 실패 시 첫 insert 롤백 확인
- Cross-theme: themeA의 clue ID로 themeB 관계 생성 시도 → 400

### Task 6 — Kahn queue 성능 (Performance micro)
**From**: `validation.ts:132-140`
**Issue**: `Array.shift()` O(n) → 전체 O(n²)
**Fix**: index pointer 패턴
```ts
let head = 0;
while (head < queue.length) {
  const node = queue[head++];
  ...
}
```

### Task 7 — E2E MSW mock (Test)
**From**: `e2e/clue-relation.spec.ts:10-14`
**Issue**: localhost:8080 없으면 전부 skip → CI 회귀 방어 0.
**Fix**: 최소 네비게이션/렌더링 2건은 `page.route` 로 API mock 후 무조건 실행. 남은 4건은 flag로 분리.

---

## 파일 스코프

### Backend
```
apps/server/internal/domain/editor/types.go (신규)
apps/server/internal/domain/editor/service.go (타입 이동)
apps/server/internal/domain/editor/clue_relation_service.go (타입 이동)
apps/server/internal/domain/editor/clue_relation_service_test.go (신규, testcontainers)
```

### Frontend
```
apps/web/src/features/editor/hooks/useClueGraphData.ts (debounce 일원화)
apps/web/src/features/editor/hooks/__tests__/useClueGraphData.test.ts (신규)
apps/web/src/features/editor/api.ts 또는 editorClueApi.ts (useDeleteClue invalidation)
apps/web/src/features/editor/validation.ts (Kahn index pointer)
apps/web/e2e/clue-relation.spec.ts (MSW mock)
```

---

## 검증

- [ ] `go build ./... && go vet ./...` clean
- [ ] `go test -race ./internal/domain/editor/...` pass (integration 테스트 포함)
- [ ] `pnpm test` (editor 범위) pass
- [ ] `npx tsc --noEmit` pass
- [ ] E2E 2건 CI에서 실행 + pass
- [ ] 모든 파일 <200줄

---

## Commits 전략

Task 당 1 commit (conventional):
- `refactor(editor): extract clue relation types to types.go`
- `perf(editor): unify onConnect debounce with autoSave`
- `fix(editor): invalidate clue-relations cache on clue delete`
- `test(editor): add useClueGraphData unit tests`
- `test(editor): add clue relation service integration tests`
- `perf(editor): switch Kahn's queue to index pointer`
- `test(editor): mock API in clue-relation E2E for CI`
