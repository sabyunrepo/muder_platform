---
name: Phase 20 플랜 — 단서·장소 에디터 정식 승격
description: PoC → 백엔드 연동 (clue_type 제거 + 통합 엣지 그래프 + 라운드 스케줄 + 프론트 승격). 6 PR · 4 Wave.
type: project
originSessionId: 40df8816-19e4-4b87-ae1f-dbc0f2c72cc1
---
# Phase 20 — 단서·장소 에디터 정식 승격

**시작**: 2026-04-17 | **상태**: implementing (W1 PR-1 진행 중)

## 배경

2026-04-17 에디터 UX 리뷰 세션에서 PoC로 검증 완료된 4가지 개선을
정식 백엔드 스키마·API·프론트로 승격하는 Phase.

## 진행 상황 (2026-04-17 세션 종료 시점)

- **Phase 18.8**: `.claude/active-plan.phase-18.8.json.bak` 으로 stash (W3 PR-5 observation 상태 그대로). 관측 종료 후 `/plan-finish` 예정.
- **PoC 산출물 보관**: `tmp/phase-20-poc-baseline` 브랜치 (commit `86383a7`, 21 파일). PR 머지 대상 아님 — PR-6에서 일부 재이식.
- **PR-1 브랜치 생성**: `feat/phase-20/pr-1-remove-clue-type`. Phase 20 design/checklist 파일 복원됨.
- **active-plan.json**: Phase 20(phase-20-clue-edges-unified)으로 전환. scope 파일 21개 명시.
- **PR-1 실제 구현**: 미착수 — migration 00023, seed 정리, editor.sql 쿼리 수정, sqlc 재생성, 백엔드 타입 3파일, 프론트 7파일, 테스트 5파일.

## 설계 문서

- **Index**: `docs/plans/2026-04-17-clue-edges-unified/design.md`
- **Checklist**: `docs/plans/2026-04-17-clue-edges-unified/checklist.md`

## 7대 결정 (확정)

| # | 결정 | 선택 |
|---|---|---|
| 1 | Scope | migration 3개 + 통합 엣지 + 라운드 |
| 2 | 라운드 저장 | theme_clues·theme_locations 정규 컬럼 (INT NULL) |
| 3 | 기존 clue_relations | 드롭 후 재생성 (이관 없음) |
| 4 | CombinationModule | 통합 (clue_edge_groups trigger=CRAFT 소비) |
| 5 | 타입 enum | 완전 제거 (`clue_type` 삭제) |
| 6 | 장소 해금 그래프 참여 | **제외** (다음 Phase) |
| 7 | 엔딩/승리 엣지 | **제외** (조합 즉시 종료 시나리오 부재) |

## Wave·PR 구조

| Wave | PR | 범위 | 의존 |
|---|---|---|---|
| W1 | PR-1 | `clue_type` 제거 (migration 00023 + 서버·프론트) | — |
| W2 | PR-2 | 라운드 컬럼·API·폼 (migration 00025) | PR-1 |
| W2 | PR-3 | 단서 카드·리스트 라운드 배지 (병렬) | PR-1 |
| W3 | PR-4 | `clue_edge_groups` + `clue_edge_members` (migration 00024) | PR-1 |
| W3 | PR-5 | CombinationModule 리팩터 | PR-4 |
| W4 | PR-6 | PoC → 정식 프론트 승격 + E2E | PR-2, PR-4 |

## PR-1 세부 (진행 중)

Branch: `feat/phase-20/pr-1-remove-clue-type`

**남은 작업**
1. `apps/server/db/migrations/00023_remove_clue_type.sql` 작성 (DROP COLUMN)
2. `apps/server/db/seed/metaphor.sql` — `clue_type` 컬럼 참조 5곳 삭제 (L65, L74, L83, L92, L105)
3. `apps/server/db/queries/editor.sql` — CreateClue(L70) / UpdateClue(L75) 쿼리에서 clue_type 파라미터 제거, 번호 재조정
4. `sqlc generate` → `internal/db/editor.sql.go` 자동 갱신
5. 백엔드: `internal/domain/editor/{types.go,service_clue.go,image_service.go,clue_relation_test_fixture_test.go}` 에서 ClueType 필드·매핑 삭제
6. 프론트: `api.ts`, `ClueForm.tsx`, `ClueFormAdvancedFields.tsx`, `ClueCard.tsx`, `ClueListRow.tsx`, `useClueFormSubmit.ts`, `mocks/handlers/clue.ts`
7. 테스트: ClueForm.test, CluesTab.test, editorClueApi.test, LocationClueAssignPanel.test, LocationsSubTab.test
8. `go test -race ./... && pnpm test && make lint` 통과
9. PR 생성

**재개 방법** (다음 세션)

```bash
git checkout feat/phase-20/pr-1-remove-clue-type
cat docs/plans/2026-04-17-clue-edges-unified/checklist.md   # W1 PR-1 체크리스트
```

또는 `/plan-resume` 실행.

## 중요 경로 참조

- 설계: `docs/plans/2026-04-17-clue-edges-unified/`
- PoC baseline (PR-6 이식원): `tmp/phase-20-poc-baseline` (local branch, commit `86383a7`)
- Phase 18.8 stash: `.claude/active-plan.phase-18.8.json.bak`
- `sqlc` CLI: `/Users/sabyun/go/bin/sqlc`, config: `apps/server/db/sqlc.yaml`
- dagre 의존성: `apps/web/package.json`에 `@dagrejs/dagre` 설치됨(tmp 브랜치), PR-6에서 main에 반영 예정

## 스코프 외 (미뤄진 것)

- 장소 해금 그래프 참여 (증거→장소)
- 라운드 Gantt 타임라인 뷰
- 다중 엔딩 / 승리 엣지
- clue_edge.target_kind 확장 (TIMER/VOTE/LOCATION_VISIT)
