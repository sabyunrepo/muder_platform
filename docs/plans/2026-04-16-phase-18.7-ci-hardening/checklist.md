# Phase 18.7 — Checklist

**Legend:** ⬜ pending · 🟡 in_progress · ✅ completed · ❌ blocked · ⏭ skipped

## Hotfix

- ✅ PR #53 open — fix(ci): goose migration + drift gate for phase-18.1
  - ✅ Go 1.24 → 1.25
  - ✅ goose install + up
  - ✅ migration drift gate (MAX(version_id) vs file count)
  - ✅ seed e2e user + theme
  - ✅ `@mmp/ws-client` 빌드
  - ✅ server log artifact upload
  - ⬜ user 확인 후 main 머지
  - ⬜ 머지 후 `gh workflow run phase-18.1-real-backend.yml` 수동 실행 → green 확인

---

## Wave 1 — Foundation (병렬 2 PR)

### PR-1 `perf(ci): pnpm + Go + Docker 캐시`
- ⬜ worktree `perf/ci-cache` 생성
- ⬜ `ci.yml` ts-check에 pnpm cache
- ⬜ `ci.yml` docker-build에 buildx + gha scope
- ⬜ `actions/cache@v1/v2` 사용처 업그레이드 (search)
- ⬜ 로컬 `make ci-local` 통과
- ⬜ PR 생성 + CI green
- ⬜ 4-reviewer 병렬 리뷰 통과

### PR-2 `chore(repo): Makefile + SHA pinning + harden-runner`
- ⬜ worktree `chore/repo-hardening` 생성
- ⬜ Taskfile.yml vs Makefile 단일화 결정 (조사 결과 기록)
- ⬜ Makefile 신규 타겟: test / migrate / seed / ci-local
- ⬜ 모든 3rd-party action SHA pin (수동 + `pin-github-action` 도구)
- ⬜ 각 워크플로우에 `step-security/harden-runner@SHA` audit 모드 삽입
- ⬜ PR 생성 + CI green
- ⬜ 4-reviewer 병렬 리뷰 통과

### Wave 1 종료
- ⬜ PR-1, PR-2 모두 머지
- ⬜ user 확인 — Wave 2 진입 승인

---

## Wave 2 — Observability & Security (병렬 4 PR)

### PR-3 `feat(ci): coverage upload + regression guard`
- ⬜ worktree `feat/coverage-pipeline`
- ⬜ Go: go tool cover summary + Codecov v5 upload (token 등록 완료)
- ⬜ FE: vitest v8 coverage + vitest-coverage-report-action
- ⬜ base −2%p 가드 (warn-only)
- ⬜ README에 Codecov badge
- ⬜ PR 생성 + Codecov 첫 업로드 확인
- ⬜ 4-reviewer

### PR-4a `security(ci): govulncheck + gitleaks`
- ⬜ worktree `security/fast-feedback`
- ⬜ `.github/workflows/security-fast.yml` 신규
- ⬜ `.gitleaks.toml` 패턴 정의 (codecov token 포함)
- ⬜ PR 피드백 시간 <60s 측정
- ⬜ 4-reviewer

### PR-4b `security(ci): trivy + osv + CodeQL`
- ⬜ worktree `security/sarif-deep`
- ⬜ `.github/workflows/security-deep.yml` 신규
- ⬜ Trivy image scan SARIF
- ⬜ osv-scanner reusable workflow (pnpm + gomod)
- ⬜ CodeQL init + analyze 2 언어
- ⬜ Security tab에 3종 알림 패널 확인
- ⬜ 4-reviewer

### PR-5 `supply-chain(ci): SBOM + provenance`
- ⬜ worktree `supply-chain/sbom-provenance`
- ⬜ anchore/sbom-action CycloneDX
- ⬜ attest-build-provenance docker image
- ⬜ OIDC id-token 권한 설정
- ⬜ `gh attestation verify` 로컬 통과
- ⬜ 4-reviewer

### Wave 2 종료
- ⬜ 4 PR 모두 머지
- ⬜ user 확인 — Wave 3 진입 승인

---

## Wave 3 — E2E Extension (단일 PR)

### PR-6 `test(e2e): shard + firefox + skip 복원`
- ⬜ worktree `test/e2e-shard`
- ⬜ `e2e-stubbed.yml` matrix.shard + matrix.browser
- ⬜ playwright.config.ts projects + blob reporter 분기
- ⬜ merge-reports post-job
- ⬜ Skip 36개 조사 (PLAYWRIGHT_BACKEND gate 6곳 우선)
- ⬜ `.github/workflows/flaky-report.yml` 신규 (주 1회 cron)
- ⬜ CI 총 시간 기존 대비 ≥40% 단축 측정
- ⬜ 4-reviewer

### Wave 3 종료
- ⬜ PR-6 머지
- ⬜ user 확인 — Wave 4 진입 승인

---

## Wave 4 — Dependency Automation (단일 PR)

### PR-7 `chore(deps): Renovate`
- ⬜ worktree `chore/renovate-setup`
- ⬜ `renovate.json` 4 ecosystem (npm/gomod/github-actions/dockerfile)
- ⬜ `prConcurrentLimit: 3` + 보안만 auto-merge
- ⬜ README Renovate badge
- ⬜ Renovate app 설치 확인 (GitHub App)
- ⬜ 24h 내 첫 PR 생성 확인
- ⬜ dashboard issue 확인
- ⬜ 4-reviewer

---

## Phase 완료

- ⬜ 모든 Wave 머지
- ⬜ nightly real-backend 3회 연속 green 확인
- ⬜ `/plan-finish` 실행 → archive
- ⬜ `memory/project_phase187_progress.md` 작성
- ⬜ `MEMORY.md` 인덱스 업데이트
- ⬜ 사후 메모: hardening block 전환(+1주), regression guard enforce(+6주) 일정 리마인더
- ⬜ Codecov token rotate (사용자 수동 작업)

## Stats (예정)

- PR 수: 7 (+1 hotfix)
- Wave 수: 4
- 신규 파일: 7 (`security-fast.yml`, `security-deep.yml`, `flaky-report.yml`, `release.yml`, `.gitleaks.toml`, `renovate.json`, `refs/*.md`)
- 수정 파일: 8+ (workflows 4개, Makefile, Taskfile, Dockerfile, playwright.config, vitest.config)
- 예상 tests 증감: E2E +2x (shard+firefox), Go/FE 유지
