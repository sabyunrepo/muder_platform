<!-- STATUS-START -->
**Active**: Phase 17.5 단서 관계 그래프 — Wave 1/3
**PR**: PR-1 (0%)
**Task**: 시작 전
**State**: not_started
**Blockers**: none
**Last updated**: 2026-04-14
<!-- STATUS-END -->

# Phase 17.5 단서 관계 그래프 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 1 — 백엔드 API (sequential)

### PR-1: 단서 관계 API
- [ ] Task 1 — DB 마이그레이션 (clue_relations 테이블)
- [ ] Task 2 — sqlc 쿼리 + Repository 구현
- [ ] Task 3 — Service + Handler (GET/PUT /clue-relations)
- [ ] Task 4 — Go 테스트 (graph validator 연동)
- [ ] Run after_task pipeline

**Wave 1 gate**:
- [ ] All PR-1 tasks done
- [ ] `go test -race ./...` pass
- [ ] PR merged to main
- [ ] User confirmed next wave

---

## Wave 2 — 프론트엔드 (parallel)

### PR-2: ClueRelationGraph 컴포넌트
- [ ] Task 1 — clueRelationApi.ts (GET/PUT hooks)
- [ ] Task 2 — ClueRelationGraph (ReactFlow DAG 시각화)
- [ ] Task 3 — 단서 탭에 "관계" 서브탭 추가
- [ ] Task 4 — Vitest 테스트
- [ ] Run after_task pipeline

### PR-3: 검증 연동
- [ ] Task 1 — validateClueGraph 함수 (cycle, orphan 감지)
- [ ] Task 2 — ValidationPanel에 clue_graph 카테고리 추가
- [ ] Task 3 — Vitest 테스트
- [ ] Run after_task pipeline

**Wave 2 gate**:
- [ ] All PR-2 tasks done
- [ ] All PR-3 tasks done
- [ ] `pnpm test` pass
- [ ] Both PRs merged to main
- [ ] User confirmed next wave

---

## Wave 3 — 통합 (sequential)

### PR-4: 통합 + E2E
- [ ] Task 1 — 에디터 E2E 테스트 (관계 추가/삭제 시나리오)
- [ ] Task 2 — cycle 감지 UX 폴리시 (에러 시 엣지 롤백)
- [ ] Task 3 — Playwright 시각 점검
- [ ] Run after_task pipeline

**Wave 3 gate**:
- [ ] All PR-4 tasks done
- [ ] `pnpm test` + `go test` pass
- [ ] PR merged to main
- [ ] User confirmed

---

## Phase completion gate

- [ ] All waves done
- [ ] 단서 관계 API 동작 (GET/PUT)
- [ ] ReactFlow DAG 시각화
- [ ] 관계 추가/삭제 → 서버 저장
- [ ] cycle 감지 → 에러 표시
- [ ] validator → ValidationPanel 연동
- [ ] 테스트 통과
- [ ] `/plan-finish` 실행
