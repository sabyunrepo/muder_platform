# Security Delta — Phase 19 F-05 → Phase 20 (2026-04-18)

> **Window:** `ba20344` → `23c925c` · **Phase 20 PRs:** #71~#78 (단서·장소 에디터 정식 승격) + graphify 툴링 #79~#81
> **Base spec:** `docs/plans/2026-04-17-platform-deep-audit/refs/audits/05-security.md` (F-sec-1 ~ F-sec-12)
> **Goal:** Phase 19 P0 4건 해소 여부 + 신규 handler/migration/sqlc 경로 보안 점검.

## Phase 19 F-05 P0 해소 상태 (요약)

**해소: 0/4.** Phase 20는 에디터 기능 확장(단서·장소 라운드 스케줄 + clue_edge_groups 통합)에 집중한 wave이며, F-05 P0 해소를 범위로 포함하지 않았음. 모든 원인 코드가 window 내 그대로 유지됨.

| ID | 제목 | 상태 | 근거 (현 main 기준) |
|---|---|---|---|
| F-sec-1 | RFC 9457 우회 `http.Error` 11회 | ❌ **미해소** (+1 신규) | `infra/storage/local.go:118,133,143,149,156,164,184,194` (8) · `seo/handler.go:121,136,151` (3) · `ws/upgrade.go:116` (1) → **총 12회**. 신규 editor handler는 전부 `apperror.WriteError` 사용. |
| F-sec-2 | PlayerAware 25/33 미구현 | ❌ **미해소** | `BuildStateFor` 구현 여전히 8개 파일(decision×2, communication×1, cluedist×5). 25개 모듈 fallback. Phase 20은 모듈 동작 변경(CRAFT 트리거)만 추가했을 뿐 redaction 미추가. |
| F-sec-3 | voice mock JWT 평문 로그 | ❌ **미해소** | `domain/voice/provider.go:108` `Str("token", token)` 그대로. Phase 20 window 내 voice 파일 변경 없음. |
| F-sec-4 | admin/auth auditlog 0건 | ❌ **미해소** | `domain/` 전체 `auditlog.Log\|LogAsync\|Event` 호출 **0건** 유지. Phase 20 신규 clue_edge/location 민감 operation도 audit 기록 없음. |

**WithInstance 상태 (F-sec-6 연관):** Phase 19 시점 `domain/**`에서 0건 — 현재도 `apperror_test.go` + `handler_test.go`의 테스트 코드에서만 사용. 프로덕션 호출 경로 여전히 0건. Problem Details `instance` 필드 모두 빈 값 반환.

**WS 토큰 처리 변화:** `ws/upgrade.go` window 내 무변경. 토큰 추출은 `r.URL.Query().Get("token")`(L70) 유지 — 쿼리 파라미터 방식 정책 준수. F-sec-8(DevMode 전파 위험)과 F-sec-9(legacy session-level snapshot key) 모두 무변경.

## Phase 20 신규 Finding

### D-SEC-1 — 신규 clue_edge 민감 operation에 auditlog 부재 [P1]
- **위치:** `apps/server/internal/domain/editor/clue_edge_service.go:77-111` `ReplaceClueEdges`, `apps/server/internal/domain/editor/service_clue.go:122-132` `DeleteClue`, `service_location.go:82-92` `DeleteMap`, `service_location.go:189-199` `DeleteLocation`.
- **문제:** 단서 그래프 전면 교체(`ReplaceClueEdges` — delete-then-insert 트랜잭션)와 cascade 삭제(map → 모든 location·clue·edge)는 **비가역적 쓰기** 이지만 zerolog `Error` 만 남김. 창작자 계정 탈취·트러블 시 "누가 단서 관계를 지웠는가?" 재구성 불가. F-sec-4의 패턴이 editor 도메인으로 확장됨.
- **권장:** `auditlog.Log(ctx, themeID, "editor.clue_edges.replace", {prevGroupCount, nextGroupCount})` 호출 추가 + `DeleteClue/DeleteLocation/DeleteMap`도 동일. F-sec-4 전체 해소 PR에 포함.

### D-SEC-2 — ReplaceClueEdges 소유권 검증과 소스 검증의 TOCTOU 가능성 [P2]
- **위치:** `clue_edge_service.go:78 (getOwnedTheme)` → `:85 (ListCluesByTheme)` → `:196 (BeginTxFunc)`.
- **문제:** 세 단계가 **동일 트랜잭션이 아님**. 소유권 확인 ~ 트랜잭션 시작 사이 20~100ms 동안 theme 소유자가 변경되면(admin force-transfer, trusted-creator flip 등 이론적 경로) 과거 소유자가 타인 theme의 edge를 재작성 가능. Phase 20 기존 편집 플로우에도 같은 패턴이 있었으나 `ReplaceClueEdges`는 theme 전체 edge graph를 교체하는 **최대 영향 연산**이라 위험도가 상승.
- **완화:** 현재 `persistClueEdges`가 `DeleteClueEdgeGroupsByTheme(themeID)`로 theme ID를 직접 WHERE 절에 사용 → 외부 theme 데이터 파괴는 불가. 실제 공격 surface는 "타 theme 소유자 변경 중 윈도우". 낮은 실현성.
- **권장:** 트랜잭션 내부 첫 쿼리로 `SELECT creator_id FROM themes WHERE id = $1 FOR UPDATE` 추가해 락+재검증. 혹은 `UpdateThemeVersion` 패턴 도입(이미 `UpdateTheme`에서 사용 — 일관성 ↑).

### D-SEC-3 — ReplaceClueEdges 500-edge cap은 통과하나 members fan-out 미제한 [P2]
- **위치:** `clue_edge_service.go:25,81-83,211-220`.
- **문제:** `maxClueEdgeGroups = 500`으로 group 수는 제한되지만 **group당 `sources` 배열 크기는 무제한**. 500 group × N sources = `BulkInsertClueEdgeMembers`의 pgx array parameter가 임의 크기로 커질 수 있음. `http.MaxBytesReader(..., 1<<20)` = 1 MB body cap이 상한 역할(약 25k UUID 문자열 추정)이나 명시 상한 부재.
- **권장:** `MaxCluesPerTheme=500`과 일관되게 group당 `len(r.Sources) <= MaxCluesPerTheme` 또는 총 member 수 상한(예: 5000) 추가. 현재는 `detectEdgeCycle`이 aggregate 후 검증하므로 거대 입력 시 **cycle detection이 O(N²) worst-case**로 흐를 수 있음.

### D-SEC-4 — Phase 20 migrations에 RLS(Row-Level Security) 정책 미설정 [P2 · 전Phase 공통]
- **위치:** `db/migrations/00024_unified_clue_edges.sql`, `00025_round_schedule.sql`.
- **문제:** 신규 테이블 `clue_edge_groups`, `clue_edge_members`가 서비스 레이어 `getOwnedTheme` 가드에만 의존. Phase 19 F-03 지적(RLS 전무)이 Phase 20 신규 테이블에서도 재현. 서비스 가드 우회(sqlc 직접 호출, admin debug 경로)가 있으면 cross-tenant leak.
- **권장:** Phase 21 plan에 RLS 도입 shadow 추가. Phase 20 migrations 자체는 backward-compatible이므로 후속 ALTER로 가능.

### D-SEC-5 — `RestrictedCharacters` 필드가 plaintext CSV로 저장 [P3 · 정보성]
- **위치:** `service_location.go:140,168`, `types.go:36,44,55`, migrations(기존 `theme_locations`).
- **관찰:** Location 접근 제한 대상 캐릭터 목록이 `*string`(CSV로 추정)으로 저장/반환. 권한 분리가 아니라 **creator 메타데이터**에 그침. Phase 20 `LocationsSubTab` UX 개선은 여기에 영향 없음.
- **권장:** 정보성. 현재 신뢰 경계가 "creator만 수정 가능"이므로 위협 모델 내. 향후 player-facing runtime에서 동일 필드가 broadcast되면 redaction 대상 재평가.

### D-SEC-6 — `snapshot.go` 경로에 clue_edge_groups 노출 분기 미조사 [P2 · 보류]
- **관찰:** Phase 20 `ReplaceClueEdges`가 생성하는 trigger='CRAFT' 그룹은 runtime 시점 "조합 해제" 정보. 현재 `session/snapshot*.go` 경로(window 외)가 `theme_clues` 외에 `clue_edge_groups`를 직접 읽는지 본 감사에서 확인 불가(window 외 파일). **만약 snapshot에 edge graph가 포함되면** F-sec-2 PlayerAware 구멍(25/33)과 겹쳐서 "아직 해금되지 않은 CRAFT target의 source 조합"이 premature 노출 가능.
- **권장:** Phase 19 F-sec-2 P0 해소 PR에서 snapshot payload 리스트 업데이트 시 `clue_edge_groups` 포함 여부 + redaction 규칙 명시. test-engineer가 회귀 test fixture에 CRAFT 그룹 포함.

## sqlc 파라미터 바인딩 · 입력 검증 · WS 토큰 (P0 이외 체크리스트)

- ✅ **sqlc 파라미터 바인딩:** `db/queries/clue_edges.sql`, `editor.sql`, `clue_relation.sql` 전부 `$N`/`@name` 파라미터만 사용. `fmt.Sprintf(...SELECT|INSERT|UPDATE|DELETE...)` 패턴 `internal/db/` 전역 0건. string concat 없음.
- ✅ **입력 검증:** 신규 `ReplaceClueEdges`는 `http.MaxBytesReader` 1 MB cap + `json.NewDecoder` + trigger/mode 화이트리스트 + 소유권·중복·자기참조·cycle 검증 모두 통과. `CreateClue/UpdateClue/CreateLocation/UpdateLocation`도 `validateClueRoundOrder`/`validateLocationRoundOrder`로 CHECK constraint 미리 방어(500 → 400 변환).
- ✅ **AppError 사용:** 신규 editor handler 전부 `apperror.WriteError(w, r, err)` + `apperror.BadRequest|NotFound|Forbidden|Internal|Conflict` 도메인 코드 사용. `EDGE_INVALID_CRAFT_OR`·`EDGE_CYCLE_DETECTED` 신규 코드 2개는 인라인 생성(중앙 레지스트리 부재 — F-sec-1 영역).
- ✅ **소유권 가드(PlayerAware 경계):** `GetClueEdges`/`ReplaceClueEdges` 둘 다 첫 호출이 `getOwnedTheme(creatorID, themeID)`. `DeleteClue/DeleteMap/DeleteLocation`은 `*WithOwner` sqlc 쿼리로 atomic 소유권 + 삭제. **creator 경계 내 handler에서는 PlayerAware 구멍 아님** (player-facing runtime이 아닌 editor 도메인).
- ✅ **WS 토큰:** `ws/upgrade.go` window 내 무변경. `?token=` 쿼리 파라미터 유지, 평문 로그 신규 추가 없음.
- ⚠ **auditlog:** 신규 handler에서 호출 0건. D-SEC-1 참조.
- ⚠ **Problem Details `instance`:** 신규 handler 역시 `WithInstance` 호출 없음. F-sec-6 연장.

## auditlog 커버리지 변화

| 영역 | Phase 19 | Phase 20 | 변화 |
|---|---|---|---|
| `auditlog.Log` in `domain/**` | 0건 | 0건 | 동일 |
| `auditlog.Log` in `engine/` | 1건 (phase 전환) | 1건 | 동일 |
| 민감 editor operation | 감사 대상 인지 (admin Force*, Approve/Reject) | **+clue_edges replace, clue/location/map delete** | **커버리지 구멍 확장** |

Phase 20은 감사 부재 영역을 **넓혔지만 해소하지는 않음**. F-sec-4 해소 범위 재산정 시 editor 도메인의 delete/replace 동사도 포함 필요.

## 우선순위 제안 (Phase 21 입력용)

1. **P0 잔존 4건 일괄 해소 PR** (F-sec-1/2/3/4) — Phase 19 backlog 그대로 이관. D-SEC-1은 F-sec-4 해소 PR 범위에 흡수.
2. **P1 즉시 패치** — F-sec-5(password min), F-sec-6(WithInstance auto), F-sec-7(chi v5 upgrade) 묶음 + D-SEC-1.
3. **P2 중기** — F-sec-8/9(WS DevMode, legacy snapshot), D-SEC-2/3/4(TOCTOU, fan-out cap, RLS 공통).
4. **P3 관찰** — D-SEC-5(RestrictedCharacters plaintext).

## Cross-refs

- [cross:module-architect] D-SEC-6 (snapshot × clue_edge_groups 노출) — module-delta.md와 교차 검토 필요.
- [cross:test-engineer] D-SEC-1/2/3 회귀 테스트 추가 대상.
- [cross:go-backend] F-sec-1/4 해소 PR 구현 owner.
- [cross:docs-navigator] `feedback_ws_token_query.md`·auditlog 필수 이벤트 목록을 `project_coding_rules.md`에 승격(F-05 권장 반복).
