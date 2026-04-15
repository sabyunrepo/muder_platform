# Phase 18.1 — 게임 런타임 Hotfix 실행 계획 (index)

> 부모: [design.md](design.md)
> MD 200줄 제한.

---

## Overview

W0 에서 main.go wiring 과 보조 안전 장치(runCtx, envelope registry)를 한번에
잠그고, W1 에서 3종 병렬 (snapshot redaction / configJson 안전 / 프론트
store 통합) 을 처리한 뒤 W2 에서 실제 백엔드 기동 E2E 로 검증한다.

---

## Wave 구조

```
W0 (sequential):
  PR-0 — main.go wiring + injectSnapshot + registry catalog + runCtx atomic
          (H-1, H-2, H-3, H-4 + B-1)
  ↓
W1 (parallel ×3):
  PR-1 — Snapshot per-player redaction   (B-2, backend+engine)
  PR-2 — configJson trust boundary        (B-3, backend)
  PR-3 — Frontend store consolidation     (B-4, frontend)
  ↓
W2 (sequential):
  PR-4 — Real-backend E2E smoke + flag on/off 교차 테스트
```

---

## PR 목록

| PR | Wave | Title | 의존 | 도메인 |
|----|------|-------|------|--------|
| PR-0 | W0 | main.go wiring + runCtx atomic + registry catalog + injectSnapshot | - | backend |
| PR-1 | W1 | Snapshot per-player redaction (`Module.BuildStateFor`) | PR-0 | backend |
| PR-2 | W1 | configJson size cap + DisallowUnknownFields + module allowlist | PR-0 | backend |
| PR-3 | W1 | Frontend `gameStore` → `gameSessionStore` 통합 + syncServerTime | PR-0 | frontend |
| PR-4 | W2 | Real-backend E2E smoke + flag 매트릭스 테스트 | PR-1,2,3 | fullstack/test |

---

## Merge 전략

- 모두 main 직접 merge (hotfix)
- Wave 내 병렬은 `isolation: worktree`
- 각 머지 후 gate: `go test -race ./... ` + `pnpm test`
- Wave 종료 시 user 확인 1회
- PR-3 은 25개 파일 touch 예상 — 리뷰어 2명 이상 권장

---

## Feature flag

`game_runtime_v2` 유지 (default off). PR-0 wiring 이 flag-on 경로를 실동작
시키고, flag-off 는 `apperror.New(StatusServiceUnavailable, "game runtime
not enabled")` 로 명시 반환 (거짓 success 제거).

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| Registry 누락으로 기존 플레이어 WS drop | 부트스트랩 테스트에서 legacy+new 타입 전수 enumerate |
| `BuildStateFor` 인터페이스 변경이 모든 모듈 touch | 기본 구현(`BuildState`를 그대로 반환) 을 embed 용 struct 에 두고 필요한 모듈만 override |
| 프론트 store 통합 회귀 | 25 파일 grep → 전수 변환, Vitest smoke + 수동 확인 |
| E2E 실백엔드 기동이 CI 에서 flaky | 로컬 스모크 1회 + CI는 기존 skip 가드 유지, 별도 optional job 생성 |

---

## 후속

- **Phase 18.2 cleanup**: Medium 10건 (EventMapping relay 확장, snapshot TTL/debounce, Hub.Route ctx, TOCTOU, barrel 분리 등)
- **Phase 18.3 polish**: Low 8건

---

## 테스트 매트릭스 (Phase completion gate)

| 영역 | 도구 | 기대값 |
|------|------|--------|
| Go race | `go test -race -count=1 ./...` | 0 fail |
| 프론트 unit | `pnpm test` | 0 새 실패 |
| 타입 | `pnpm exec tsc --noEmit` | 0 error |
| E2E real | `PLAYWRIGHT_BACKEND=1 pnpm exec playwright test game-session.spec.ts` | 기동 + 페이즈 전환 |
| E2E skip | (백엔드 없음) | skip guard 동작 |
| flag off | `GAME_RUNTIME_V2=false` | 503 응답 |
| flag on | `GAME_RUNTIME_V2=true` | 세션 actor start |
