<!-- STATUS-START -->
**Active**: Phase 18.1 hotfix — Wave 0/2
**PR**: PR-0 (100%)
**Task**: Tasks 1-7 완료
**State**: in_review
**Blockers**: none
**Last updated**: 2026-04-15
<!-- STATUS-END -->

# Phase 18.1 게임 런타임 Hotfix 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 0 — 기반 wiring (sequential)

### PR-0: main.go wiring + runCtx atomic + registry catalog + injectSnapshot
- [x] Task 1 — `SessionManager`, `Hub.SetSessionSender(ws→session adapter)`, `Hub.RegisterLifecycleListener(manager)`, `Broadcaster` 어댑터 생성 후 `main.go` 조립
- [x] Task 2 — `startModularGame` 에 `injectSnapshot(cache, sender)` 호출 추가 (H-2)
- [x] Task 3 — `Session.runCtx` 를 `atomic.Pointer[context.Context]` 로 변환 + `Ctx()` 무lock 안전화 (H-1)
- [x] Task 4 — `EnvelopeRegistry` 부트스트랩: legacy+신규 타입 전수 `Register`, 누락 감지 카탈로그 테스트 (H-3)
- [x] Task 5 — `room.StartRoom` flag-off 시 `503 game runtime not enabled` 반환 + 거짓 success 제거 (M-9 조기 반영)
- [x] Task 6 — `go test -race ./internal/session/... ./internal/ws/... ./internal/domain/room/... ./cmd/server/...` ✅ all pass
- [x] Task 7 — `go build ./...` ✅ + smoke binary built
- [ ] Run after_task pipeline

**Wave 0 gate**:
- [x] 모든 Task pass
- [ ] `go test -race -count=1 ./...` pass
- [ ] PR merged to main
- [ ] User confirmed next wave

---

## Wave 1 — 병렬 hotfix (parallel ×3)

### PR-1: Snapshot per-player redaction (B-2)
- [ ] Task 1 — `engine.Module` 인터페이스에 `BuildStateFor(playerID uuid.UUID) (json.RawMessage, error)` 추가, `BaseModule` 에 기본 구현(= `BuildState` 위임)
- [ ] Task 2 — 역할 민감 모듈(Role/Clue/Whisper/HiddenMission/Voting 등) 에 redaction override
- [ ] Task 3 — `PhaseEngine.BuildStateFor(playerID)` 신설 + `Session.SendSnapshot` 이 해당 경로 사용
- [ ] Task 4 — 단위 테스트: 역할 플레이어 A 스냅샷 ≠ 일반 플레이어 B 스냅샷 (deep-diff)
- [ ] Task 5 — 재접속 E2E 에서 payload inspect 로 redaction 확인

### PR-2: configJson trust boundary (B-3)
- [ ] Task 1 — `room.handler.StartRoom`: `http.MaxBytesReader(256KB)` + `ReadJSON` 실패 시 명시 400
- [ ] Task 2 — `engine.ParseGameConfig`: `json.Decoder + DisallowUnknownFields` + 최대 modules 수 제한 (e.g., 50)
- [ ] Task 3 — `BuildModules`: admin-only 모듈 allowlist 개념 (레지스트리 레벨 tag) — 현재 admin 모듈 없으면 아키텍처 hook 만 마련
- [ ] Task 4 — 단위 테스트: oversized body 거부, unknown field 거부, too-many modules 거부
- [ ] Task 5 — 기존 정상 flow 회귀 테스트

### PR-3: Frontend store consolidation (B-4)
- [ ] Task 1 — `gameSessionStore` 에 `hydrateFromSnapshot` 이관 + `syncServerTime(createdAt)` 호출 추가
- [ ] Task 2 — 25 호출자 전수 grep → `gameStore` import 를 `gameSessionStore` 로 치환
- [ ] Task 3 — `gameStore.ts` 삭제 (또는 deprecated re-export 로 점진 이관) — 결정: **삭제 후 일괄 치환**
- [ ] Task 4 — `gameSelectors.ts` 와 기존 selector 정리 (중복 export 제거)
- [ ] Task 5 — Vitest 전체 suite 회귀 없음 확인

**Wave 1 gate**:
- [ ] 3 PR 모두 pass
- [ ] `go test -race` + `pnpm test` + `tsc --noEmit` pass
- [ ] User confirmed next wave

---

## Wave 2 — 실제 기동 검증 (sequential)

### PR-4: Real-backend E2E smoke + flag 매트릭스
- [ ] Task 1 — `PLAYWRIGHT_BACKEND=1` 로 localhost(백엔드+Redis+Postgres) 기동 후 `game-session.spec.ts` 실제 실행 통과
- [ ] Task 2 — flag off/on 각각의 `StartRoom` 응답 테스트 (503 vs actor start)
- [ ] Task 3 — 재접속 E2E 에서 redaction payload 확인 (PR-1 통합)
- [ ] Task 4 — CI 에 optional job `phase-18.1-real-backend` 추가 (docker compose 기반, nightly)

**Wave 2 gate**:
- [ ] E2E 실행 증적
- [ ] User confirmed phase complete

---

## Phase completion gate

- [ ] Ship-blocker 4건 + High 4건 전부 처리
- [ ] Go race/test + 프론트 test/tsc pass
- [ ] Real-backend E2E 1회 pass
- [ ] Medium 10건은 Phase 18.2 로 이월 문서화
- [ ] `/plan-finish` 실행
