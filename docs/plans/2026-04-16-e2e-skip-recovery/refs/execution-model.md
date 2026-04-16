# Phase 18.8 — Execution Model (Wave DAG + 파일 구조)

> 부모: [../design.md](../design.md)

---

## Wave DAG

```
┌─────────────────────────────────────────────┐
│ Wave 1 — Foundation (parallel, 2 worktree)  │
│                                             │
│   PR-1 fix/rooms-maxplayers-optional        │
│       (Go backend, scope: room/**)          │
│                                             │
│   PR-2 test/e2e-msw-helpers                 │
│       (FE infra, scope: mocks/** + e2e/**)  │
│                                             │
│   gate: 4-reviewer + tests pass → merge     │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ Wave 2 — Stub Expansion (parallel, 2 wt)    │
│                                             │
│   PR-3 test/e2e-redaction-stubbed           │
│       (scope: game-redaction-stubbed.spec)  │
│                                             │
│   PR-4 test/e2e-clue-relation-stubbed       │
│       (scope: clue-relation-stubbed.spec)   │
│                                             │
│   gate: stubbed CI ≤3 skip + review → merge │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ Wave 3 — CI Promotion (sequential, 1 wt)    │
│                                             │
│   PR-5 ci/e2e-real-backend-gate             │
│       (scope: .github/workflows/**)         │
│                                             │
│   gate: main push trigger 확인 + 알림 도달  │
└─────────────────────────────────────────────┘
                    │
                    ▼
         3일 nightly green 관측
                    │
                    ▼
              /plan-finish
```

---

## 의존성 분석

| PR | 직접 의존 | 간접 의존 |
|----|----------|----------|
| PR-1 | - | - |
| PR-2 | - | - |
| PR-3 | PR-1 (API optional), PR-2 (MSW foundation) | - |
| PR-4 | PR-1 (관계 없음 but MSW), PR-2 (MSW foundation) | - |
| PR-5 | PR-3, PR-4 (stubbed CI 안정화 후) | PR-1, PR-2 |

**topological sort**: [PR-1, PR-2] → [PR-3, PR-4] → [PR-5]

---

## Scope globs (per PR)

```yaml
PR-1:
  - apps/server/internal/domain/room/**
  - apps/server/internal/domain/room/**_test.go
  # 제외: db/migrations/** (컬럼 변경 없음)

PR-2:
  - apps/web/src/mocks/**
  - apps/web/e2e/helpers/**
  - apps/web/playwright.config.ts
  - apps/web/e2e/game-session.spec.ts  # helper 리팩터 대상
  - apps/web/package.json              # msw dep 추가

PR-3:
  - apps/web/e2e/game-redaction-stubbed.spec.ts
  - apps/web/src/mocks/handlers/game-ws.ts
  - apps/web/src/mocks/handlers/index.ts

PR-4:
  - apps/web/e2e/clue-relation-stubbed.spec.ts
  - apps/web/src/mocks/handlers/clue.ts

PR-5:
  - .github/workflows/phase-18.1-real-backend.yml
  - .github/workflows/e2e-stubbed.yml
  - docs/plans/2026-04-16-e2e-skip-recovery/refs/ci-promotion.md
```

**충돌 분석**: W1의 PR-1과 PR-2는 디렉토리 disjoint. W2의 PR-3, PR-4는 `handlers/` 공유하지만 서로 다른 파일(`game-ws.ts` vs `clue.ts`) → 충돌 없음.

---

## 브랜치 / 워크트리 네이밍

```
fix/rooms-maxplayers-optional     (PR-1)
test/e2e-msw-helpers              (PR-2)
test/e2e-redaction-stubbed        (PR-3)
test/e2e-clue-relation-stubbed    (PR-4)
ci/e2e-real-backend-gate          (PR-5)
```

워크트리 경로: `/tmp/phase-18.8/{PR-N}` 또는 플러그인 기본값.

---

## 속도 계산

- 순차 실행: 5T (PR-1 → PR-2 → PR-3 → PR-4 → PR-5)
- 병렬 실행: 3T (W1: 1T, W2: 1T, W3: 1T)
- 단축률: (5-3)/5 = **40%**

---

## 실행 단위 (T) 추정

| PR | 예상 단위 | 근거 |
|----|----------|------|
| PR-1 | 1T | Go 3~4 파일, 기존 테스트 확장. 소규모 |
| PR-2 | 1.5T | MSW 셋업 + helper + config + spec 리팩터. 가장 큼 |
| PR-3 | 0.8T | MSW handler 1 + spec 1. 중간 |
| PR-4 | 0.8T | 동등 |
| PR-5 | 0.5T | workflow YAML 2개 |

W1 최대(PR-2) = 1.5T, W2 최대(PR-3) = 0.8T, W3 = 0.5T → 총 2.8T 병렬 (여유 0.2T)
