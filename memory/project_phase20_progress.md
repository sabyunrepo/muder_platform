---
name: Phase 20 진행 상황 (완료)
description: Phase 20 단서·장소 에디터 정식 승격. 6 PR + 1 chore, 4 Wave, 2026-04-17 완료
type: project
originSessionId: 4f653890-5e72-4b41-aeda-8c53f3d68b79
---
# Phase 20 — 단서·장소 에디터 정식 승격 (완료)

**기간**: 2026-04-17 단일 세션
**Branch 체계**: `feat/phase-20/PR-N-*` + admin bypass merge (GitHub Actions 계정 2000분 초과로 5월 1일까지 로컬 CI 검증 운영)

## 머지 현황 (모두 main 머지)

| Wave | PR | Commit | 제목 |
|------|----|--------|------|
| W1 | #71 | `5ee9512` | W1 PR-1 — theme_clues.clue_type 필드 완전 제거 |
| —  | #72 | `191a738` | chore: enhance make ci-local with typecheck + build |
| W2 | #73 | `013e4fb` | W2 PR-2 — 단서·장소 라운드 스케줄 컬럼·API·폼 |
| W2 | #74 | `80522e3` | W2 PR-3 — 단서 카드·리스트 라운드 배지 |
| W3 | #75 | `73a60ba` | W3 PR-4 — 통합 clue_edge_groups 스키마 + AUTO/CRAFT |
| W3 | #76 | `d154275` | W3 PR-5 — CombinationModule CRAFT + CurrentRound + 라운드 필터 |
| W4 | #77 | `d02b6de` | W4 PR-6 — 프론트 clue-edges 정식 승격 + E2E rename |

## 설계 결정 7건 (전부 반영)

1. ✅ Scope: migration 00023/00024/00025 + 통합 엣지 + 라운드
2. ✅ 라운드 저장: INT NULL 정규 컬럼 + DB CHECK × 6 (positive × 4 + order × 2)
3. ✅ clue_relations: 드롭 후 clue_edge_groups + clue_edge_members 재생성 (이관 없음)
4. ✅ CombinationModule: AddDependency Trigger=CRAFT 통합, crafted 셋 주입
5. ✅ clue_type enum: 완전 제거 (runtime code 0 매치)
6. ✅ 운영 안전성: Go race + Vitest + E2E rename 모두 green
7. ✅ 도입 전략: feature flag 없이 직접 적용

## 주요 산출물

### Backend
- **Schema**: migration 00023 (clue_type drop), 00024 (unified edges), 00025 (rounds)
- **clue_edge_service.go**: Get/Replace + validate(ownership + CRAFT+OR + dup) + detectCycle(Kahn) + persist(tx), 500건 상한
- **graph.go**: `Dependency.Trigger` (AUTO/CRAFT) + `Resolve(discovered, crafted)` — CRAFT는 engine이 crafted에 넣어야만 해금
- **engine.GameState.CurrentRound int32** + `PhaseEngine.CurrentRound()` (Start=1, AdvancePhase++)
- **clue.RoundRange + FilterByRound** helper (pure function)
- **CombinationModule**: Init에서 Trigger=CRAFT, checkNewCombos에 crafted 셋 주입, findCombo group_id 우선 매칭 + legacy fallback
- **apperror**: `EDGE_CYCLE_DETECTED`, `EDGE_INVALID_CRAFT_OR` (400)

### Frontend
- **clueEdgeApi.ts** (신규): useClueEdges/useSaveClueEdges + ClueEdgeGroup{Request,Response}
- **useClueEdgeData.ts** (신규): groups ↔ RF edges 변환, optimistic + EDGE_CYCLE/CRAFT+OR 롤백, 1s debounce autoSave
- **ClueEdgeGraph.tsx** (신규): ClueRelationGraph 대체, CluesTab 직접 import
- **ClueForm + AdvancedFields**: 공개/사라짐 라운드 controlled input, 역순 거부
- **LocationRow**: 인라인 라운드 편집 (blur/Enter commit, 서버 실패 시 롤백)
- **ClueCard/ClueListRow**: formatRoundRange 배지 (없으면 생략)
- **utils/roundFormat.ts**: 공통 포맷터 (null/open/closed/single 4종)

### Test coverage 추가
- `round_validation_test.go` 12 케이스
- `graph_test.go` 4 신규 (CRAFT+OR 거부, default AUTO, CRAFT hidden, CRAFT→AUTO 체인)
- `clue_edge_handler_test.go` 6 신규
- `round_filter_test.go` 3 (InWindow 16 서브케이스 + FilterByRound)
- `phase_engine_test.go` CurrentRound 1 신규
- `combination_test.go` GroupID/crafted 3 신규
- `roundFormat.test.ts` 5, `ClueCard.test.tsx` 3, `ClueListRow.test.tsx` 4
- `ClueForm.test.tsx` 라운드 3 신규, `LocationsSubTab.test.tsx` round 4 신규

## 코드 리뷰 follow-up (PR-7 후속으로 분리)

| # | 위치 | 내용 |
|---|------|------|
| M-1 | [service_clue.go:76-79](apps/server/internal/domain/editor/service_clue.go:76) | validate-before-ownership 순서 일관성 (CreateClue는 ownership→validate, UpdateClue는 반대) — 보안 영향 없음 |
| M-2 | [editorMapApi.ts:22](apps/web/src/features/editor/editorMapApi.ts:22) | `restricted_characters: string[]` 프론트 타입이 백엔드 `*string`과 drift |
| E-1 | LocationRow.tsx useEffect | 서버 PATCH 응답 후 state 재동기 — 동시 편집 드물게 clobber 가능 |
| T-1 | ClueCard.test | "R{f}~" (open-lower) 케이스 미커버 |
| PR-7 | ClueEdgeNode | 그래프 노드 자체에 라운드 라벨 삽입 (현재는 카드·리스트 배지만) |
| PR-7 | CombinationConfig | 세션 로더가 clue_edge_groups(trigger=CRAFT)로 CombinationDef 자동 생성 (현재는 config_json 경로) |

## Blocker / 미완 항목

- GitHub Actions 계정 2000분 초과 → 계정 레벨 disable, 5월 1일 자동 리셋 예정. Phase 20 전체 admin bypass merge + 로컬 CI 검증으로 운영.
- 스테이징 실게임 세션 round 필터 동작 (engine+CombinationModule 와이어링) 수동 QA 는 CI 재활성 후로 연기.

## 스테이징 DB 적용 + 라운드 왕복 QA (2026-04-17 완료)

`goose -dir db/migrations postgres "$DATABASE_URL" up` 으로 00020~00025 일괄 적용 (6 migration, 300ms). 검증 스크립트 `docker run --rm -i postgres:17-alpine psql` 로 직접 수행.

| # | 시나리오 | 결과 |
|---|---|---|
| A | `theme_clues` reveal=5 / hide=2 → CHECK `theme_clues_round_order` 위반 | ✅ 400 거부 |
| B | `theme_clues` reveal=0 → CHECK `theme_clues_reveal_round_positive` 위반 | ✅ 400 거부 |
| C | `theme_clues` reveal=2 / hide=5 정상 INSERT + SELECT 왕복 값 일치 | ✅ `(2,5)` |
| D | `theme_locations` from=1 / until=3 정상 INSERT + SELECT 왕복 | ✅ `(1,3)` |
| E | `theme_clues` 양 라운드 NULL INSERT + SELECT 왕복 | ✅ `(NULL,NULL)` |
| F | `clue_edge_groups` CRAFT+OR → CHECK `craft_requires_and` 위반 | ✅ 400 거부 |
| G | `clue_edge_groups` CRAFT+AND + 2 sources members INSERT + JOIN SELECT | ✅ `(CRAFT,AND,2)` |

부가 확인:
- `clue_relations` 테이블 DROP 확인 (information_schema 0 matches)
- `clue_edge_groups` + `clue_edge_members` 생성 확인 (각 1 row in final snapshot)
- 모든 CHECK 제약 6건 (clue positive×2 + clue order + location positive×2 + location order) + edge 3건(trigger/mode/craft_requires_and) 활성

QA fixture 은 테스트 종료 시 DELETE CASCADE 로 정리됨.

## 관련 commit 계열

`5ee9512` → `191a738` → `013e4fb` → `80522e3` → `73a60ba` → `d154275` → `d02b6de` → `151bc7d`
