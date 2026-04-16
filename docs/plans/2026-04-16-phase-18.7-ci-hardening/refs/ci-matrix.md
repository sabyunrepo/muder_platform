# CI Workflow Matrix — Post Phase 18.7

Phase 18.7 완료 후 `.github/workflows/`의 **기능·트리거·소요·필수 여부** 매트릭스.

## 트리거 매트릭스

| 워크플로우 | PR | push main | nightly cron | manual | paths filter |
|-----------|:--:|:---------:|:------------:|:------:|:------------:|
| `ci.yml` | ✅ | ✅ | — | ✅ | — |
| `e2e-stubbed.yml` | ✅ | ✅ | — | ✅ | — |
| `module-isolation.yml` | ✅ | — | — | — | server/internal/module, engine |
| `phase-18.1-real-backend.yml` | — | — | ✅ 02:00 UTC | ✅ | — |
| `security-fast.yml` *(new)* | ✅ | ✅ | — | ✅ | — |
| `security-deep.yml` *(new)* | — | ✅ | ✅ 04:00 UTC | ✅ | — |
| `flaky-report.yml` *(new)* | — | — | ✅ 월요일 | ✅ | — |
| `release.yml` *(선택)* | — | tag `v*` | — | ✅ | — |

## 역할 매트릭스

| 워크플로우 | Go test | TS test | Lint | Build | Docker | E2E | Coverage | Security | SBOM |
|-----------|:-------:|:-------:|:----:|:-----:|:------:|:---:|:--------:|:--------:|:----:|
| `ci.yml` | ✅ race | ✅ vitest | ✅ | ✅ | ✅ buildx | — | ✅ upload | — | ✅ |
| `e2e-stubbed.yml` | — | — | — | ✅ server | — | ✅ chromium+firefox shard | — | — | — |
| `module-isolation.yml` | ✅ mod scope | — | — | — | — | ✅ smoke | — | — | — |
| `phase-18.1-real-backend.yml` | — | — | — | ✅ server | — | ✅ webkit nightly | — | — | — |
| `security-fast.yml` | — | — | — | — | — | — | — | ✅ govulncheck+gitleaks | — |
| `security-deep.yml` | — | — | — | — | — | — | — | ✅ trivy+osv+CodeQL | — |
| `flaky-report.yml` | — | — | — | — | — | ✅ retry | — | — | — |

## 필수 PR 체크 (머지 게이트)

PR 머지 전 반드시 green이어야 하는 체크:

1. `ci.yml / go-check`
2. `ci.yml / ts-check`
3. `ci.yml / docker-build`
4. `e2e-stubbed.yml / e2e-stubbed (chromium shard 1,2)`
5. `e2e-stubbed.yml / e2e-stubbed (firefox shard 1,2)`
6. `e2e-stubbed.yml / merge-reports`
7. `security-fast.yml / govulncheck`
8. `security-fast.yml / gitleaks`
9. `module-isolation.yml` (paths 적중 시)

Non-blocking (informational):
- `security-deep.yml` (HIGH/CRITICAL만 block, LOW/MEDIUM은 알림)
- `phase-18.1-real-backend.yml` (nightly — PR과 독립)
- `flaky-report.yml` (주간 통계)

## 실행 시간 목표 (Phase 18.7 완료 후)

| 워크플로우 | 현재 (Pre) | 목표 (Post) | 감소율 |
|-----------|:---------:|:-----------:|:------:|
| `ci.yml` | ~8분 | ~5분 | 38% |
| `e2e-stubbed.yml` | ~10분 | ~6분 (shard=2) | 40% |
| `security-fast.yml` | — | <60s | — |
| `security-deep.yml` | — | ~5분 | — |
| `phase-18.1-real-backend.yml` | FAILURE | ~12분 | — |

## 캐시 스코프 매트릭스 (GHA cache 10GB 한도)

| scope | 사용처 | 예상 용량 |
|-------|-------|----------|
| `pnpm` (setup-node 내장) | 모든 TS job | ~400MB |
| `go-mod` (setup-go 내장) | 모든 Go job | ~300MB |
| `server` (buildx) | ci.yml docker-build | ~1GB |
| `playwright-browsers` (manual) | e2e workflows | ~600MB |

총 예상 2.3GB — 10GB 한도 내.

## 권한 매트릭스 (최소 권한 원칙)

| 워크플로우 | contents | id-token | security-events | pull-requests | attestations |
|-----------|:--------:|:--------:|:---------------:|:-------------:|:------------:|
| `ci.yml` | read | write (PR-5) | — | write (coverage comment) | write (PR-5) |
| `security-deep.yml` | read | — | write | — | — |
| `security-fast.yml` | read | — | — | write (gitleaks PR comment) | — |
| `release.yml` | write (tag) | write | — | — | write |
| 나머지 | read | — | — | — | — |
