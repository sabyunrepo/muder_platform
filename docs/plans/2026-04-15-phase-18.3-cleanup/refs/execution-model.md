# Phase 18.3 — Execution Model

## Wave DAG

```
W0 (parallel):
  PR-0 (backend security)   ║   PR-1 (CI infra)
 ↓
W1 (parallel):
  PR-2 (backend hygiene)    ║   PR-3 (E2E stubbed CI)
 ↓
W2 (sequential):
  PR-4 (regression + docs)
```

## 파일 스코프

### PR-0 (Security) — backend
```
apps/server/internal/session/snapshot.go         (M-7, L-2)
apps/server/internal/session/snapshot_serialize.go (M-7)
apps/server/internal/session/starter.go          (M-a, L-7)
apps/server/internal/session/session.go          (M-e)
apps/server/internal/engine/phase_engine.go      (M-e if ending wiring)
apps/server/internal/module/progression/ending.go (M-e)
apps/server/internal/ws/hub.go                   (L-6 panic dump)
apps/server/internal/session/*_test.go           (M-7, M-a, M-e tests)
```

### PR-1 (CI) — tooling
```
apps/server/internal/config/config.go            (CI-1 주입형 API)
apps/server/internal/config/config_test.go       (CI-1 env 격리)
.golangci.yml                                    (CI-2)
Makefile                                         (CI-2)
.github/workflows/ci.yml                         (CI-2, CI-3)
apps/web/eslint.config.js                        (CI-3 신규)
apps/web/package.json                            (CI-3 devDeps)
README.md / CONTRIBUTING.md                      (CI-2 버전 가이드)
```

### PR-2 (Hygiene) — backend
```
apps/server/internal/ws/hub.go                   (L-3 recentLeftAt, L-5 Stop race)
apps/server/internal/session/snapshot_serialize.go (L-4 네임스페이스)
apps/server/internal/session/snapshot.go         (L-4 네임스페이스)
apps/server/internal/ws/hub_test.go              (회귀)
```

### PR-3 (E2E) — test
```
apps/web/e2e/game-session-live.spec.ts           (L-8 skip 제거)
apps/web/e2e/game-reconnect.spec.ts              (동일)
apps/web/e2e/game-visual.spec.ts                 (동일)
.github/workflows/e2e-stubbed.yml                (신규, PR 기본 CI)
docker-compose.e2e.yml                           (신규 stubbed 서비스)
```

### PR-4 (Docs) — memory + docs
```
memory/project_phase183_progress.md              (신규)
memory/MEMORY.md                                 (업데이트)
memory/feedback_ci_infra_debt.md                 (해결 항목 체크)
docs/plans/2026-04-15-phase-18.3-cleanup/checklist.md (STATUS=archived)
```

## 충돌 분석

| Pair | 겹침 | 안전 |
|------|------|------|
| PR-0 vs PR-1 | 없음 (backend src vs tooling/config) | ✅ |
| PR-2 vs PR-0 | hub.go 수정 교차 (PR-0 L-6, PR-2 L-3/L-5) | ⚠ PR-2 base = PR-0 merged |
| PR-3 vs PR-0/1 | 없음 | ✅ |

W1 은 W0 완료 후 rebase — PR-2 의 hub.go 는 PR-0 의 L-6 수정을 포함한 상태에서 작업.

## 모델 오버라이드

| PR | Model | 이유 |
|----|-------|------|
| PR-0 | opus | 보안 아키텍처 판단 (recovery redaction 전략) |
| PR-1 | sonnet | 설정/툴링 반복 작업 |
| PR-2 | sonnet | 기계적 리팩토링 |
| PR-3 | sonnet | compose + spec 작성 |
| PR-4 | sonnet | 문서 정리 |
