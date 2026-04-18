---
name: Phase 18.1 게임 런타임 Hotfix 완료
description: Phase 18.0 코드리뷰 ship-blocker 4건 + high 4건 해결 — main wiring, snapshot redaction, configJson 경계, 프론트 store 통합, 실백엔드 E2E (2026-04-15)
type: project
originSessionId: cd68ad41-eafc-4fad-ba2f-64ea3cbb8f63
---
## 개요

- **기간**: 2026-04-15 단일 세션 (Phase 18.0 archive 직후)
- **PR 수**: 5 (#35~#39)
- **Wave**: W0(seq) → W1(parallel×3) → W2(seq)
- **최종 커밋**: 407e3d0
- **배경**: Phase 18.0 code review (security/code/architect 3 병렬) 에서 release 블로커 식별

## Wave별 결과

| Wave | PR | 내용 | GH PR | Finding |
|------|-----|------|-------|---------|
| W0 | PR-0 | main.go 조립 + runCtx atomic + envelope catalog + injectSnapshot + flag-off 503 | #35 | B-1/H-1/H-2/H-3/H-4/M-9 |
| W1 | PR-1 | Snapshot per-player redaction (`PlayerAwareModule`, 8 모듈 override, actor 경유) | #38 | B-2 |
| W1 | PR-2 | configJson trust boundary (256KB cap, DisallowUnknownFields, 50-module limit, HostSubmittable hook) | #36 | B-3 |
| W1 | PR-3 | Frontend store 통합 (`gameStore` 제거, `gameSessionStore` 단일화, `syncServerTime` 보정) | #37 | B-4 |
| W2 | PR-4 | flag matrix tests + real-backend E2E smoke (skip guard) + nightly CI job + redaction regression | #39 | 검증 |

## 해결된 Ship-Blockers/High

### Ship-Blockers (4)
- **B-1 / H-4**: main.go 에 SessionManager/Hub/Broadcaster/SessionSender/GameStarter 조립 — Phase 18.0 런타임이 비로소 실동작
- **B-2**: `Module.BuildStateFor(playerID)` 신규 인터페이스 — 역할 민감 모듈 (hidden_mission, voting, whisper, 5개 cluedist) redaction override
- **B-3**: StartRoom `MaxBytesReader(256KB)` + `DisallowUnknownFields` + `maxModulesPerGame=50` + `HostSubmittable` blocklist hook
- **B-4**: `gameStore.ts` 삭제, `gameSessionStore` 로 단일화, `syncServerTime(createdAt)` 누락 수정

### High (4)
- **H-1**: `Session.runCtx` → `atomic.Pointer[context.Context]` (race-free Ctx())
- **H-2**: `startModularGame` 에서 `injectSnapshot(cache, sender)` 호출 추가
- **H-3**: `ws.BootstrapRegistry(registry)` — legacy+신규 envelope 타입 전수 등록 + 카탈로그 diff 테스트
- **H-4**: Broadcaster 어댑터 (`cmd/server/adapters.go`) + `Hub.SetSessionSender` 주입

### 추가 (M-9)
- Flag-off `StartRoom` → 503 `ErrServiceUnavailable` (거짓 success 제거)

## 머지 과정 이슈 & 해결

- **PR-1 ↔ PR-2 factory.go 충돌**: PR-2 가 `BuildModules` 시그니처를 `(cfg)→([]Module, error)` 로 단순화, PR-1/기존은 `(ctx, cfg, deps)→([]Module, map, error)`. 해결: 기존 시그니처 유지 + PR-2 의 보안 가드(DisallowUnknownFields, maxModulesPerGame, HostSubmittable)만 이식.
- **service.go / handler.go duplicate StartRoom**: 병렬 PR 이 같은 메서드를 별도 구현. 해결: PR-1 기반(trust boundary 포함) 채택.
- **factory_test.go 후속 수정**: PR-2 테스트가 단순 시그니처 기준 → 시그니처 복원 후 fixture 에 phases 필드 추가하고 `(ctx, cfg, ModuleDeps{})` 호출 형태로 업데이트.

## 후속 이월

- **Phase 18.2 cleanup (Medium 10건)**: EventMapping relay 확장, snapshot TTL/debounce 정합성, Hub.Route ctx bounded, startModularGame TOCTOU, barrel 파일 conflict 패턴, envelope.Type 길이 상한, snapshot PII + 종료 시 delete, SendSnapshot 동시 재접속 Redis 최적화 등
- **Phase 18.3 polish (Low 8건)**: EnvelopeRegistry duplicate panic, persistSnapshot ctx parent, recentLeftAt GC, snapshotKey namespace, Hub.Stop 경합, panic dump, 모듈 에러 노출, E2E auto-skip 보강

## 운영 메모

- **Executor 컷오프 패턴 재현**: PR-0 / PR-6 이전과 동일하게 중간에 응답이 끊기는 현상 관측. 해결책: 프롬프트에 "각 task 즉시 atomic commit" 명시, 그래도 끊기면 SendMessage 로 재개 또는 직접 인수. 반복 개선 필요.
- **Worktree 후 cwd 이탈**: agent 완료 후 main 저장소의 cwd branch 가 worktree branch 로 바뀌는 현상 다시 관측. `git checkout main` 명시 필수.
- **CI 인프라 부채**: `config.TestLoad_Defaults` 가 env 누수로 실패하는 선행 이슈 상존. Phase 18.2 에 포함 권장.

## 검증 증적

- Backend: `go test -race -count=1 ./...` → `config` 제외 27/28 packages pass (config 실패는 pre-existing env leak)
- Frontend: `pnpm exec tsc --noEmit` → 0 error
- E2E: `game-session-live.spec.ts` skip guard 정상 동작 (nightly workflow 에서 실행)
- redaction regression: 2-player 스냅샷 diff 테스트 통과
