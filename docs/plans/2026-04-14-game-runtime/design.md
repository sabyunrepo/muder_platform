# Phase 18.0 — 게임 런타임 통합 설계 (index)

> **상태**: 초안
> **시작**: 2026-04-15 (Phase 17.5 archived)
> **MD 200줄 제한**: 모든 문서 <200줄. 상세는 `refs/` 분할.

---

## 목적

에디터에서 만든 configJson으로 실제 게임 세션을 구동한다.
PhaseEngine + EventBus + 모듈이 이미 구현됨 — 연결 레이어가 핵심.
더불어 Phase 17.5 리뷰 잔여 followup을 W0 cleanup으로 선행 처리한다.

---

## Scope

| 카테고리 | 항목 |
|---------|------|
| W0 Cleanup | Phase 17.5 followup (types.go 분리, debounce 일원화, 크로스 invalidation, hook 테스트, queue O(n), MSW E2E) |
| Backend Wiring | Hub→Session inbox 라우팅, startModularGame() |
| Module Init | configJson→모듈 팩토리→엔진 등록 |
| Frontend Client | 게임 Zustand store + WS 메시지 핸들링 |
| Phase UI | 페이즈 상태바, 타이머, 진행 표시 |
| Module UIs | 채팅, 투표, 단서열람, 리딩 UI |
| Snapshot | Redis persist/restore + 재접속 |
| E2E | 방 생성→게임 시작→페이즈 진행 전체 파이프라인 |

**Out of scope**: 음성채팅(LiveKit, 별도 Phase), 공간음성, GM 제어판

상세는 [refs/scope-and-decisions.md](refs/scope-and-decisions.md).

---

## 7대 결정

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | Scope | 핵심 5모듈 + W0 cleanup | MVP + 기술 부채 선정리 |
| 2 | Architecture | Actor-per-session goroutine | 설계 확정됨 |
| 3 | Lifecycle | Room.Start→Session.Run→Phase→End | 데이터흐름 문서 |
| 4 | External Interface | WS envelope + REST /rooms/:id/start | 기존 Hub 활용 |
| 5 | Persistence | Redis snapshot + critical event flush | 5초 throttle |
| 6 | 운영 안전성 | panic guard + OTel trace + Go/Vitest/E2E | 기존 패턴 |
| 7 | 도입 전략 | Feature flag `game_runtime_v2` default off | 점진적 |

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/scope-and-decisions.md](refs/scope-and-decisions.md) | 상세 결정 |
| [refs/execution-model.md](refs/execution-model.md) | Wave DAG + 스코프 |
| [refs/data-flow.md](refs/data-flow.md) | 기존 설계 참조 포인터 |
| [refs/w0-cleanup.md](refs/w0-cleanup.md) | Phase 17.5 followup 상세 |

---

## 실행 전략 요약

| Wave | PRs | 모드 | 의존 |
|------|-----|------|------|
| W0 | PR-0 | sequential | - |
| W1 | PR-1, PR-2 | parallel | W0 |
| W2 | PR-3, PR-4 | parallel | W1 |
| W3 | PR-5, PR-6, PR-7 | parallel | W2 |
| W4 | PR-8 | sequential | W3 |
| W5 | PR-9 | sequential | W4 |

**속도 이득**: 순차 10T → 병렬 7T (~30% 단축)

---

## 종료 조건

- [ ] Phase 17.5 followup 전부 처리 (W0)
- [ ] 방 생성 → 게임 시작 → 페이즈 순차 진행 → 엔딩
- [ ] 채팅/투표/단서열람/리딩 모듈 동작
- [ ] 재접속 시 스냅샷 복원
- [ ] feature flag로 on/off 전환
- [ ] Go + Vitest + E2E 테스트 통과
