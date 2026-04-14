<!-- STATUS-START -->
**Active**: Phase 17.5 단서 관계 그래프 — Wave 3/3
**PR**: PR-4 (100%)
**Task**: 완료
**State**: completed
**Blockers**: none
**Last updated**: 2026-04-14
<!-- STATUS-END -->

# Phase 17.5 단서 관계 그래프 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 1 — 백엔드 API (sequential)

### PR-1: 단서 관계 API
- [x] Task 1 — DB 마이그레이션 (clue_relations 테이블)
- [x] Task 2 — sqlc 쿼리 + Repository 구현
- [x] Task 3 — Service + Handler (GET/PUT /clue-relations)
- [x] Task 4 — Go 테스트 (graph validator 연동)
- [x] Run after_task pipeline

**Wave 1 gate**:
- [x] All PR-1 tasks done
- [x] `go test -race ./...` pass
- [x] PR merged to main
- [x] User confirmed next wave

---

## Wave 2 — 프론트엔드 (parallel)

### PR-2: ClueRelationGraph 컴포넌트
- [x] Task 1 — clueRelationApi.ts (GET/PUT hooks)
- [x] Task 2 — ClueRelationGraph (ReactFlow DAG 시각화)
- [x] Task 3 — 단서 탭에 "관계" 서브탭 추가
- [x] Task 4 — Vitest 테스트
- [x] Run after_task pipeline

### PR-3: 검증 연동
- [x] Task 1 — validateClueGraph 함수 (cycle, orphan 감지)
- [x] Task 2 — ValidationPanel에 clue_graph 카테고리 추가
- [x] Task 3 — Vitest 테스트
- [x] Run after_task pipeline

**Wave 2 gate**:
- [x] All PR-2 tasks done
- [x] All PR-3 tasks done
- [x] `pnpm test` pass
- [x] Both PRs merged to main
- [x] User confirmed next wave

---

## Wave 3 — 통합 (sequential)

### PR-4: 통합 + E2E
- [x] Task 1 — 에디터 E2E 테스트 (관계 추가/삭제 시나리오)
- [x] Task 2 — cycle 감지 UX 폴리시 (에러 시 엣지 롤백)
- [x] Task 3 — Playwright 시각 점검
- [x] Run after_task pipeline

**Wave 3 gate**:
- [x] All PR-4 tasks done
- [x] `pnpm test` + `go test` pass
- [x] PR merged to main
- [x] User confirmed

---

## Phase completion gate

- [x] All waves done
- [x] 단서 관계 API 동작 (GET/PUT)
- [x] ReactFlow DAG 시각화
- [x] 관계 추가/삭제 → 서버 저장
- [x] cycle 감지 → 에러 표시
- [x] validator → ValidationPanel 연동
- [x] 테스트 통과
- [ ] `/plan-finish` 실행
