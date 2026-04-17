# PR-4 — test(e2e): clue-relation stubbed 복제본

> 부모: [../plan.md](../plan.md)
> Wave: 2 (parallel) | 의존: PR-1, PR-2 | 브랜치: `test/e2e-clue-relation-stubbed`

---

## 목적

`clue-relation-live.spec.ts`는 real backend 전용으로 stubbed CI에서 skip. 본질은 "서버가 주는 단서 그래프가 React Flow로 올바르게 렌더되는지"로, 서버 로직 검증이 아니라 **FE 렌더링 검증**. MSW clue handler로 노드/엣지 응답을 만들어 stubbed CI에서 pass하는 복제본 신규.

---

## Scope

```yaml
scope_globs:
  - apps/web/e2e/clue-relation-stubbed.spec.ts
  - apps/web/src/mocks/handlers/clue.ts
```

---

## Tasks

### Task 1 — clue handler 확장
- PR-2에서 shell만 있는 `handlers/clue.ts`를 확장:
  ```ts
  GET  /v1/editor/themes/:themeId/clue-relations  → ClueRelationResponse[] (배열)
  PUT  /v1/editor/themes/:themeId/clue-relations  → 갱신본 echo (replace 패턴)
  GET  /v1/editor/themes/:themeId/clues           → ClueResponse[] (snake_case)
  GET  /v1/clues                                  → [] (legacy/standalone)
  ```
- 기본 fixture: 단서 3개 + 엣지 2개 (시나리오 2~3 커버)
- **drift 정정 (Phase 18.8 follow-up #7)**: 본 spec 초안은 POST/DELETE 를
  명시했으나 서버 SSOT (`apps/server/internal/domain/editor/clue_relation_handler.go`)
  는 GET + PUT (배열 일괄 replace) 만 지원한다. 구현은 서버에 정렬했고
  본 문서를 stale 상태에서 정정한다.

### Task 2 — clue-relation-stubbed.spec.ts
- 구조는 `clue-relation-live.spec.ts` 참조
- `test.beforeEach`에서 `installMswRoutes(page, [auth, theme, clue])`
- 3 시나리오:
  1. 단서 2개 이상 시 React Flow `.react-flow__node` 렌더 (count ≥2)
  2. 엣지 있으면 `.react-flow__edge` 렌더 (count ≥1)
  3. 노드 클릭 → 관련 엣지 하이라이트 (class 변경 확인)

### Task 3 — 원본 spec 주석 연동
- `clue-relation-live.spec.ts` 최상단 코멘트로 복제본 존재 표기 + PLAYWRIGHT_BACKEND 전용임을 재확인

### Task 4 — after_task pipeline
- `pnpm --filter @mmp/web test:e2e clue-relation-stubbed` 로컬 pass
- stubbed CI pass
- `clue-relation-stubbed.spec.ts` 200줄 이내

---

## 핵심 파일 참조

| 파일 | 역할 |
|------|------|
| `clue-relation-live.spec.ts` | 원본 시나리오 참조 |
| React Flow `.react-flow__node` 셀렉터 | assertion 대상 |
| `handlers/clue.ts` (PR-2 shell) | 확장 대상 |

---

## 검증

- 로컬: `pnpm test:e2e clue-relation-stubbed` 3/3 pass
- CI: stubbed workflow 3 시나리오 pass
- 기존 `clue-relation-live.spec.ts`는 nightly 전용

---

## 리뷰 포인트

- React Flow layout 비동기 race — `await expect(nodes).toHaveCount(n)` 사용
- 엣지 클릭 인터랙션 assertion이 layout 완료 이후인지
- fixture의 노드 id가 edges와 정합 (orphan edge 없음)
