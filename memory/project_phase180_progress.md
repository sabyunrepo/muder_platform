---
name: Phase 18.0 게임 런타임 통합 완료
description: Phase 18.0 — 에디터 configJson 으로 실제 게임 세션 구동, 10 PR / 6 Wave / 50 tasks 완료 (2026-04-15)
type: project
---
## 개요

- **PR 수**: 10 (PR-0 cleanup + PR-1~9 런타임 통합)
- **Wave**: W0~W5 (sequential + 3-way parallel 포함)
- **최종 커밋**: c4d4620

## Wave별 결과

| Wave | PR | 내용 | GH PR |
|------|-----|------|-------|
| W0 | PR-0 | Phase 17.5 cleanup (types.go split, debounce 일원화, Kahn O(n), 14 FE tests, 3 Go 통합 tests, MSW E2E) | #25 |
| W1 | PR-1 | `ws.EnvelopeRegistry` + `Hub.Route` 세션 디스패치 + `SessionSender` 인터페이스 | #26 |
| W1 | PR-2 | `session.startModularGame` + `engine/factory` + `EventMapping` broadcast (Actor 패턴, feature flag `game_runtime_v2`) | #27 |
| W2 | PR-3 | `gameSessionStore` Zustand + WS 핸들러 + `useGameSession`/`useGameWS` (지수 백오프 재연결) | #29 |
| W2 | PR-4 | `PhaseBar` + `PhaseTimer` + `GameLayout` (stateless props 기반) | #28 |
| W3 | PR-5 | `GameChatPanel` + `WhisperPanel` + `gameChatStore` | #30 |
| W3 | PR-6 | `VotePanel` + `ClueViewPanel` (+ 6 서브컴포넌트, 17 tests, v2 재실행으로 완료) | #32 |
| W3 | PR-7 | `ReadingPanel` + `EndingPanel` + 스코어 차트 | #31 |
| W4 | PR-8 | `Session.persistSnapshot` (Redis 5s throttle + critical flush) + 재접속 push + `hydrateFromSnapshot` | #33 |
| W5 | PR-9 | E2E: `game-session.spec.ts` + `game-reconnect.spec.ts` + `game-visual.spec.ts` (CI-safe skip guards) | #34 |

## 후속 개선 (같은 세션에서 처리)

- `fix(session)` b018128: lifecycle 콜백에 `context.Background()` → `Session.Ctx()` 대체 (세션 종료 자동 cancel)
- `fix(session)` b018128: W1~W4 merge 누적으로 생긴 `KindEngineStart` duplicate case 제거
- `feat(session)` c4d4620: `snapshot.ModuleStates` 를 `engine.BuildState().modules` 결과로 연결 (이전에 빈 맵)

## 운영 메모

- **Plan-autopilot 운영 함정**: 서브에이전트 워크트리에서 일부 PR 이 다른 PR merge 까지 포함한 브랜치에 기반하여 만들어져 머지 시 main 이 뒤쳐지는 현상 → 최종 통합 머지로 해결. feedback_plan_autopilot_gotchas.md 에 추가 권장.
- **PR-6 truncation**: 첫 시도에서 agent 가 3/3 tasks 전에 cutoff — SendMessage 로 재개해도 실패 → `feat/...-PR-6-v2` 로 새 실행이 안정적. 앞으로 long-running executor 는 per-task 즉시 commit 지시 필수.

## Feature flag

`game_runtime_v2` — default off. 방 시작 시 체크되어 off 면 기존 로직으로 폴백.

## 다음 Phase 후보

- Phase 18.1 또는 Phase 19.0: 공간 음성 (LiveKit), GM 제어판, 모바일(Expo) 클라이언트
- pre-existing CI 인프라 부채 (golangci-lint↔Go 1.25, ESLint 9 config) 재정비
