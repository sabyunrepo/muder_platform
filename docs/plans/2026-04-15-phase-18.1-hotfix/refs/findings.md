# Phase 18.1 — Reviewer findings (3 parallel: security + code + architect)

## Ship-Blockers

### B-1. `startModularGame` 경로가 main.go 에 미와이어링
- **소스**: code-reviewer HIGH-1, architect 상#1/#4
- **파일**: `apps/server/cmd/server/main.go:139`
- **현상**: `room.NewService(pool, queries, logger)` 만 호출. `NewServiceWithStarter`, `SessionManager`, `Hub.SetSessionSender`, `RegisterLifecycleListener`, `Broadcaster` 어댑터 전혀 호출되지 않음.
- **영향**: Phase 18.0 전체 런타임이 dead code. flag 켜도 동작 안 함. `StartRoom` → `gameStarter==nil` 분기 → `{"status":"started"}` 거짓 성공.
- **Fix (Phase 18.1 PR-0 Task 1)**:
  ```go
  sessionMgr := session.NewSessionManager(logger)
  sessionMgr.InjectSnapshot(redisCache, wsHub)
  wsHub.SetSessionSender(session.NewHubAdapter(sessionMgr))
  wsHub.RegisterLifecycleListener(sessionMgr)
  starter := session.NewGameStarter(sessionMgr, wsHub, cfg.GameRuntimeV2)
  roomSvc := room.NewServiceWithStarter(pool, queries, logger, starter)
  ```

### B-2. Snapshot 블롭 전체를 재접속자에게 전송 (역할 유출)
- **소스**: security HIGH-3
- **파일**: `apps/server/internal/session/snapshot.go:95-125`, `snapshot_serialize.go:46-102`
- **현상**: `SendSnapshot` 이 Redis 블롭 그대로 `ws.NewEnvelope(TypeSessionState, raw)` 전송. `ModuleStates` 에 역할/귓속말/단서 private 정보 포함.
- **영향**: 머더미스터리 역할 1건 유출 = 게임 void.
- **Fix (PR-1)**: `Module.BuildStateFor(playerID)` 인터페이스 도입. 기본 구현은 `BuildState` 위임, 민감 모듈만 override. `PhaseEngine.BuildStateFor`. `Session.SendSnapshot` 이 Redis 블롭 대신 현시점 엔진에서 재구성 (캐시 불필요 시 단순화).

### B-3. `configJson` 무제한/무검증 — DoS + 모듈 주입
- **소스**: security HIGH-1
- **파일**: `apps/server/internal/domain/room/handler.go:129-133`, `engine/factory.go:26-70`
- **현상**: `httputil.ReadJSON` 실패를 `req = StartRoomRequest{}` 로 silent swallow. `ParseGameConfig` 는 `DisallowUnknownFields` 없음, 모듈 수/depth 한도 없음, allowlist 없음.
- **Fix (PR-2)**:
  - Handler: `http.MaxBytesReader(w, r.Body, 256*1024)` + 파싱 실패 시 명시 400
  - Parser: `json.NewDecoder(r).DisallowUnknownFields()`, `maxModulesPerGame = 50`
  - Registry: module tag 기반 allowlist(host 제출 vs admin) — 현재 admin 모듈 없음이라 hook 만 도입

### B-4. 프론트 이중 store + `syncServerTime` 누락
- **소스**: code-reviewer HIGH-2, architect 상#2
- **파일**: `apps/web/src/stores/gameStore.ts` vs `gameSessionStore.ts` (25 파일 혼용)
- **현상**: 동일 도메인 상태 이중 보유. `gameSessionStore.setGameState` 가 `syncServerTime(state.createdAt)` 호출 누락.
- **Fix (PR-3)**: `gameSessionStore` 로 통합, `gameStore` 삭제 + 호출자 전수 치환, `syncServerTime` 이관.

---

## High

### H-1. `Session.runCtx` race
- **소스**: 3 reviewer 공통
- **파일**: `apps/server/internal/session/session.go:91,99-104,135`
- **현상**: `runCtx = ctx` 를 `Run()` 안에서 동기화 없이 쓰고, `OnPlayerLeft/Rejoined` 가 외부 goroutine 에서 `Ctx()` 읽음 → `-race` 검출 예정.
- **Fix (PR-0 Task 3)**: `atomic.Pointer[context.Context]` 또는 `newSession(ctx, ...)` 진입 시점 주입.

### H-2. `startModularGame` 에 `injectSnapshot` 누락
- **소스**: architect 상#1
- **파일**: `apps/server/internal/session/starter.go:~93`
- **현상**: `manager.Start` 에만 snapshot 주입 로직 있음. `startModularGame` 경로는 스냅샷이 no-op.
- **Fix (PR-0 Task 2)**: `sm.injectSnapshot(cache, sender)` 호출 추가 또는 manager.Start 내부로 이동.

### H-3. EnvelopeRegistry 에 legacy 메시지 타입 등록 여부 미확인
- **소스**: architect 상#3
- **파일**: 부트스트랩 (신설)
- **현상**: `Hub.Route` 가 unknown 타입을 4000 으로 drop. 기존 `game:*` / `chat:*` 등 미등록 시 기존 플레이어 drop.
- **Fix (PR-0 Task 4)**: 부트스트랩에서 legacy+신규 타입 전수 `Register`. 누락 감지 카탈로그 테스트 (타입 목록 vs 핸들러 맵 diff).

### H-4. Broadcaster 어댑터 wiring 불명
- **소스**: architect 상#4
- **파일**: main.go (B-1 와 동일 원인)
- **현상**: `session.Broadcaster` 인터페이스는 정의됐으나 실제 `ws.Hub` 를 감싸는 어댑터 주입 지점 없음 → `phase:*` 이벤트가 클라이언트에 전달되지 않음.
- **Fix (PR-0 Task 1 에 포함)**: B-1 과 함께 Broadcaster 어댑터 구현 + 주입.

---

## Medium 이월 (Phase 18.2 대상)

M-1~M-10 전부 `findings.md` 에 기록하지 않고 Phase 18.2 plan 착수 시 이 문서 참조.

- M-1 Hub.Route ctx → bounded
- M-2 startModularGame TOCTOU (메시지 조기 도착)
- M-3 EventMapping relay 이벤트 확장
- M-4 snapshot interval/debounce 정합성
- M-5 snapshot PII + 종료 시 delete
- M-6 envelope.Type 길이 상한
- M-7 SendSnapshot N명 Redis GET 최적화
- M-8 barrel 파일 conflict 분리
- M-9 flag-off 503 응답 (PR-0 Task 5 에서 조기 반영)
- M-10 ReadJSON silent swallow (B-3 에 포함)

---

## Low 이월 (Phase 18.3)

L-1~L-8 (EnvelopeRegistry duplicate panic, persistSnapshot ctx parent, recentLeftAt GC, snapshotKey namespace, Hub.Stop 경합, panic interface dump, 모듈 에러 노출, E2E auto-skip 보강).
