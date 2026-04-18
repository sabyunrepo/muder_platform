# Go backend delta (Phase 19 → 20)

> **Base**: `ba20344` (Phase 19 W3 synthesis) · **Head**: `23c925c` (main, 2026-04-18)
> **Window**: ~1.5 days. Phase 20 PR-1~6 (#71~#77) + Phase 20 archive (#78) + graphify tooling (#79~#81).
> **Scope**: `apps/server/**` 신규 코드에서 Phase 19 F-01 finding 해소 상태와 신규 이슈만.
>
> 방법: base=ba20344 / head=23c925c git diff 36 파일 + graphify-out/GRAPH_REPORT.md god nodes/hyperedges 교차 확인 + `wc -l` + `^func ` 스캔.

## Phase 19 F-01 해소 상태

| ID | 설명 | 상태 | 근거 |
|----|------|------|------|
| F-go-1 | `http.Error` → RFC9457 우회 (seo 3 + infra/storage/local 8 + ws/upgrade 1 = 12건) | **UNRESOLVED** | `rg http\.Error\(` 현행 12 match (`seo/handler.go:121/136/151`, `infra/storage/local.go:118/133/143/149/156/164/184/194`, `ws/upgrade.go:116`) — 델타 건드리지 않음 |
| F-go-2 | `domain/social/service.go` 759줄 2-interface 혼재 | **UNRESOLVED** | 여전히 759 (변경 없음) |
| F-go-3 | 수동 500+ 파일 7건 | **STALE (+2 신규 crossings)** | 기존 7건 전부 여전 · 신규: `module/crime_scene/combination.go` 442→533 (+91) · `domain/editor/service.go` 484→505 (+21). editor split(clue_edge_handler/service 분리)으로 `handler.go` 는 576 유지 |
| F-go-4 | 함수 80+ 6건 (coin PurchaseTheme 156 등) | **UNRESOLVED** | 델타 파일 안 건드림. 델타에서 신규 80+ 함수는 0건 확인 (`clue_edge_service.go` 3함수 중 최대 `ReplaceClueEdges` 35줄 · `validateEdgeGroupRequests` 34줄 · `persistClueEdges` 41줄) |
| F-go-5 | `httputil/json.go:22` `log.Printf` 잔재 | **UNRESOLVED** | `rg log\.(Printf|Println)|fmt\.Println` 현행 1건 (동일 위치) |
| F-go-6 | Handler DI 수동 생성자 (0 DB 필드) | **RESOLVED / STABLE** | 신규 `clue_edge_handler.go` 도 `h.svc` 만 사용, `parseUUID`·`httputil.WriteJSON`·`apperror.WriteError` 일관. Grep `^\s*q\s+\*db\.Queries` handler*.go → 0건 |
| F-go-7 | 프로덕션 `context.Background()` 1건 (session.go:106 설계 의도) | **STABLE** | 델타에서 증가 없음. 동일 위치만 잔존. (ws/reading_handler.go 4건은 pre-delta — phase 19 에서 못 본 것) |
| F-go-8 | WS hub lifecycle goroutine ctx 無 | **UNRESOLVED** | `ws/hub.go` 델타 변경 0 |

## 신규 Finding

### D-GB-1 (P2): `combination.go` 442→533 (500줄 한도 초과)
- **파일**: `apps/server/internal/module/crime_scene/combination.go:533`
- **근거**: Phase 20 PR-5 가 CRAFT 트리거 + `graph.AddDependency` + `findCombo(p)` + `group_id` 매칭 경로를 추가하면서 +91 줄. CLAUDE.md Go 500줄 하드 리밋 신규 위반.
- **Action**: `combination.go` (core + state) / `combination_graph.go` (graph build + checkNewCombos + findCombo) / `combination_state.go` (snapshot/SaveState/RestoreState) 3-way split. 함수 경계는 전부 80줄 미만이므로 파일 분할만으로 해소.
- **Phase 19 backlog 통합**: F-go-3 PR-4 (module 4건 리팩터 [cross:03]) 에 5번째 아이템으로 편입.

### D-GB-2 (P2): `editor/service.go` 484→505 (500줄 경계 crossing)
- **파일**: `apps/server/internal/domain/editor/service.go:505`
- **근거**: Phase 20 PR-4 가 Service interface 에 `GetClueEdges`/`ReplaceClueEdges` 2메서드(+6줄) 추가 + Phase 20 PR-2 round 스케줄 필드 12개 (`types.go` 에 들어갔으나 interface 서명 영향 없음). 실제 증분은 interface 선언 2줄 + Response struct 확장.
- **Action**: `service.go` 는 이미 theme/shared helper 만 남겼으므로 5줄 허용. 다만 Phase 19 F-go-3 기조(“500+ 파일 누적”)에서 해당 Phase 3건 이상 → P2 경계. `types.go` (165줄) 를 `types_theme.go` / `types_clue_edge.go` / `types_validation.go` 3 파일 분리 시 자연스러운 감축 가능.
- **리스크**: 낮음. Interface 서명 일관 · 모든 구현 `*service` 에 존재 (clue_edge_service.go).

### D-GB-3 (P2, advisory): `clue_edge_service.go` 독립 파일로 정상 분할 — positive pattern
- **파일**: `apps/server/internal/domain/editor/clue_edge_service.go:234`
- **근거**: Phase 20 PR-4 에서 기존 `clue_relation_service.go`(166) 를 unified schema 버전 234줄로 재작성. 3계층 경계 완벽: Handler(51) → Service(234) → `db.Queries.With Tx` 만 접근, raw `*pgxpool.Pool` 은 persistClueEdges tx helper 안에서만 노출.
- **Positive insight**: `detectEdgeCycle` 이 `clue.Graph` 재사용 (god node `New()` 562 edges 계열). graphify hyperedge "Clue DAG cycle detection (editor + runtime)" INFERRED 0.80 과 일치 — runtime 측 `combination.go` 도 동일 graph API 사용. 중복 없이 권장 패턴.
- **Action 없음** — backlog PR-4 가 `editor/handler.go` 분할 시 handler layer 일관성 유지를 위한 참조 모델로 기록.

### D-GB-4 (P2): sqlc 파라미터 바인딩 패턴 일관성 — 신규 regression 없음
- **파일**: `apps/server/db/queries/clue_edges.sql:23` + `apps/server/internal/domain/editor/clue_edge_service.go:196`
- **근거**: `BulkInsertClueEdgeMembers` 가 `unnest(@group_ids::uuid[]), unnest(@source_ids::uuid[])` 쌍-unnest 패턴으로 bulk insert. 다른 bulk 쿼리(없음) 와 비교 대상 적지만, sqlc `@name` 네임드 파라미터를 쓴다는 점에서 positional `$1`/`$2` 섞지 않음. `persistClueEdges` 는 `pgx.BeginTxFunc` 로 atomic delete+insert 보장.
- **Positive**: tx 내부에서 `s.q.WithTx(tx)` pattern — Phase 19 F-go-3 에서 positive baseline 으로 언급된 handler DI 와 동일 기조.

### D-GB-5 (P2, cross-ref): `phase_engine.go` 의 `currentRound` 추가가 Logger 인터페이스 재의존
- **파일**: `apps/server/internal/engine/phase_engine.go:42`, `:149`, `:179`, `:185`
- **근거**: Phase 20 PR-5 가 `currentRound int32` + `CurrentRound()` 접근자 + `AdvancePhase` 에서 ++ + audit payload 필드 추가. `Step` 함수에 `e.logger.Printf(...)` 호출이 있음(L149, 388). Phase 19 F-go-5 zerolog 전용 규칙은 `log.Printf`(표준 lib) 대상 — 여기 Logger 는 engine 전용 interface이라 OK이지만, 구현이 zerolog 래퍼인지 확인 필요.
- **Action**: 이미 존재하던 코드. 새 결함은 아니지만 Phase 19 backlog "zerolog 일관성" PR 작업 시 `engine.Logger` interface 가 zerolog adapter 로 구현됐는지 한 차례 정적 확인 권장.

## 파일 크기 위반 (신규, wc -l 실측)

| 파일 | 이전 | 현재 | 델타 | 한도 | 상태 |
|------|------|------|------|------|------|
| `internal/module/crime_scene/combination.go` | 442 | **533** | +91 | 500 | **NEW 초과** |
| `internal/domain/editor/service.go` | 484 | **505** | +21 | 500 | **NEW 초과** |
| `internal/domain/editor/clue_edge_service.go` | (신규) | 234 | +234 | 500 | OK |
| `internal/domain/editor/service_location.go` | 206 | 226 | +20 | 500 | OK |
| `internal/domain/editor/service_clue.go` | 196 | 221 | +25 | 500 | OK |
| `internal/clue/graph.go` | 171 | 240 | +69 | 500 | OK |
| `internal/clue/round_filter.go` | (신규) | 45 | +45 | 500 | OK |
| `internal/engine/phase_engine.go` | 365 | 403 | +38 | 500 | OK |

함수 80줄 초과 신규: **0건**. 델타 파일 내 최대 함수는 `clue_edge_service.persistClueEdges` 41줄.

## graphify 구조 insight

GRAPH_REPORT.md `ba20344` 시점이 아니라 **fresh 2026-04-18 rebuild** 이라 델타 반영된 상태. apps/server 관련 신호:

1. **God node 상위는 공용 헬퍼** — `New()` 562, `WriteError()` 153, `Internal()` 146, `UserIDFrom()` 97. `apperror.WriteError` 와 `apperror.Internal` 이 top-10 안에 있어 Phase 19 F-go-6 positive baseline 재확인 — handler 계층 일관성 유지 중.
2. **Hyperedge "Clue Discovery Pipeline: Graph.Resolve → FilterByRound → ComputeVisible"** (INFERRED 0.85, L569) 가 Phase 20 PR-2/PR-5 의 핵심 런타임 경로. `round_filter.go` 신규 + `graph.go` CRAFT 확장 + `visibility.go` 기존 호출이 한 파이프라인으로 묶여 인식됨. graphify 가 runtime 측 파이프라인은 잡지만 **editor 측 `detectEdgeCycle` → clue.Graph reuse 연결은 INFERRED 0.80 "Clue DAG cycle detection (editor + runtime)"** (L607) 으로 별도 등장. 두 community 가 분리돼 있어 Phase 21 분할 시 `internal/clue/` 패키지 안정 API 를 보존해야 editor+runtime 양방 깨지지 않음.
3. **Surprising connection 0건** — apps/server 영역에서 "몰랐던 경로" 는 없음. 전부 설계 문서와 일치.
4. **과결합 hotspot**: Community 1 "WebSocket Hub & Messaging" 126 노드 (hubBroadcaster/managerSessionSender/VoiceBridge 등) — Phase 19 F-go-3/F-go-8 이 이미 지적한 영역. 델타에서 새로 붙은 것 없음.

## 우선순위 제안 (Phase 19 backlog PR-3/PR-4 통합 순서)

Phase 19 backlog 에 이미 **PR-3 (apperror 전환, P1)** + **PR-4 (500줄 파일 분할, P1)** 초안이 있다고 가정 (→ `docs/plans/2026-04-17-platform-deep-audit/refs/phase19-backlog.md` 교차 확인 필요).

1. **PR-3 (apperror)**: 델타 영향 없음 — Phase 19 그대로 진행. seo 3 + infra/storage 8 + ws/upgrade 1 그대로 12 위치.
2. **PR-4 (파일 분할)**: 신규 2건 편입.
   - 기존 7건 (social/editor/ws/module) + **신규 `combination.go`** + **신규 `editor/service.go`** = **9건**.
   - Wave 분할 시 editor 묶음(handler.go + service.go + types.go + media_service.go) 하나, module 묶음(reading/voting/hidden_mission/accusation/trade_clue/**combination**) 하나, infra 묶음(ws/hub.go + social/service.go + coin/service.go) 하나 — 3 PR 분할 권장.
3. **PR-3 앞, PR-4 뒤** — Phase 19 순서 유지. PR-4 가 editor/handler.go 를 건드리면 `clue_edge_handler.go` 에 정착한 파일 분리 패턴을 handler_theme/character/map/location/clue/content 에 동일 적용하면 됨.
4. **추가 필요 작업**: `types.go` 분할 (D-GB-2 완화 전제조건). Phase 19 에 누락된 항목. PR-4 editor 묶음 안 helper task 로 추가.
5. **Phase 19 F-go-5 / F-go-8** 델타 영향 없음, 원 우선순위 유지.

## Cross-refs

- [cross:03] module-architect — `combination.go` 500+ 신규 분할은 module 카테고리 리팩터에 포함 필요.
- [cross:04] test-engineer — `combination_test.go` (+75 lines) · `clue_edge_handler_test.go` (+198) · `round_validation_test.go` (+78) · `graph_test.go` (+107) 추가. coverage delta 는 test-delta.md 에서 수치 확인.
- [cross:05] security — Phase 20 migration 00024 `clue_edge_groups_craft_requires_and` CHECK 제약 + service 레이어 `validateEdgeGroupRequests` 이중 방어. RFC9457 응답 코드 `EDGE_INVALID_CRAFT_OR` / `EDGE_CYCLE_DETECTED` 신규 — apperror 레지스트리 반영 여부 security-delta.md 에서 확인.
