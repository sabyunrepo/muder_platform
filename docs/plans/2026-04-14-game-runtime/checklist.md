<!-- STATUS-START -->
**Active**: Phase 18.0 게임 런타임 — 전체 완료 ✅
**PR**: W0~W5 전 10개 PR merged (PR-0,1,2,3,4,5,6-v2,7,8,9)
**Task**: 50/50 tasks done + 후속 개선 2건 반영
**State**: archived
**Blockers**: none
**Last updated**: 2026-04-15
**Final commit**: c4d4620
<!-- STATUS-END -->

# Phase 18.0 게임 런타임 통합 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 0 — Phase 17.5 Cleanup (sequential)

### PR-0: Phase 17.5 followup
- [x] Task 1 — `ClueRelationRequest/Response` → `editor/types.go` 분리
- [x] Task 2 — `useClueGraphData` onConnect debounce를 `autoSave` 로 일원화
- [x] Task 3 — `useDeleteClue` 성공 시 `clueRelationKeys` 크로스 invalidation
- [x] Task 4 — `useClueGraphData` 단위 테스트 (debounce coalescing, optimistic revert)
- [x] Task 5 — 서비스 통합 테스트 (testcontainers — FK cascade, TX rollback, cross-theme)
- [x] Task 6 — `validateClueGraph` Kahn queue → index pointer (O(n))
- [x] Task 7 — E2E `clue-relation.spec.ts` 기본 2건 MSW mock 으로 무조건 실행 가능화
- [x] Run after_task pipeline

**Wave 0 gate**:
- [x] `go test -race ./internal/domain/editor/...` pass
- [x] `pnpm test` (editor/clue-relation 범위) pass
- [x] PR merged to main
- [x] User confirmed next wave

---

## Wave 1 — 백엔드 Wiring (parallel)

### PR-1: WS→Session inbox 라우팅
- [x] Task 1 — Hub.Route 에서 세션 메시지 → Session.Inbox 전달
- [x] Task 2 — 메시지 envelope 타입 레지스트리 정의
- [x] Task 3 — Go 테스트 (라우팅 + unknown 타입 거부)

### PR-2: startModularGame + 모듈 팩토리
- [x] Task 1 — startModularGame(room, config) 구현
- [x] Task 2 — configJson.modules → Factory.Create → engine 등록
- [x] Task 3 — EventMapping 자동 구독 (module event→WS broadcast)
- [x] Task 4 — Go 테스트 (초기화 + 페이즈 전환)

**Wave 1 gate**: `go test -race` + user confirm

---

## Wave 2 — 프론트 기초 (parallel)

### PR-3: 게임 Zustand store + WS 핸들러
- [x] Task 1 — gameSessionStore (phase, players, modules)
- [x] Task 2 — WS 메시지 핸들러 (phase:changed, module events)
- [x] Task 3 — useGameSession hook + 자동 재연결
- [x] Task 4 — Vitest 테스트

### PR-4: PhaseBar + 타이머 UI
- [x] Task 1 — PhaseBar 컴포넌트 (현재 페이즈 + 진행바)
- [x] Task 2 — PhaseTimer 컴포넌트 (카운트다운 + 경고)
- [x] Task 3 — GameLayout (PhaseBar + content area)
- [x] Task 4 — Vitest 테스트

**Wave 2 gate**: `pnpm test` + user confirm

---

## Wave 3 — 모듈 UI (parallel ×3)

### PR-5: 인게임 채팅
- [x] Task 1 — GameChatPanel (전체/귓속말)
- [x] Task 2 — WS 메시지 송수신 연동
- [x] Task 3 — Vitest 테스트

### PR-6: 투표 + 단서열람
- [x] Task 1 — VotePanel (투표 UI + 결과)
- [x] Task 2 — ClueViewPanel (단서 열람 + 공유)
- [x] Task 3 — Vitest 테스트

### PR-7: 리딩 + 엔딩
- [x] Task 1 — ReadingPanel (대사 순차 표시)
- [x] Task 2 — EndingPanel (결과 + 스코어)
- [x] Task 3 — Vitest 테스트

**Wave 3 gate**: `pnpm test` + user confirm

---

## Wave 4 — 스냅샷 (sequential)

### PR-8: 스냅샷 persist + 재접속 복원
- [x] Task 1 — Session.persistSnapshot → Redis 직렬화
- [x] Task 2 — 재접속 시 snapshot push (클라이언트별)
- [x] Task 3 — 프론트 snapshot 수신 → store hydration
- [x] Task 4 — Go + Vitest 테스트

**Wave 4 gate**: `go test` + `pnpm test` + user confirm

---

## Wave 5 — E2E (sequential)

### PR-9: E2E 통합 테스트
- [x] Task 1 — 방 생성→시작→페이즈 진행 E2E
- [x] Task 2 — 재접속 복원 E2E
- [x] Task 3 — Playwright 시각 점검

**Wave 5 gate**: E2E pass + user confirm

---

## Phase completion gate

- [x] Phase 17.5 followup 전부 처리 (W0)
- [x] 방→게임시작→페이즈순차→엔딩 전체 동작
- [x] 5개 모듈 UI 동작 (채팅/투표/단서/리딩/엔딩)
- [x] 재접속 스냅샷 복원
- [x] feature flag on/off
- [x] 전체 테스트 통과
- [x] `/plan-finish` 실행
