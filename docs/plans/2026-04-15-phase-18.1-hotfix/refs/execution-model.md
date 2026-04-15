# Phase 18.1 — Execution Model

## Wave DAG

```
W0: PR-0 (main.go wiring + runCtx atomic + registry + injectSnapshot) ← sequential
 ↓
W1: PR-1 (snapshot redaction) ║ PR-2 (configJson guards) ║ PR-3 (store consolidation)
 ↓
W2: PR-4 (real-backend E2E)   ← sequential
```

## 파일 스코프

### PR-0 — backend
```
apps/server/cmd/server/main.go                      (수정 — 조립)
apps/server/internal/session/session.go             (수정 — runCtx atomic)
apps/server/internal/session/starter.go             (수정 — injectSnapshot)
apps/server/internal/ws/session_adapter.go          (신규 — SessionSender 구현)
apps/server/internal/ws/broadcaster_adapter.go      (신규 — session.Broadcaster 구현)
apps/server/internal/ws/envelope_catalog.go         (신규 — 전수 등록)
apps/server/internal/ws/envelope_catalog_test.go    (신규 — diff 테스트)
apps/server/internal/domain/room/service.go         (수정 — flag-off 503)
apps/server/internal/domain/room/handler.go         (수정 — 응답)
apps/server/internal/config/config.go               (수정 — GameRuntimeV2)
```

### PR-1 — backend
```
apps/server/internal/engine/types.go                (수정 — Module.BuildStateFor)
apps/server/internal/engine/base_module.go          (수정 — 기본 구현)
apps/server/internal/engine/phase_engine.go         (수정 — BuildStateFor)
apps/server/internal/module/decision/hidden_mission.go    (override)
apps/server/internal/module/decision/voting.go            (override)
apps/server/internal/module/communication/whisper.go      (override)
apps/server/internal/module/cluedist/*.go                 (override)
apps/server/internal/session/snapshot.go            (수정 — SendSnapshot)
apps/server/internal/session/snapshot_serialize.go  (수정 — buildModuleStates)
apps/server/internal/session/snapshot_test.go       (수정 + 신규 redaction test)
```

### PR-2 — backend
```
apps/server/internal/domain/room/handler.go         (수정 — MaxBytesReader, 400)
apps/server/internal/engine/factory.go              (수정 — DisallowUnknownFields, 제한)
apps/server/internal/engine/factory_test.go         (수정 — 신규 테스트)
```

### PR-3 — frontend
```
apps/web/src/stores/gameSessionStore.ts             (수정 — hydrateFromSnapshot, syncServerTime)
apps/web/src/stores/gameStore.ts                    (삭제)
apps/web/src/stores/gameSelectors.ts                (정리)
apps/web/src/stores/__tests__/gameStore*.test.ts    (삭제/이전)
apps/web/src/** (25 파일)                           (import 치환)
```

### PR-4 — fullstack / test
```
apps/web/e2e/game-session-live.spec.ts              (신규 — real-backend)
.github/workflows/phase-18.1-real-backend.yml       (신규, nightly)
docs/plans/2026-04-15-phase-18.1-hotfix/refs/e2e-results.md  (증적)
```

## 충돌 분석

| Pair | 겹침 | 안전 |
|------|------|------|
| PR-0 vs PR-1 | session.go 수정 교차 | **조심** — PR-0 이 session.go 의 runCtx 필드 추가. PR-1 은 snapshot 경로만. base 가 PR-0 완료 상태이므로 순차 OK |
| PR-1 vs PR-2 | engine/factory.go vs engine/types.go | 다른 파일 ✅ |
| PR-1 vs PR-3 | 없음 (backend vs frontend) | ✅ |
| PR-2 vs PR-3 | 없음 | ✅ |

## 모델 오버라이드

| PR | Model | 이유 |
|----|-------|------|
| PR-0 | opus | 조립/인터페이스 정합 — 실수 시 전파 넓음 |
| PR-1 | opus | 인터페이스 추가 + 모듈 redaction 판단 |
| PR-2 | sonnet | 한정된 가드 추가 |
| PR-3 | sonnet | 기계적 import 치환 중심 |
| PR-4 | sonnet | 테스트 작성 + CI job |
