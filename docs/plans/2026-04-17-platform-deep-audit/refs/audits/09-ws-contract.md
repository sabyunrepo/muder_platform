# 09 — WS Contract Audit (3자 대조)

> 관점: envelope_catalog(백엔드) ↔ MSW handlers(프론트 mock) ↔ handlers/reducers(프론트 실제) 이벤트·payload drift.
> 측정 시점: 2026-04-17. 소유자: go-backend + react-frontend 공동.

## Scope

3자 표면:
1. **Backend emit surface**: `apps/server/internal/ws/envelope_catalog.go` (client→server), `apps/server/internal/session/event_mapping.go` (server→client relay), `apps/server/internal/ws/message.go` (system types), `apps/server/internal/domain/social/ws_handler.go`, `apps/server/internal/module/**` (engine.Event Type strings)
2. **Frontend WS mock surface**: `apps/web/src/mocks/handlers/game-ws.ts` (Playwright `routeWebSocket` — only WS mock today; `apps/web/src/mocks/handlers/*.ts` 전부 REST 전용)
3. **Frontend reducer surface**: `apps/web/src/stores/gameMessageHandlers.ts` (`registerGameHandlers`), `packages/ws-client/src/client.ts` (dispatcher), `packages/shared/src/ws/types.ts` (WsEventType enum)

본 감사는 **09 ws-contract**만 다루며 계층 내부 품질은 `[cross:01]`/`[cross:02]` 태그로 패스.

## Method

1. 백엔드: `grep -rn "MustEnvelope\(\"[a-z_]+:[a-z_]+\"|engine.Event\{Type:` 로 actual emission list 추출. envelope_catalog는 **client→server inbound allowlist**, event_mapping relayPrefixes는 **server→client broadcast allowlist**. 두 축이 다른 점에 유의.
2. 프론트 mock: `game-ws.ts`만 WebSocket을 intercept (`WsEventType.GAME_START` / `SESSION_STATE` / `MODULE_STATE` / `CHAT_WHISPER`). 나머지 MSW 파일은 HTTP only — **WS 경로에 대한 mock 커버리지는 ~4 이벤트로 극히 제한**.
3. 리듀서: `registerGameHandlers`가 7개 이벤트 구독. `WsEventType` 상수 enum (26개)에 정의되었지만 구독되지 않은 이벤트 다수.
4. 교집합·차집합 매트릭스: 아래 §WS Contract Drift 표.

## Findings

### F-ws-1 — Backend relay prefix `phase:`·`phase.`와 프론트 기대값 `game:phase:change` drift
Severity: **P0** (프로덕션 실제 게임 진행에 session phase 변경이 UI에 반영되지 않음)

`apps/server/internal/engine/phase_engine.go:104,155,175,199` 엔진은 `Type: "phase:entered"`·`"phase:exiting"` 으로 emit. `session/event_mapping.go:30-46` relayPrefixes는 `phase:`·`phase.` 둘 다 relay. 그러나 `packages/shared/src/ws/types.ts:29` `GAME_PHASE_CHANGE = "game:phase:change"`. 프론트 `registerGameHandlers`는 `WsEventType.GAME_PHASE_CHANGE`만 구독 → **phase 전환 이벤트가 UI에 도달하지 않음**. 현재 E2E가 skip 처리된 원인 중 하나로 유력. Phase 18.1 B-2와 동일 계보의 SSOT drift.
[cross:01] 백엔드 event naming convention 미합의(`:` vs `.`, `phase:entered` vs `game:phase:change`) — go-backend audit에 회귀 방지책 필요.

### F-ws-2 — `game:start` / `game:end` emitter 부재, 프론트·MSW는 수신 기대
Severity: **P0** (stubbed E2E만 통과하고 real-backend에서 게임 시작 화면 전이 안 됨)

MSW `game-ws.ts:153`은 `WsEventType.GAME_START` ("game:start") 프레임을 emit하고, `registerGameHandlers`는 `GAME_END` ("game:end")를 구독 (line 89-94). 그러나 백엔드 production 코드 전체를 grep한 결과 `"game:start"` · `"game:end"` emitter는 **테스트 파일(`envelope_registry_test.go`) 외에 없음**. `event_mapping.go` relayPrefix `game:`·`game.`은 통과하지만 engine에서 해당 타입 이벤트를 publish하는 모듈이 없어 결국 사장. Phase 18.8 #6 stubbed vs real-backend drift 주요 원인.
[cross:03] module-architect: game lifecycle emission(`game.started` only in `starting_clue_test.go`) 실제 production code 부재 확인 필요.

### F-ws-3 — `session:player:joined` / `session:player:left` 미연결
Severity: **P1** (플레이어 입·퇴장이 실시간 반영되지 않아 lobby UX 퇴보)

`registerGameHandlers`는 `WsEventType.SESSION_PLAYER_JOINED` ("session:player:joined") · `SESSION_PLAYER_LEFT` ("session:player:left")를 구독 (line 60-72). 백엔드에서 이 type을 emit하는 코드 grep 결과 0건. `module/core/connection.go:86,111`는 `player.joined` / `player.reconnected` (점 네이밍) emit, 이는 relayPrefix `player.`로 relay되지만 프론트 WsEventType에 `PLAYER_JOINED`/`PLAYER_RECONNECTED` 상수 **부재**. 양쪽에서 정의가 엇갈려 어느 쪽도 수신하지 못함.
[cross:01] serialization tag 일관성 — snake_case action `:` vs dot-case event `.` 혼재. AppError에서 양쪽 둘 다 수용하도록 normalize 필요.

### F-ws-4 — clue 모듈 emit 네이밍과 WsEventType enum 완전 단절
Severity: **P1** (단서 분배·거래·공개·타임아웃 UI가 real-backend에서 작동 불가)

`module/cluedist/*.go`·`module/core/clue_interaction.go`는 **dot-case**로 `clue.acquired`·`clue.transferred`·`clue.peek_result`·`clue.timed_distributed`·`clue.conditional_unlocked`·`clue.trade_proposed/accepted/declined`·`clue.show_*` 13개 이상 emit. `WsEventType` enum에 clue 계열 상수는 **0개**. `registerGameHandlers`도 구독 0건. 현재 clue UX는 REST invalidate + polling으로 우회 (editor 한정, 런타임 세션은 가려져있음).
[cross:04] test-engineer: clue interaction E2E가 skip 목록에 포함된 배경 (18.8 plan).

### F-ws-5 — vote·ready·reading·ending emit dot-case, 프론트 enum 커버리지 부분 누락
Severity: **P1** (투표·결말·대본 낭독 UI 흐름이 stubbed-only)

백엔드 emit (production): `vote.cast`·`vote.changed`·`vote.opened`·`vote.result`, `ready.status_changed`·`ready.all_ready`, `reading.started`·`reading.line_changed`·`reading.paused`·`reading.resumed`·`reading.completed`, `ending.reveal_step`·`ending.completed`. WsEventType enum: reading 6개만 정의(단 server→client 네이밍 `reading:started`·`reading:line_changed` **콜론** vs 백엔드 emit **점** → 완전 불일치). vote·ready·ending 상수 부재. `registerGameHandlers`는 reading도 구독 0건.
[cross:02] react-frontend: readingStore/gameSelectors 커버리지 부재 재확인.

### F-ws-6 — `module:state` payload 필드 drift (`settings` vs `data`)
Severity: **P1** (MODULE_STATE 수신 시 runtime undefined 접근 가능성)

프론트 `gameMessageHandlers.ts:30-33` `ModuleStatePayload { moduleId, settings }`. MSW `game-ws.ts:157-163`은 `{ moduleId, data, ts }` 로 emit. 백엔드는 `event_mapping.go`에서 `module:`/`module.` prefix만 필터링하고 payload 구조를 직접 관장하지 않음 → 모듈별 emit 시 shape이 완전히 자유. `registerGameHandlers.updateModuleState(payload.moduleId, payload.settings)` 호출 시 MSW payload에선 `settings`가 undefined → `updateModuleState(..., undefined)` → spread 에러 or 빈 상태 노출.

### F-ws-7 — camelCase ↔ snake_case serialization drift (`playerId` vs `player_id`)
Severity: **P1** (재접속 snapshot state hydration 시 subtle null·undefined)

Backend `ws/message.go:84-86` `ConnectedPayload { PlayerID uuid.UUID json:"playerId" }` → camelCase tag. 하지만 `session/snapshot_redaction_test.go:47`에서 확인된 snapshot payload에는 `session_id`·`created_at` (sqlc default snake_case) 형태가 섞여있는 것으로 보임. 프론트 `GameState` (@mmp/shared) type은 `sessionId`·`createdAt` camelCase 기대 (`gameSessionStore.ts:74-84`). BuildStateFor가 내부적으로 json.Marshal 시 field tag 일관성 필요.
[cross:06] perf: struct tag 일괄 scan 필요 (server JSON tag generator).

### F-ws-8 — 재접속 스냅샷은 `session:state` 단일 envelope, 프론트 `hydrateFromSnapshot` 미연결
Severity: **P1** (현재는 `setGameState`가 대체하지만 재접속 의미론 drift)

`apps/server/internal/session/snapshot.go:17` `TypeSessionState = "session:state"` (콜론 1개). 프론트 `WsEventType.SESSION_STATE = "session:state"` 일치. 리듀서는 `setGameState`를 호출 — **하지만 `gameSessionStore.ts:136-149`에 `hydrateFromSnapshot` 이 별도 정의되어 있으나 아무도 호출하지 않음**. 초기 connect와 reconnect가 동일 경로(`setGameState`)로 처리되어 구분 불가 → 재접속 전용 UX(복귀 애니메이션·놓친 이벤트 리스트) 구현 여지가 차단됨.

### F-ws-9 — optimistic update rollback이 editor HTTP mutation에만 존재, WS optimistic은 0건
Severity: **P1** (WS action 기반 낙관적 업데이트 설계 원칙과 실제 구현 괴리)

낙관적 update + rollback은 `useClueGraphData.ts:119-148`만 구현 (HTTP mutation, CYCLE_DETECTED 400 처리). WS 경로(`chat:send`·`vote:cast`·`clue:use`·`ready:toggle` 등 envelope_catalog에 등록된 client→server action) 은 **낙관적 업데이트 없음**. 서버 확인 이벤트 도착 전까지 UI가 로딩 스피너를 띄우는 형태 — Phase 18.4 M-2 후속으로 제시된 "낙관적 업데이트 + WS ack" 설계가 아직 착수 전. rollback 핸들러·timeout 처리 모두 부재.
[cross:02] react-frontend: Zustand mutation action에 `pending` / `error` state slice 도입 필요.

### F-ws-10 — WsClient: error envelope 수신 시 rollback/unwind 경로 없음
Severity: **P1** (서버가 `error` envelope (4000/4001/4002)로 거부해도 프론트는 조용히 무시)

`packages/ws-client/src/client.ts:211-228` — PONG/AUTH_OK/AUTH_FAIL만 특별 처리하고 `ErrorPayload`(`ws/message.go:62-65`)는 일반 dispatch로 흐름. 그러나 `registerGameHandlers`에 `WsEventType.ERROR` 구독 없음. `upgrade.go:130`의 `connected` envelope도 마찬가지 — enum 상수 없음. 서버가 `NewErrorEnvelope(ErrCodeUnauthorized, ...)` 로 거부해도 UI는 pending 상태 영구 지속.

### F-ws-11 — Seq 번호 / out-of-order 감지 없음 (순서 보장 0)
Severity: **P1** (phase/turn 순서가 역전되면 상태 플리커)

백엔드 `ws/message.go:14-19` envelope에 `Seq uint64`·`TS int64` 필드 존재. `ws/upgrade.go:130` `ConnectedPayload { Seq: uint64 }`로 "last known seq for reconnection" 주석. 그러나 프론트 `WsClient.handleMessage` (client.ts:193-229)는 `message.seq`를 emit handler에 전달만 하고 **순서 검증 없이** 리듀서로 전달. `gameMessageHandlers`도 seq 무시. Phase transition 같이 순서가 의미 있는 이벤트가 out-of-order 도착(특히 reconnect 후 snapshot + 누적 이벤트)하면 상태 역전.
[cross:06] perf: WS buffer `ws/buffer.go`가 순서를 보장하는지 cross-check (별도 audit).

### F-ws-12 — MSW WS mock 커버리지 ~4/60+ 이벤트, stubbed E2E가 real-backend drift 놓침
Severity: **P1** (현 E2E skip 36건 원인 중 상당수가 이 한정된 mock surface)

`mocks/handlers/game-ws.ts`만 WS intercept, 4 이벤트(`GAME_START`·`SESSION_STATE`·`MODULE_STATE`·`CHAT_WHISPER`) emit. 백엔드는 60+ 이벤트(envelope_catalog 78개 inbound + event_mapping relay prefix 9개 × 모듈별 emit 수십 개)를 다루는데 mock은 1/15 수준. Phase 18.8 plan의 "stubbed → real-backend 점진 승격"이 이 mock 확장 없이는 불가능. 회귀 가드로 **3자 일치 매트릭스 CI check** 필요.
[cross:04] test-engineer: MSW handler 테이블 기반 coverage metric 도입.

## WS Contract Drift 표 (주요 이벤트만, 전수는 별첨 예정)

| Event (wire string) | Backend emit | MSW mock | Reducer 구독 | 3자 일치 |
|---|---|---|---|---|
| `ping` / `pong` | ✓ (internal) | — | ✓ (WsClient internal) | △ (mock skip OK) |
| `auth` / `auth:ok` / `auth:fail` | ✗ (`ws/upgrade.go` 사용하지 않음, enum only) | ✗ | △ (WsClient internal) | **✗** |
| `error` | ✓ (`NewErrorEnvelope`) | ✗ | ✗ (enum 미구독) | **✗** |
| `connected` | ✓ (`upgrade.go:130`) | ✗ | ✗ (enum 없음) | **✗** |
| `session:state` | ✓ (snapshot) | ✓ | ✓ (`setGameState`) | ✓ (단 F-ws-7 tag drift) |
| `session:player:joined` | ✗ (backend는 `player.joined` emit) | ✗ | ✓ | **✗** |
| `session:player:left` | ✗ | ✗ | ✓ | **✗** |
| `game:start` | ✗ (test only) | ✓ | ✗ | **✗** |
| `game:end` | ✗ | ✗ | ✓ | **✗** |
| `game:phase:change` | ✗ (backend emits `phase:entered`) | ✗ | ✓ | **✗** |
| `phase:entered` / `phase:exiting` | ✓ | ✗ | ✗ | **✗** |
| `phase.changed` (test emit) | ✓ (test) | ✗ | ✗ | **✗** |
| `chat:message` (social) | ✓ | ✗ | ✗ (registerGameHandlers 미포함) | **✗** |
| `chat:whisper` | ? (envelope_catalog inbound만, emit 미확인) | ✓ | ✗ | **✗** |
| `friend:request` / `friend:accepted` | ✓ | ✗ | ✗ | **✗** |
| `module:state` | ✓ (prefix relay) | ✓ (`data` field) | ✓ (`settings` field) | **✗** (F-ws-6) |
| `module:event` | ✓ | ✗ | ✓ | △ |
| `clue.acquired` / `clue.transferred` / `clue.peek_result` / `clue.item_*` | ✓ (6+ 이벤트) | ✗ | ✗ | **✗** |
| `clue.trade_proposed/accepted/declined/show_*` | ✓ (6 이벤트) | ✗ | ✗ | **✗** |
| `clue.timed_distributed` / `clue.conditional_unlocked` / `clue.starting_distributed` / `clue.round_distributed` | ✓ | ✗ | ✗ | **✗** |
| `vote.cast` / `vote.changed` / `vote.opened` / `vote.result` | ✓ | ✗ | ✗ | **✗** |
| `ready.status_changed` / `ready.all_ready` | ✓ | ✗ | ✗ | **✗** |
| `reading.started/line_changed/paused/resumed/completed` | ✓ (dot) | ✗ | △ (enum `reading:` colon 정의, 구독 0건) | **✗** |
| `ending.reveal_step` / `ending.completed` | ✓ | ✗ | ✗ | **✗** |
| `player.joined` / `player.reconnected` | ✓ | ✗ | ✗ | **✗** |
| `sound:play` | ✓ (inbound+outbound) | ✗ | ✗ | **✗** |
| `audio:set_bgm` / `audio:play_voice` / `audio:play_media` / `audio:stop` | ? (enum 정의, backend emit 미확인) | ✗ | ✗ | **✗** |
| `voice:token` / `voice:state` | ✓ (voice_bridge) | ✗ | ✗ | **✗** |

**차집합 집계 (대표 30 이벤트 기준)**:
- 3자 완전 일치: **1** (`session:state`, tag drift 우려)
- 2자 일치(백엔드+리듀서, mock 누락): **3** 근처
- 1자만 존재 (drift): **26+**
- **3자 일치율 < 4%**.

## Rollback Gaps

- [F-ws-9] `chat:send`·`vote:cast`·`clue:use`·`ready:toggle`·`accusation:accuse`·`skip:request`·`whisper:send` — envelope_catalog inbound registered, 낙관적 업데이트 구현 **0건**. 현 UX: 서버 event 도착 전까지 pending spinner → 서버 미응답 시 영구 pending (timeout 처리 없음).
- [F-ws-10] `error` envelope dispatch → rollback hook 없음. `registerGameHandlers`에 `WsEventType.ERROR` 구독 추가 + per-action inflight map + rollback 필요.
- `useClueGraphData.ts:130-143` — HTTP mutation rollback는 모범 사례지만 WS 경로로 이식 필요.

## Resume Gaps

- [F-ws-8] `hydrateFromSnapshot` 작성되어 있으나 호출처 0 → dead code. Reconnect 경로(`TypeSessionState` 도착)가 초기 connect와 동일하게 `setGameState`로 흐름. 재접속 특별 UX 차단.
- [F-ws-7] Snapshot payload serialization tag 일관성: `BuildStateFor` 출력이 `apps/server/internal/engine/state.go` struct tag에 의존. `sessionId`/`createdAt` camelCase가 **모든 필드**에서 일관된지 확인 필요. 일부 sqlc row가 직접 포함되면 snake_case 혼입 위험.
- [F-ws-11] Reconnect 후 snapshot + buffered events 순서 — seq 기반 ordering 검증 미구현. Phase transition 역전 리스크.
- Redaction cross-check [cross:05]: security-reviewer가 snapshot_redaction_test의 테스트 커버리지가 실제 모든 모듈(whisper, hidden_mission, clue secret)을 검증하는지 확인 필요. `BuildStateFor`가 누락하면 PII leak.

## Metrics

- Backend inbound (envelope_catalog.go): **78개** client→server types
- Backend outbound (production emit): **~35개** server→client distinct event types (dot + colon mix)
- Frontend WsEventType enum: **26개**
- Frontend reducer 구독 (registerGameHandlers): **7개**
- MSW WS mock emit: **4개** (game-ws.ts only)
- 3자 완전 일치 추정: **≤ 2개** (`session:state`, `module:state` partial)
- 네이밍 컨벤션 혼재: `event.type` (dot, module emit) vs `event:type` (colon, enum+inbound) — 표준 0
- P0 Findings: **2** (F-ws-1, F-ws-2)
- P1 Findings: **10** (F-ws-3 ~ F-ws-12)
- P0+P1 비율: **100%** (전체 12건 모두 P0 or P1 — gate ≥50% 통과)

## Cross-refs

- [cross:01] go-backend: WS event naming 표준(`:` vs `.`) 합의, struct tag generator, event registry SSOT
- [cross:02] react-frontend: Zustand WS action pending/error slice, reading/vote/clue store 부재
- [cross:03] module-architect: game lifecycle(`game.started`/`game.ended`) production emitter 부재
- [cross:04] test-engineer: MSW WS handler coverage CI gate, E2E skip 36 목록과 drift 매핑
- [cross:05] security: snapshot `BuildStateFor` redaction 모듈별 unit test 커버리지
- [cross:06] perf: seq 기반 out-of-order 감지, ws/buffer.go 순서 보장 재확인

## Advisor-Ask (≤3)

1. **SSOT 이전 방향**: WsEventType enum(프론트)이 실제 production을 반영하도록 backend emission 기준 재작성 vs backend emission을 enum으로 일치 — 어느 쪽을 source of truth로 삼을지. Phase 20 WS contract SSOT PR 필요 여부.
2. **낙관적 업데이트 설계**: Zustand에 per-action `pending`/`confirmed`/`failed` slice 도입 규모가 큰데, F-ws-9·10을 P0로 승격하여 단일 PR로 일괄 처리할지, F-ws-9만 P1 유지하고 high-traffic action(vote, clue:use)부터 단계적 적용할지.
3. **Event naming 마이그레이션**: `phase.changed` ↔ `phase:entered` ↔ `game:phase:change` 3종 drift를 단일 규약(`module.action` 점 표기 권장 — engine.Event Type 표준과 일치)으로 통일 시 모든 relayPrefix/enum/MSW mock/reducer 동시 수정 — deprecation period를 둘지 big-bang할지.
