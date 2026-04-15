# Phase 18.3 — 보안 하드닝 + CI 정비 실행 계획 (index)

> 부모: [design.md](design.md)

---

## Overview

W0 에서 보안(PR-0)과 CI 인프라(PR-1)를 병렬로 밀고, W1 에서 하이진 배치
(PR-2)와 E2E 보강(PR-3)을 병렬 진행. W2 에서 풀 회귀.

---

## Wave 구조

```
W0 (parallel ×2):
  PR-0 — Security hardening (M-7, M-a, M-e, L-2, L-6, L-7)   ← backend
  PR-1 — CI infra debt (CI-1, CI-2, CI-3)                      ← tooling
  ↓
W1 (parallel ×2):
  PR-2 — Low-severity hygiene batch (L-3, L-4, L-5)            ← backend
  PR-3 — E2E stubbed-backend CI job (L-8)                      ← test
  ↓
W2 (sequential):
  PR-4 — Regression + docs + plan-finish 준비
```

---

## PR 목록

| PR | Wave | Title | 의존 | 도메인 |
|----|------|-------|------|--------|
| PR-0 | W0 | Security hardening — snapshot redaction + start cleanup + KindStop ending + ctx/dump hygiene | - | backend |
| PR-1 | W0 | CI infra debt — config env isolation + golangci-lint + ESLint 9 | - | tooling/ci |
| PR-2 | W1 | Low hygiene batch — recentLeftAt O(N) / snapshotKey namespace / Hub.Stop race | PR-0 | backend |
| PR-3 | W1 | E2E stubbed-backend CI job (replaces auto-skip) | PR-0,1 | test/ci |
| PR-4 | W2 | Regression full sweep + docs + memory update | PR-2,3 | docs |

---

## Merge 전략

- W0 PR-0, PR-1 worktree isolation — 파일 겹침 없음 (backend vs ci config)
- W1 PR-2, PR-3 worktree — PR-2 backend, PR-3 E2E/CI
- 각 머지 후 gate: `go test -race` + `pnpm test` + 새 CI job 확인
- Wave 종료 시 user 확인 1회

---

## Feature flag

해당 없음 — 본 phase 는 cleanup/hardening.

---

## 알려진 위험

| 위험 | 완화 |
|------|------|
| M-7 recovery redaction 이 engine 없이 재구성 불가 | Persist 시점에 플레이어별 블롭 저장 (map[playerID]bytes) or 블롭에서 민감 키 제거 |
| golangci-lint Go 1.25 미지원 | latest tag 로 전환 or staticcheck 로 대체 |
| ESLint 9 flat config 마이그레이션 대규모 diff | 별도 commit 으로 분리 (config 만 vs rule 수정) |
| E2E stubbed backend 가 실제 스키마와 divergent | 스키마 snapshot 테스트 + 1회/주 real-backend 크로스 실행 |

---

## 테스트 매트릭스 (Phase completion gate)

| 영역 | 도구 | 기대값 |
|------|------|--------|
| Go race | `go test -race -count=1 ./...` | 0 fail (config 포함) |
| Go lint | `golangci-lint run` | pass |
| 프론트 unit | `pnpm test` | 0 새 실패 |
| 프론트 lint | `pnpm lint` | pass (ESLint 9) |
| 프론트 타입 | `pnpm exec tsc --noEmit` | 0 error |
| E2E CI | stubbed-backend job | pass (skip 없이 실행) |
| E2E 로컬 | `PLAYWRIGHT_BACKEND=1` | pass |

---

## 후속

- Phase 19.0: 모바일 Expo 클라이언트, LiveKit 공간 음성, GM 제어판
- Phase 18.4+ (필요 시): 남은 Low findings 없음 — 본 phase 로 클린 슬레이트
