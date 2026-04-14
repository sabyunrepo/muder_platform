# Phase 18.0 — 게임 런타임 통합 실행 계획 (index)

> 부모: [design.md](design.md)
> MD 200줄 제한: 각 PR 상세는 `refs/pr-N-*.md`

---

## Overview

PhaseEngine + EventBus + 29개 모듈을 WS Hub와 연결하고,
프론트엔드 게임 클라이언트를 구축하여 실제 게임 세션을 구동한다.

---

## Wave 구조

```
W1 (parallel): PR-1 WS라우팅, PR-2 startModularGame
  ↓
W2 (parallel): PR-3 게임Store, PR-4 페이즈UI
  ↓
W3 (parallel): PR-5 채팅, PR-6 투표+단서, PR-7 리딩+엔딩
  ↓
W4 (sequential): PR-8 스냅샷+재접속
  ↓
W5 (sequential): PR-9 E2E 통합
```

---

## PR 목록

| PR | Wave | Title | 의존 | 도메인 |
|----|------|-------|------|--------|
| PR-1 | W1 | WS→Session inbox 라우팅 | - | backend |
| PR-2 | W1 | startModularGame + 모듈 팩토리 | - | backend |
| PR-3 | W2 | 게임 Zustand store + WS 핸들러 | PR-1,2 | frontend |
| PR-4 | W2 | PhaseBar + 타이머 UI | PR-1,2 | frontend |
| PR-5 | W3 | 인게임 채팅 모듈 UI | PR-3,4 | frontend |
| PR-6 | W3 | 투표 + 단서열람 UI | PR-3,4 | frontend |
| PR-7 | W3 | 리딩 + 엔딩 UI | PR-3,4 | frontend |
| PR-8 | W4 | 스냅샷 persist + 재접속 복원 | PR-5~7 | fullstack |
| PR-9 | W5 | E2E 통합 테스트 | PR-8 | test |

---

## Merge 전략

- Wave 내 병렬 PR은 `isolation: worktree`
- W3 최대 3 병렬 (프론트 모듈 UI, 독립 컴포넌트)
- 각 머지 후 `pnpm test` + `go test -race` gate
- Wave 종료 시 user 확인 1회

---

## Feature flag

`game_runtime_v2` — default off.
- 방 시작 시 flag 체크 → off면 기존 로직, on이면 modular engine
- 프론트: 게임 화면 진입 시 flag 기반 라우팅

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| WS 메시지 호환성 | envelope 타입 레지스트리 + 버전 필드 |
| 동시성 (세션 goroutine) | Actor 패턴 (채널 직렬화), race detector |
| 스냅샷 크기 | 핵심 상태만 직렬화, 캐시 제외 |
| 모듈 초기화 순서 | dependency-sorted init (engine.registry) |

---

## 후속

- **Phase 18.x**: GM 제어판, 공간 음성, AI 시나리오
- **Phase 19.0**: 모바일 (Expo) 게임 클라이언트
