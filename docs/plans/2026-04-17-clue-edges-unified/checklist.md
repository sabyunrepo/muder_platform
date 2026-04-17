# Phase 20 — Checklist

> 6 PR · 4 Wave. design.md 참조.

## W1 — PR-1 clue_type 제거

**Branch**: `feat/phase-20/PR-1-remove-clue-type`
**Depends**: —
**Scope**: `apps/server/db/migrations/00023_remove_clue_type.sql`, `apps/server/db/seed/metaphor.sql`, `apps/server/db/queries/editor.sql`, `apps/server/internal/db/editor.sql.go` (sqlc 재생성), `apps/server/internal/domain/editor/{types.go,service_clue.go,image_service.go}`, `apps/server/internal/domain/editor/clue_relation_test_fixture_test.go`, `apps/web/src/features/editor/api.ts`, `apps/web/src/features/editor/components/{ClueForm.tsx,ClueFormAdvancedFields.tsx,ClueCard.tsx,ClueListRow.tsx}`, `apps/web/src/features/editor/hooks/useClueFormSubmit.ts`, `apps/web/src/mocks/handlers/clue.ts`, `apps/web/src/features/editor/components/__tests__/*`

- [x] migration 00023 작성 (`ALTER TABLE theme_clues DROP COLUMN clue_type`)
- [x] seed/metaphor.sql 에서 clue_type 컬럼 참조 5군데 제거
- [x] db/queries/editor.sql 에서 clue_type 컬럼 제거 후 `make sqlc` (또는 `go generate`) 재생성
- [x] types.go: `CreateClueRequest/UpdateClueRequest/ClueResponse`에서 `ClueType` 삭제
- [x] service_clue.go, image_service.go: ClueType 매핑 삭제
- [x] clue_relation_test_fixture_test.go: `ClueType: "normal"` 삭제
- [x] 프론트 api.ts: `ClueResponse.clue_type` 삭제, 생성/수정 payload 타입에서 제거
- [x] ClueForm.tsx: `clueType/setClueType` state 삭제, ClueFormAdvancedFields 전달 제거
- [x] ClueFormAdvancedFields.tsx: clueType/level/sortOrder props 삭제 (이전 PoC 수정 완결)
- [x] useClueFormSubmit.ts: payload 타입에서 clue_type 제거
- [x] ClueCard.tsx, ClueListRow.tsx: clue_type 렌더 삭제 (다음 PR에서 라운드 배지로 대체)
- [x] mocks/handlers/clue.ts: `clue_type: "normal"` 픽스처 삭제
- [x] 관련 테스트 갱신: ClueForm.test, CluesTab.test, LocationClueAssignPanel.test, editorClueApi.test (+ CluePlacementPanel, LocationsSubTab, useClueGraphData, clue.test.ts, e2e 픽스처 2건)
- [x] `make lint` + `make test` 통과 확인 (go build/vet/-race ./..., golangci-lint, tsc, ESLint, Vitest 1034 tests)
- [ ] PR 생성 → 리뷰 → 머지

## W2 — PR-2 라운드 스케줄 (컬럼+API+폼)

**Branch**: `feat/phase-20/PR-2-round-schedule`
**Depends**: PR-1

- [x] migration 00025 (theme_clues.reveal_round/hide_round + theme_locations.from_round/until_round, CHECK constraints)
- [x] sqlc 재생성 (pgtype.Int4 round 필드 확인)
- [x] types.go: 단서·장소 DTO에 round 필드 추가 (pointer nullable, validate:min=1)
- [x] service_clue.go, service_location.go: round 필드 매핑 + int32PtrToPgtype/pgtypeInt4ToPtr helper
- [x] 프론트 api.ts + editorMapApi.ts: 응답 타입 + PATCH/POST payload round 포함
- [x] ClueForm.tsx: revealRound/hideRound state + 편집 모드 로드 + submit 포함
- [x] ClueFormAdvancedFields.tsx: parseRoundInput + 두 number input (controlled, 부모 state)
- [x] LocationRow.tsx: useUpdateLocation 인라인 편집 (blur/Enter commit, 에러시 롤백)
- [x] 서비스 레이어 검증: validateClueRoundOrder + validateLocationRoundOrder (400 AppError)
- [x] 테스트: round_validation_test (12 서브케이스), ClueForm.test 3 신규, LocationsSubTab.test 4 신규
- [x] `make ci-local` 통과 (lint + typecheck + test + build)
- [ ] PR 생성 → 머지

## W2 — PR-3 라운드 배지 노출 (병렬)

**Branch**: `feat/phase-20/PR-3-round-badge`
**Depends**: PR-1

- [x] `apps/web/src/features/editor/utils/roundFormat.ts` 신규 (formatRoundRange: null/단일/열림/닫힘 4종)
- [x] ClueCard.tsx: Lv.x 줄 → roundLabel 배지 (없으면 row 전체 생략)
- [x] ClueListRow.tsx: Lv.x → 라운드 배지 span (없으면 생략, 공통 배지와 공존)
- [x] 단위 테스트: roundFormat 5 + ClueCard 3 + ClueListRow 4 = 12 신규 (aria-label="라운드 범위" 기반)
- [x] `make ci-local` 통과 (lint + typecheck + 1050+ tests + build)
- [ ] PR 생성 → 머지 (PR-2 payload 타입에 의존하므로 PR-2 선행 merged 후 brown-bag)

## W3 — PR-4 통합 엣지 스키마

**Branch**: `feat/phase-20/PR-4-unified-edges`
**Depends**: PR-1

- [x] migration 00024 (clue_relations DROP + clue_edge_groups + clue_edge_members + CHECK trigger/mode/craft-or)
- [x] db/queries/clue_edges.sql 신규 (List groups/members, Delete all, InsertGroup, BulkInsertMembers) — clue_relation.sql 삭제
- [x] sqlc 재생성 → `ClueEdgeGroup` / `ClueEdgeMember` 모델 + Queries 메서드 생성
- [x] types.go: `ClueEdgeGroupRequest/Response` (targetId + sources[] + trigger + mode), 구 ClueRelationRequest/Response 삭제
- [x] clue_edge_service.go 신규 — Get/Replace + 헬퍼 3종 (validate, detectCycle, persist)
- [x] clue_edge_handler.go 신규, 엔드포인트 `GET/PUT /v1/editor/themes/:id/clue-edges`
- [x] 구 clue_relation_* 파일 5개 삭제 + 공용 fixture는 `test_fixture_test.go`로 분리
- [x] internal/clue/graph.go: `Dependency.Trigger` + `Resolve(discovered, crafted)` — AUTO 자동 해금, CRAFT는 crafted 셋 필수
- [x] 사이클 탐지 (Kahn) + CRAFT+OR 차단 + maxClueEdgeGroups=500 상한
- [x] apperror: `EDGE_CYCLE_DETECTED`, `EDGE_INVALID_CRAFT_OR` (400)
- [x] 테스트: graph_test 4 신규 (CRAFT+OR 거부, default AUTO, craft hidden, craft→auto 체인), clue_edge_handler_test 6 신규
- [x] `make ci-local` 통과 (lint + typecheck + test + build)
- [ ] PR 생성 → 머지

## W3 — PR-5 CombinationModule 리팩터

**Branch**: `feat/phase-20/PR-5-combination-unified`
**Depends**: PR-4

- [x] combination.go Init: `AddDependency` Trigger=CRAFT 마킹 → graph가 자동 해금 금지, 조합 이벤트만 unlock
- [x] findCombo: `group_id` 우선 매칭(O(1)) + legacy `evidence_ids` set-equality fallback
- [x] WS `combine {evidence_ids}` 입력/출력 이벤트 이름 유지 — `group_id` 옵셔널 필드 추가 (omitempty)
- [x] engine `PhaseEngine.currentRound` 필드 + Start=1 + AdvancePhase++ + `CurrentRound()` 공용 API + `phase.advanced` audit에 `round` 포함
- [x] `engine.GameState.CurrentRound int32` 필드 추가 (snapshot/restore 자동 포함)
- [x] `clue.RoundRange` + `clue.FilterByRound` helper 신규 (pure function, PR-6에서 visibility 통합 예정)
- [x] `craftedAsClueMap` helper로 derived 셋을 `graph.Resolve(discovered, crafted)` 에 주입
- [x] 테스트: round_filter_test 3, phase_engine CurrentRound 1, combination GroupID/crafted 3 = 7 신규
- [x] snapshot restore 기존 `combinationState` 호환 유지 (Completed/Derived/Collected 필드 변경 없음)
- [x] `make ci-local` 통과
- [ ] PR 생성 → 머지

## W4 — PR-6 PoC → 정식 프론트 승격 + E2E

**Branch**: `feat/phase-20/PR-6-edges-ui-promote`
**Depends**: PR-2, PR-4

- [x] `clueEdgeApi.ts` 신규: `useClueEdges`/`useSaveClueEdges` + 타입 (targetId + sources[] + trigger + mode)
- [x] `useClueEdgeData.ts` 신규: groups ↔ ReactFlow edges 변환 (1 group = 1 source 기본), optimistic add, EDGE_CYCLE_DETECTED/EDGE_INVALID_CRAFT_OR 롤백, 1s debounce autoSave
- [x] `ClueEdgeGraph.tsx` 신규: ClueRelationGraph 대체, CluesTab에서 직접 import
- [x] MSW `handlers/clue.ts`: `/clue-relations` 핸들러를 `/clue-edges` + ClueEdgeGroupResponse 로 교체 (E2E_CLUE_EDGE_GROUPS fixture 2건)
- [x] 콜러 업데이트: ThemeEditor(validateClueGraph에 groups→flat relations 변환), CluesTab(ClueEdgeGraph import), editorClueApi(clueEdgeKeys invalidation)
- [x] 구 파일 5개 삭제: clueRelationApi.ts, useClueGraphData.ts, ClueRelationGraph.tsx, ClueRelationGraph.test.tsx, useClueGraphData.test.ts
- [x] 테스트 보정: `clue.test.ts` 6 케이스 재작성 (edges shape), `useClueEdgeData.revert.test.ts`(EDGE_CYCLE_DETECTED)
- [x] E2E rename: `clue-relation-{stubbed,live}.spec.ts` + `clue-relation.spec.ts` → `clue-edges-*.spec.ts`, 내부 path 전부 `/clue-edges`
- [x] golden-path fixtures: `/clue-relations` → `/clue-edges`, `{ relations: [], mode: "AND" }` → `[]` (shape 수정)
- [x] `make ci-local` 통과 (lint + typecheck + Vitest 1060+ tests + build)
- [ ] PR 생성 → 머지

## W4 스코프 보정 (PR-6 실행 기록)

원본 체크리스트의 일부 항목은 현재 워킹트리에 해당 파일이 없어 무효:
- `components/clues/poc/` 디렉터리 없음 → `components/clues/` 아래 파일명만 rename
- `fixtures.ts`, `roundStorage.ts`, `mmp-poc-rounds` localStorage 키 — 존재하지 않음 → skip
- ClueEdgeNode 의 roundLabel 데이터 연동은 PR-3 배지 컴포넌트(ClueCard/ClueListRow)로 이미 수행; 그래프 노드 라벨에 라운드 삽입은 PR-7 후속으로 분리

---

## 통합 verification (Phase 종료 조건 체크)

- [ ] `rg -n "ClueType|clue_type" apps/` → 0 매치 (예상)
- [ ] 에디터 라운드 편집 → 새로고침 → 서버에서 복원 확인
- [ ] 관계 그래프 통합 UI: AUTO/CRAFT 3종 엣지 + 드래그 + Inspector
- [ ] 실게임 세션 round 필터 동작
- [ ] Vitest 전체 green, Go test race green, Playwright E2E green
