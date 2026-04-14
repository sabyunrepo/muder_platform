<!-- STATUS-START -->
**Active**: Phase 18.0 게임 런타임 — 대기
**PR**: -
**Task**: Phase 17.5 완료 후 시작
**State**: draft
**Blockers**: Phase 17.5
**Last updated**: 2026-04-14
<!-- STATUS-END -->

# Phase 18.0 게임 런타임 통합 체크리스트

> 부모: [design.md](design.md) | 실행: [plan.md](plan.md)

---

## Wave 1 — 백엔드 Wiring (parallel)

### PR-1: WS→Session inbox 라우팅
- [ ] Task 1 — Hub.Route 에서 세션 메시지 → Session.Inbox 전달
- [ ] Task 2 — 메시지 envelope 타입 레지스트리 정의
- [ ] Task 3 — Go 테스트 (라우팅 + unknown 타입 거부)

### PR-2: startModularGame + 모듈 팩토리
- [ ] Task 1 — startModularGame(room, config) 구현
- [ ] Task 2 — configJson.modules → Factory.Create → engine 등록
- [ ] Task 3 — EventMapping 자동 구독 (module event→WS broadcast)
- [ ] Task 4 — Go 테스트 (초기화 + 페이즈 전환)

**Wave 1 gate**: `go test -race` + user confirm

---

## Wave 2 — 프론트 기초 (parallel)

### PR-3: 게임 Zustand store + WS 핸들러
- [ ] Task 1 — gameSessionStore (phase, players, modules)
- [ ] Task 2 — WS 메시지 핸들러 (phase:changed, module events)
- [ ] Task 3 — useGameSession hook + 자동 재연결
- [ ] Task 4 — Vitest 테스트

### PR-4: PhaseBar + 타이머 UI
- [ ] Task 1 — PhaseBar 컴포넌트 (현재 페이즈 + 진행바)
- [ ] Task 2 — PhaseTimer 컴포넌트 (카운트다운 + 경고)
- [ ] Task 3 — GameLayout (PhaseBar + content area)
- [ ] Task 4 — Vitest 테스트

**Wave 2 gate**: `pnpm test` + user confirm

---

## Wave 3 — 모듈 UI (parallel ×3)

### PR-5: 인게임 채팅
- [ ] Task 1 — GameChatPanel (전체/귓속말)
- [ ] Task 2 — WS 메시지 송수신 연동
- [ ] Task 3 — Vitest 테스트

### PR-6: 투표 + 단서열람
- [ ] Task 1 — VotePanel (투표 UI + 결과)
- [ ] Task 2 — ClueViewPanel (단서 열람 + 공유)
- [ ] Task 3 — Vitest 테스트

### PR-7: 리딩 + 엔딩
- [ ] Task 1 — ReadingPanel (대사 순차 표시)
- [ ] Task 2 — EndingPanel (결과 + 스코어)
- [ ] Task 3 — Vitest 테스트

**Wave 3 gate**: `pnpm test` + user confirm

---

## Wave 4 — 스냅샷 (sequential)

### PR-8: 스냅샷 persist + 재접속 복원
- [ ] Task 1 — Session.persistSnapshot → Redis 직렬화
- [ ] Task 2 — 재접속 시 snapshot push (클라이언트별)
- [ ] Task 3 — 프론트 snapshot 수신 → store hydration
- [ ] Task 4 — Go + Vitest 테스트

**Wave 4 gate**: `go test` + `pnpm test` + user confirm

---

## Wave 5 — E2E (sequential)

### PR-9: E2E 통합 테스트
- [ ] Task 1 — 방 생성→시작→페이즈 진행 E2E
- [ ] Task 2 — 재접속 복원 E2E
- [ ] Task 3 — Playwright 시각 점검

**Wave 5 gate**: E2E pass + user confirm

---

## Phase completion gate

- [ ] 방→게임시작→페이즈순차→엔딩 전체 동작
- [ ] 5개 모듈 UI 동작 (채팅/투표/단서/리딩/엔딩)
- [ ] 재접속 스냅샷 복원
- [ ] feature flag on/off
- [ ] 전체 테스트 통과
- [ ] `/plan-finish` 실행
