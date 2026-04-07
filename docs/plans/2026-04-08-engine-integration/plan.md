# Phase 8.0 — Engine Integration Layer 실행 계획 (index)

> 부모: [design.md](design.md)
> MD 200줄 제한: 각 PR 상세는 `refs/pr-N-*.md`

---

## Overview

Phase 8.0은 12개 모듈 (Core 4 + Progression 8)을 wave 기반 병렬 실행으로 wired합니다. 순수 wiring만 담당하며, 29개 중 나머지 17개는 Phase 8.0.x 후속.

전체 아키텍처: [refs/architecture.md](refs/architecture.md)
Wave 실행 모델: [refs/execution-model.md](refs/execution-model.md)

---

## Wave 구조

```
W0 (docs/infra)   ──▶  W1 (skeletons, ×2 parallel)
                           │
                           ▼
                       W2 (infra) ──▶ W3 (pattern ref)
                                          │
                                          ▼
                          W4 (wiring, ×4 parallel)
                                          │
                                          ▼
                          W5 (observability)
```

| Wave | Mode | PRs | 의존 | 예상 단위 |
|------|------|-----|------|----------|
| W0 | sequential | PR-0 | - | 1T |
| W1 | **parallel ×2** | PR-1, PR-2 | W0 | 1T |
| W2 | sequential | PR-3 | W1 | 1T |
| W3 | sequential | PR-4 | W2 | 1T |
| W4 | **parallel ×4** | PR-5, PR-6, PR-7, PR-8 | W3 | 1T |
| W5 | sequential | PR-9 | W4 | 1T |

**순차 9T → 병렬 5T (~44% 단축)**

---

## PR 목록

| PR | Wave | Title | 의존 | 상세 |
|----|------|-------|------|------|
| PR-0 | W0 | Docs + plan-autopilot infra | - | [refs/pr-0-docs-infra.md](refs/pr-0-docs-infra.md) |
| PR-1 | W1 | SessionManager + Session actor | PR-0 | [refs/pr-1-skeleton.md](refs/pr-1-skeleton.md) |
| PR-2 | W1 | Hub lifecycle listener | PR-0 | [refs/pr-2-hub-lifecycle.md](refs/pr-2-hub-lifecycle.md) |
| PR-3 | W2 | BaseModuleHandler + EventMapping | PR-1, PR-2 | [refs/pr-3-base-handler.md](refs/pr-3-base-handler.md) |
| PR-4 | W3 | Reading module wired (pattern ref) | PR-3 | [refs/pr-4-reading-wired.md](refs/pr-4-reading-wired.md) |
| PR-5 | W4 | Core 4 modules wired | PR-4 | [refs/pr-5-core-modules.md](refs/pr-5-core-modules.md) |
| PR-6 | W4 | Progression 7 modules wired | PR-4 | [refs/pr-6-progression-modules.md](refs/pr-6-progression-modules.md) |
| PR-7 | W4 | Redis snapshot + Lazy restore | PR-4 | [refs/pr-7-snapshot-restore.md](refs/pr-7-snapshot-restore.md) |
| PR-8 | W4 | Game start API + abort + idle timeout | PR-4 | [refs/pr-8-game-start-api.md](refs/pr-8-game-start-api.md) |
| PR-9 | W5 | Observability (Prometheus + OTel) | PR-5~8 | [refs/pr-9-observability.md](refs/pr-9-observability.md) |

---

## Merge 전략

1. Wave 내 병렬 PR은 각자 `isolation: "worktree"`
2. 머지 순서: **PR 번호 순** (순차)
3. 각 머지 후 `go test -race -count=1 ./...` gate
4. 충돌 시 executor sub-agent에 해결 위임 (fix-loop 포함)
5. Wave 종료 시 user 확인 1회

---

## Feature flag

`MMP_ENGINE_WIRING_ENABLED` (default `false`)

- PR-1 ~ PR-8: default off → prod 영향 0
- PR-9 머지 후 → dev에서 activate
- Prod activate는 Phase 8.1 통합 QA 후 별도 결정

---

## 파일 구조 규칙 (병렬 wave 머지 충돌 방지)

PR-4에서 확정되는 파일 구조 패턴:

```
internal/session/
  event_mapping.go              # 인프라 (PR-3)
  event_mapping_reading.go      # PR-4
  event_mapping_core.go         # PR-5
  event_mapping_progression.go  # PR-6
  registry.go                   # 팩토리 (PR-3)
  registry_reading.go           # PR-4
  registry_core.go              # PR-5
  registry_progression.go       # PR-6
  registry_snapshot.go          # PR-7

internal/ws/handlers/
  reading.go                    # PR-4
  core_*.go (4개)               # PR-5
  progression_*.go (7개)        # PR-6
```

**핵심**: main.go는 PR-3 이후 수정 금지 (`session.RegisterAllHandlers(router, manager)` 1줄만).

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| engine.go lock 제거 후 race | `go test -race` CI gate + actor 경로 강제 |
| Inbox full | Buffer 256, full 시 명시 에러 + Prometheus alert |
| Redis 일시 장애 | 재시도 3회 + session 계속 |
| Snapshot schema 호환성 | `schemaVersion` 필드 + mismatch 시 손실 |
| Wave 4 병렬 머지 충돌 | 파일 구조 설계 + scope 검증 (plan-wave.sh) |

---

## 후속 phase

- **Phase 8.0.x**: Communication 5 + Decision 3 + Exploration 4 + Clue Distribution 5 = 17 모듈
- **Phase 8.1** (구 Phase 8): 통합 QA (Playwright E2E)
- **Phase 8.5**: 보안/테스트/i18n
- **Phase 8.6**: 이관/에셋/Admin

---

## 스킬 참조

- 실행: `~/.claude/skills/plan-autopilot/commands/plan-autopilot.md`
- Wave 실행 상세: `~/.claude/skills/plan-autopilot/refs/execution.md`
- Pipeline config: `.claude/post-task-pipeline.json`
