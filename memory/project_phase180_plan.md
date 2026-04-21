---
name: Phase 18.0 플랜 — 게임 런타임 통합
description: PhaseEngine+모듈 WS 연결 + 게임 클라이언트 (10 PR, 6 Wave, W0는 Phase 17.5 cleanup 포함)
type: project
---
# Phase 18.0 — 게임 런타임 통합 (계획)

**작성**: 2026-04-14 | **W0 추가**: 2026-04-15 | **상태**: draft
**Plan dir**: `docs/plans/2026-04-14-game-runtime/`

## 구조 요약

| Wave | Mode | PRs | 도메인 |
|------|------|-----|--------|
| W0 | sequential | PR-0 | fullstack (cleanup) |
| W1 | parallel | PR-1, PR-2 | backend |
| W2 | parallel | PR-3, PR-4 | frontend |
| W3 | parallel ×3 | PR-5, PR-6, PR-7 | frontend |
| W4 | sequential | PR-8 | fullstack (snapshot) |
| W5 | sequential | PR-9 | test (E2E) |

## W0 (PR-0) — Phase 17.5 Followup
Phase 17.5 리뷰(2026-04-15)에서 도출된 MEDIUM/LOW 이슈 7건을 선정리.
1. `ClueRelationRequest/Response` → `editor/types.go` 분리
2. `useClueGraphData` onConnect debounce를 autoSave로 일원화
3. `useDeleteClue` 성공 시 `clueRelationKeys` 크로스 invalidation
4. `useClueGraphData` 단위 테스트 (debounce coalescing, optimistic revert)
5. 서비스 통합 테스트 (testcontainers — FK cascade, TX rollback, cross-theme)
6. `validateClueGraph` Kahn queue → index pointer (O(n²)→O(n))
7. E2E `clue-relation.spec.ts` 기본 2건 MSW mock 으로 CI 실행 가능화

상세: `refs/w0-cleanup.md`

## W1~W5 — 게임 런타임 핵심
- **PR-1**: Hub.Route → Session.Inbox 라우팅 + envelope 레지스트리
- **PR-2**: startModularGame + configJson→모듈 팩토리 + EventMapping 구독
- **PR-3**: gameSessionStore (Zustand) + WS 핸들러 + useGameSession
- **PR-4**: PhaseBar + PhaseTimer + GameLayout
- **PR-5**: GameChatPanel (전체/귓속말)
- **PR-6**: VotePanel + ClueViewPanel
- **PR-7**: ReadingPanel + EndingPanel
- **PR-8**: Session.persistSnapshot (Redis) + 재접속 hydration
- **PR-9**: 방→시작→페이즈→엔딩 E2E + 재접속 E2E + Playwright

## 핵심 설계 결정
- **MVP 모듈 5/29**: text_chat, voting, clue_interaction, reading, ending
- **Feature flag**: `game_runtime_v2` default off (Phase 10.0 인프라 재사용)
- **Actor pattern**: Session goroutine 채널 직렬화
- **Snapshot**: 5초 throttle + phase 전환 시 force
- **속도 이득**: 순차 10T → 병렬 7T (~30% 단축)

## 이미 구현된 것 (Phase 8~17.5)
- `internal/engine/` (PhaseEngine, EventBus, RuleEvaluator, Registry)
- `internal/session/` (Session Actor, Manager, panic_guard)
- 29개 모듈 레지스트리 + BaseModule/ConfigSchema/PhaseReactor
- 에디터 전체 (테마/단서/맵/흐름/관계그래프)

## 위험
- WS 메시지 호환성 → envelope 버전 필드
- 동시성 → Actor 패턴 + race detector
- 스냅샷 크기 → 핵심 상태만 직렬화
- 모듈 초기화 순서 → dependency-sorted init
- W0 cleanup 회귀 → 기존 + 새 테스트 합산 검증

## Out of scope
음성채팅(LiveKit), 공간음성, GM 제어판 — 후속 Phase
