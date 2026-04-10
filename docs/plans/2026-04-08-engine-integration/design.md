# Phase 8.0 — Engine Integration Layer 설계 (index)

> **상태**: SUPERSEDED (2026-04-10) — Phase 9.0 Editor + Engine Redesign으로 대체
> **이유**: 아키텍처 재설계 (GenrePlugin + Audit Log + React Flow 에디터)
> **후속**: `docs/plans/2026-04-10-editor-engine-redesign/`
> **완료 PR**: PR-0, PR-1, PR-2 (Session Actor + Hub Lifecycle 코드는 재사용)
> **상위 설계 참조**: `docs/plans/2026-04-05-rebuild/refs/game-engine.md`, `architecture.md`
> **MD 200줄 제한**: 이 index 포함 모든 문서 <200줄. 상세는 `refs/`로 분할.

---

## 목적

`docs/plans/2026-04-05-rebuild/`의 상위 design.md에 명시됐지만 미구현 상태인 game engine integration layer를 **실서비스급**으로 완성한다. v3의 모든 후속 phase가 이 토대 위에 쌓인다. **MVP 아님** — 견고함과 유지보수성 우선.

---

## Scope (Phase 8.0)

엔진 spine + Core 4 + Progression 8 = **12개 모듈** wired. 자세한 스코프 경계와 out-of-scope 목록은 `refs/scope-and-decisions.md` 참조.

| 카테고리 | 모듈 (12개) |
|----------|------------|
| Core (4) | connection, room, ready, clue_interaction |
| Progression (8) | script, hybrid, event, skip_consensus, gm_control, consensus_control, reading, ending |

Communication 5 + Decision 3 + Exploration 4 + Clue Distribution 5 = 17개는 **Phase 8.0.x** 후속.

---

## 확정된 7대 결정 (변경 금지)

| # | 결정 | 선택 | 핵심 근거 |
|---|------|------|----------|
| 1 | Scope | B (12 모듈) | "한 게임이 끝까지 돌아간다"가 실서비스 최소 정의 |
| 2 | Architecture | A (100% Actor) | v2 race 버그 클래스 원천 차단. lock-free 모듈 |
| 3 | Lifecycle | Room/Session 1:1 분리 + Host 명시 시작 + 명시/타임아웃/abort 종료 | "다시 하기" UX + 좀비 세션 0 |
| 4 | WS↔Actor 통신 | 모듈별 handler + Reply 채널 + 매핑 테이블 + Listener | 일관성 + 결정적 응답 |
| 5 | State Persistence | Replay+snapshot 하이브리드 + 5초 throttle (critical 즉시) + Lazy restore | 좀비 자연 GC + 시나리오 분리 |
| 6 | 운영 안전성 | 메시지단 recover + 3회 abort + Prom/OTel + Unit/Integration | panic 격리 + prod 가시성 |
| 7 | 도입 | **Wave 기반 병렬 실행** + feature flag (`MMP_ENGINE_WIRING_ENABLED` default off) | 속도 + 안전 + revert 가능 |

상세는 `refs/scope-and-decisions.md` 참조.

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/scope-and-decisions.md](refs/scope-and-decisions.md) | 7대 결정의 각 옵션 분석, scope 경계, out-of-scope 목록 |
| [refs/architecture.md](refs/architecture.md) | SessionManager / Session / BaseModuleHandler / EventMapping / Hub listener 컴포넌트 상세 + 아키텍처 다이어그램 |
| [refs/data-flow.md](refs/data-flow.md) | 게임 시작 / in-game 메시지 / disconnect-reconnect 흐름도 |
| [refs/persistence.md](refs/persistence.md) | Redis 스냅샷 알고리즘 (5초 throttle + critical 즉시), Lazy restore, key 구조 |
| [refs/execution-model.md](refs/execution-model.md) | **Wave 기반 병렬 실행**, PR 의존 DAG, 파일 구조 설계 (병렬 wave 머지 충돌 방지), 병렬 리뷰 4 agent |
| [refs/observability-testing.md](refs/observability-testing.md) | Prometheus 메트릭, OTel trace, 테스트 전략, 에러 처리, 위험 요소 |

---

## 전체 구조 요약 (한눈에)

```
┌─────────────────────────────────────────────────────┐
│           cmd/server/main.go                        │
│  Hub(lifecycle) ← SessionManager(listener)          │
│       ↓                ↓                             │
│  ModuleHandlers ──→ Session (1 goroutine, actor)    │
│  (reading, ...)     ├─ engine (NO LOCKS)            │
│                     ├─ EventMapping → Hub.Broadcast │
│                     └─ 5s throttle → Redis          │
└─────────────────────────────────────────────────────┘
```

**액터 이벤트 루프**: `wsCh | timerCh | gmCh | consensusCh | triggerCh | lifecycleCh | snapshotCh | done`

---

## 실행 전략 요약

**Wave 기반 병렬 실행** (상세는 `refs/execution-model.md`):

| Wave | PRs | 모드 | 의존 |
|------|-----|------|------|
| 1 | PR-1, PR-2 | **병렬** | 없음 |
| 2 | PR-3 | 순차 | W1 |
| 3 | PR-4 (패턴 레퍼런스) | 순차 | W2 |
| 4 | PR-5, PR-6, PR-7, PR-8 | **병렬 (4개)** | W3 |
| 5 | PR-9 | 순차 | W4 |

**속도 이득**: 순차 9T → 병렬 5T 단위 (약 33~50% 단축)

**병렬 메커니즘**: Agent tool의 `isolation: "worktree"` — 각 병렬 agent가 자체 git worktree에서 작업, 파일 충돌 원천 차단.

---

## 종료 조건

Phase 8.0 "완료" 기준 (상세는 `refs/execution-model.md`):

- [ ] 9개 PR 모두 main 머지
- [ ] feature flag 활성화 상태에서 모든 통합 테스트 PASS
- [ ] 12개 모듈 smoke test PASS
- [ ] 한 게임 end-to-end 시나리오 통과 (in-process integration)
- [ ] Server restart 복구 시나리오 통과
- [ ] Panic 격리 시나리오 통과 (3회 누적 → abort)
- [ ] Prometheus metric 9종 노출
- [ ] `memory/project_phase80_progress.md` 최종 갱신 + Phase 8.0.x로 인계

---

## 다음 단계

1. `plan.md` 작성 — PR별 상세 task breakdown (각 PR별 `refs/pr-N-*.md`, 200줄 제한)
2. `checklist.md` 작성 — STATUS 마커 + 각 PR 체크박스
3. root `checklist.md`에 "Phase 8.0" 추가 + 기존 Phase 8을 "Phase 8.1"로 rename
4. PR 0 (문서 인프라) 머지
5. PR-1 skeleton 착수 (Wave 1)
