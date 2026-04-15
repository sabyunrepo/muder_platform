# Phase 18.1 — 게임 런타임 Hotfix 설계 (index)

> **상태**: 확정
> **시작**: 2026-04-15 (Phase 18.0 archived 직후)
> **목적**: Phase 18.0 code review (3 parallel reviewers) 에서 발견된
> **ship-blocker 4건 + high 4건**을 릴리즈 가능 상태로 올린다.
> **MD 200줄 제한**: 각 문서 <200줄. 상세는 `refs/` 분할.

---

## 배경

Phase 18.0 은 PhaseEngine/EventBus/모듈 기반 게임 런타임을 에디터와
연결하는 wiring을 목표로 10개 PR / 6 Wave 로 진행했으나, 병렬 실행 과정에서
(a) main.go 최종 wiring 누락, (b) snapshot 재접속 시 역할 유출 위험,
(c) configJson trust boundary 누락, (d) 프론트 2개 store 공존이라는
구조적 gap 이 누적됐다. 리뷰 합의로 release 전 반드시 처리.

---

## Scope

| 카테고리 | 항목 | Severity |
|---------|------|----------|
| Backend wiring | main.go 전체 조립 (SessionManager, Broadcaster 어댑터, SessionSender, LifecycleListener) | B-1/H-4 |
| Backend wiring | `startModularGame` 에 `injectSnapshot` 추가 | H-2 |
| Backend wiring | EnvelopeRegistry 에 legacy/신규 타입 전수 등록 + 카탈로그 테스트 | H-3 |
| Backend safety | `Session.runCtx` atomic.Pointer 변환 | H-1 |
| Backend security | Snapshot per-player 재구성(역할 redaction) | B-2 |
| Backend security | `configJson` size cap + DisallowUnknownFields + module allowlist | B-3 |
| Frontend | `gameStore` ↔ `gameSessionStore` 통합 (단일 진실 원천) + `syncServerTime` | B-4 |
| E2E | 실제 기동 환경에서 game-session 플로우 회귀 테스트 | 검증 |

**Out of scope**: Medium 10건 (Phase 18.2 cleanup 에서 처리), Low 8건.

상세: [refs/findings.md](refs/findings.md).

---

## 7대 결정

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | Hotfix 범위 | Ship-blocker + High 만 (Medium 이월) | 릴리즈 속도 우선 |
| 2 | 브랜치 전략 | main 직접 merge (hotfix 성격) | 배포 가속 |
| 3 | Feature flag | `game_runtime_v2` 유지 (default off) | 안전 롤아웃 |
| 4 | Snapshot redaction | Engine 인터페이스 확장 (`BuildStateFor(playerID)`) | 모듈별 자가 redaction |
| 5 | Frontend 통합 방향 | `gameSessionStore` 로 단일화, `gameStore` 단계적 제거 | 신규 store 가 더 깔끔 |
| 6 | Registry 안전 | 카탈로그 테스트로 누락 차단 | 기존 플레이어 회귀 방지 |
| 7 | 검증 | Real-backend E2E 1회 + Go race 풀수트 | CI-safe skip 의존 제거 |

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/findings.md](refs/findings.md) | 8건 finding 상세 + 파일:라인 + 수정 지침 |
| [refs/execution-model.md](refs/execution-model.md) | Wave DAG + 스코프 충돌 분석 |
| [refs/interface-changes.md](refs/interface-changes.md) | `Module.BuildStateFor` 등 인터페이스 변경 영향 범위 |

---

## 실행 전략 요약

| Wave | PRs | 모드 | 의존 |
|------|-----|------|------|
| W0 | PR-0 | sequential | - |
| W1 | PR-1, PR-2, PR-3 | parallel | W0 |
| W2 | PR-4 | sequential | W1 |

**속도 이득**: 순차 5T → 3T

---

## 종료 조건

- [ ] main.go 에서 flag on 시 실제 세션 actor 시작 (E2E 검증)
- [ ] 재접속 시 플레이어별 private 데이터가 자신에게만 도달
- [ ] `configJson` 크기/모듈 수/unknown field 거부 테스트 통과
- [ ] 프론트 store 단일 진실 원천 달성 (`gameStore` 제거 또는 alias)
- [ ] `runCtx` `-race` 깨끗
- [ ] Go 전체 `go test -race -count=1 ./...` pass
- [ ] 프론트 `pnpm test` + `pnpm exec tsc --noEmit` pass
- [ ] E2E `game-session.spec.ts` 실제 백엔드 대상 1회 실행 통과
