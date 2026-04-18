---
name: Phase 8.0 Engine Integration Layer 계획 (확정)
description: 12개 모듈 wired, Wave 기반 병렬 실행, 7대 결정 확정. 변경 금지.
type: project
---

## Phase 8.0 — Engine Integration Layer

**목적**: MMP v3 game engine integration을 실서비스급으로 완성. MVP 아님. 후속 phase의 토대.

**시작**: 2026-04-08
**Scope**: Core 4 + Progression 8 = **12 모듈** (나머지 17은 Phase 8.0.x)
**Design doc**: `docs/plans/2026-04-08-engine-integration/design.md` (index + refs/ 분할, 각 <200줄)

---

## 7대 결정 (변경 금지)

| # | 결정 | 선택 |
|---|------|------|
| 1 | Scope | B (12 모듈) |
| 2 | Architecture | A (100% Actor, lock-free) |
| 3 | Lifecycle | Room/Session 1:1 분리, Host 시작+ready 검증, 명시/10min idle/abort 종료 |
| 4 | WS↔Actor | 모듈별 handler + Reply chan + 매핑 테이블 + Listener |
| 5 | Persistence | Replay+snapshot 하이브리드 + 5s throttle (critical 즉시) + Lazy restore |
| 6 | 운영 | 메시지단 recover + 3회 abort + Prom/OTel + Unit/Integration |
| 7 | 도입 | **Wave 기반 병렬 PR** + feature flag `MMP_ENGINE_WIRING_ENABLED` default off |

---

## Wave 기반 병렬 실행 (9 PR, 5 wave)

| Wave | PRs | 모드 | 의존 |
|------|-----|------|------|
| W1 | PR-1 (SessionManager), PR-2 (Hub lifecycle) | **병렬 ×2** | 없음 |
| W2 | PR-3 (BaseModuleHandler + EventMapping) | 순차 | W1 |
| W3 | PR-4 (Reading wired — 패턴 레퍼런스) | 순차 | W2 |
| W4 | PR-5 (Core 4), PR-6 (Progression 7), PR-7 (Snapshot), PR-8 (Start API) | **병렬 ×4** | W3 |
| W5 | PR-9 (Observability) | 순차 | W4 |

**속도**: 순차 9T → 병렬 5T, ~44% 단축

**병렬 메커니즘**: Agent tool `isolation: "worktree"` — 각 병렬 agent가 자체 git worktree, 파일 충돌 원천 차단

---

## 병렬 리뷰 4 agent (Wave 4의 각 PR)

| Agent | 관점 |
|-------|------|
| security-reviewer | auth/권한/검증/injection |
| code-reviewer (perf) | lock contention, allocation, hot path |
| architect/critic | design.md 정합성, SOLID |
| test-engineer | 누락 시나리오, race, edge case |

한 메시지에 4개 Agent 병렬 호출 → findings 통합 → fix-loop 최대 **3회** → 초과 시 user 개입

---

## 파일 구조 설계 (병렬 머지 충돌 방지)

```
internal/session/
  event_mapping.go              # PR-3 인프라
  event_mapping_reading.go      # PR-4
  event_mapping_core.go         # PR-5
  event_mapping_progression.go  # PR-6
  registry.go                   # PR-3 RegisterModuleHandlers() 팩토리
  registry_reading.go           # PR-4
  registry_core.go              # PR-5
  registry_progression.go       # PR-6
  registry_snapshot.go          # PR-7

internal/ws/handlers/
  reading.go                    # PR-4
  core_*.go (4개)               # PR-5
  progression_*.go (7개)        # PR-6
```

**핵심 규칙**: main.go는 PR-3 이후 수정 금지. PR-4부터는 registry_*.go만 편집.

---

## Auto-merge 정책

- Pipeline 자동 실행 (구현 → test → 4 리뷰 병렬 → fix loop → commit → create PR → CI wait → merge)
- **Merge 직전 user 확인 1회** (wave 종료 시점): "Wave N 완료, 다음 wave 진행?"
- Fix-loop 최대 3회 후 수동 개입

---

## 새 세션에서 이 plan 발견 시

1. 이 파일 먼저 읽기 (정적 결정사항)
2. `project_phase80_progress.md` 읽기 (현재 wave/PR 상태)
3. 작업 위치 파악 → 해당 wave 작업 재개
4. design doc: `docs/plans/2026-04-08-engine-integration/design.md` + refs/
5. **결정 변경 시 user 확인 필수** — 이 plan은 brainstorming 합의 결과물

## 참조

- `docs/plans/2026-04-08-engine-integration/design.md` (index)
- `docs/plans/2026-04-08-engine-integration/refs/scope-and-decisions.md` (7대 결정 상세)
- `docs/plans/2026-04-08-engine-integration/refs/architecture.md` (컴포넌트)
- `docs/plans/2026-04-08-engine-integration/refs/execution-model.md` (Wave 기반 실행)
- `docs/plans/2026-04-08-engine-integration/refs/persistence.md` (Redis 스냅샷)
- `docs/plans/2026-04-08-engine-integration/refs/data-flow.md` (흐름도)
- `docs/plans/2026-04-08-engine-integration/refs/observability-testing.md` (메트릭+테스트)
