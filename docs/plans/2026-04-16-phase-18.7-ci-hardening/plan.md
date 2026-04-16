# Phase 18.7 — Implementation Plan

## Execution Order

```
Hotfix PR #53 ─→ (merged)
                  │
                  ▼
Wave 1 (parallel, 2 worktrees)
  ├─ PR-1 cache
  └─ PR-2 Makefile + SHA pinning
                  │ merge + user check
                  ▼
Wave 2 (parallel, 4 worktrees)
  ├─ PR-3 coverage
  ├─ PR-4a govulncheck + gitleaks
  ├─ PR-4b trivy + osv + CodeQL
  └─ PR-5 SBOM + provenance
                  │ merge + user check
                  ▼
Wave 3 (single)   ─ PR-6 E2E shard + firefox
                  │ merge + user check
                  ▼
Wave 4 (single)   ─ PR-7 Renovate
                  │
                  ▼
/plan-finish → archive + memory
```

---

## Wave 1 — Foundation

### PR-1 `perf(ci): pnpm + Go + Docker 캐시 재정렬`

**Branch:** `perf/ci-cache`
**Files:** `.github/workflows/ci.yml`, `apps/server/Dockerfile`

**Changes:**
1. `ci.yml` `ts-check` job:
   - `pnpm/action-setup@v5` + `setup-node@v4 cache: 'pnpm'` 추가
2. `ci.yml` `docker-build` job:
   - `docker/setup-buildx-action@v3` + `docker/build-push-action@v6`
   - `cache-from: type=gha,scope=server`
   - `cache-to: type=gha,scope=server,mode=max`
3. `go-check` job: `actions/setup-go@v5`의 내장 cache는 이미 활성 — 변경 없음
4. `actions/cache@v1/v2` 사용처 검색해 v4 upgrade

**검증:** PR 2회차 push 시 pnpm install 1분 → 20초, docker build 4분 → 1분.

---

### PR-2 `chore(repo): Makefile/Taskfile 정리 + SHA pinning + harden-runner`

**Branch:** `chore/repo-hardening`
**Files:** `Makefile`, `Taskfile.yml`, 모든 `.github/workflows/*.yml`

**Changes:**
1. **Taskfile.yml 조사 후 Makefile로 단일화** (또는 반대). 공존 폐기.
2. `Makefile`에 추가 타겟:
   ```makefile
   test: ; cd apps/server && go test -race ./... && cd ../web && pnpm test
   migrate: ; cd apps/server && goose -dir db/migrations postgres "$(DATABASE_URL)" up
   seed:    ; psql "$(DATABASE_URL)" -f apps/server/db/seed/e2e-themes.sql
   ci-local: lint-go lint-web test
   ```
3. 모든 3rd-party action을 SHA pin (예: `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`)
4. 각 워크플로우 첫 스텝에 `step-security/harden-runner@<SHA> # v2.x` **audit 모드**로 추가

**검증:** `make ci-local`로 로컬에서 CI 전 스텝 재현 가능. Security tab → Hardening Runner 감사 로그 확인.

---

## Wave 2 — Observability & Security

### PR-3 `feat(ci): coverage upload + PR summary + regression guard`

**Branch:** `feat/coverage-pipeline`
**Files:** `.github/workflows/ci.yml`, `apps/web/vitest.config.ts`

**Changes:**
1. Go coverage:
   ```yaml
   - run: go test -coverprofile=coverage.out ./...
   - run: go tool cover -func=coverage.out | tail -1
   - uses: codecov/codecov-action@v5
     with:
       files: apps/server/coverage.out
       token: ${{ secrets.CODECOV_TOKEN }}
       flags: backend
   ```
2. Vitest:
   - `vitest.config.ts`: `coverage: { reporter: ['json-summary', 'html'], provider: 'v8' }`
   - `davelosert/vitest-coverage-report-action@v2` PR comment
3. **Regression guard:** base 대비 −2%p 미만 → fail (초기 6주 warn-only, annotation만)

**검증:** PR 본문 하단에 coverage summary 표 자동 생성. Codecov dashboard에 첫 업로드 확인.

---

### PR-4a `security(ci): govulncheck + gitleaks`

**Branch:** `security/fast-feedback`
**Files (new):** `.github/workflows/security-fast.yml`, `.gitleaks.toml`

**Changes:**
1. 별도 워크플로우 `security-fast.yml`:
   - `golang/govulncheck-action@v1` (`go-version-file: apps/server/go.mod`)
   - `gitleaks/gitleaks-action@v2` (`GITHUB_TOKEN` + 커스텀 규칙)
2. `.gitleaks.toml`: NPM token, DB URL creds, JWT secret, Codecov token 패턴
3. 목표: PR 피드백 <60s

---

### PR-4b `security(ci): trivy + osv-scanner + CodeQL`

**Branch:** `security/sarif-deep`
**Files (new):** `.github/workflows/security-deep.yml`

**Changes:**
1. Trivy: `aquasecurity/trivy-action@0.35.0` docker image 스캔 → SARIF
2. osv-scanner: `google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@v2.3.4` (pnpm + gomod)
3. CodeQL: `init@v4` + `analyze@v4` 2 언어 (javascript-typescript, go)
4. 모든 결과 → `github/codeql-action/upload-sarif@v4` → Security tab

**검증:** Settings → Security → Code scanning에 3종 알림 패널 표시.

---

### PR-5 `supply-chain(ci): SBOM + provenance`

**Branch:** `supply-chain/sbom-provenance`
**Files:** `.github/workflows/ci.yml`, 선택적 `.github/workflows/release.yml`

**Changes:**
1. `anchore/sbom-action@v0` → CycloneDX SBOM (pnpm + gomod 각각)
2. `actions/attest-build-provenance@v1` docker image attestation
3. Job permissions:
   ```yaml
   permissions:
     contents: read
     id-token: write
     attestations: write
   ```

**검증:** 릴리스 아티팩트에 SBOM + attestation 첨부. `gh attestation verify` 성공.

---

## Wave 3 — E2E Extension

### PR-6 `test(e2e): shard + firefox matrix + skip 복원`

**Branch:** `test/e2e-shard`
**Files:** `.github/workflows/e2e-stubbed.yml`, `apps/web/playwright.config.ts`, `.github/workflows/flaky-report.yml` (new)

**Changes:**
1. `e2e-stubbed.yml`:
   - `strategy.matrix.shard: [1, 2]`, `strategy.matrix.browser: [chromium, firefox]`
   - `--shard=${{ matrix.shard }}/2 --project=${{ matrix.browser }}`
   - `reporter: blob` (CI 한정) + `merge-reports` job (post)
2. `playwright.config.ts`:
   - `projects: [chromium, firefox]` 추가 (webkit은 phase-18.1로 이동)
   - 환경 분기: `process.env.CI ? 'blob' : 'html'`
3. Skip 복원: PLAYWRIGHT_BACKEND gate 6곳 중 stub으로 수정 가능한 것 우선 조사 → 별도 commit
4. `flaky-report.yml` (신규): 주 1회 `@flaky` 태그 테스트 재시도, issue로 성공률 리포트

---

## Wave 4 — Dependency Automation

### PR-7 `chore(deps): Renovate 설정`

**Branch:** `chore/renovate-setup`
**Files (new):** `renovate.json`

**Changes:**
1. `renovate.json`:
   - `extends: ["config:recommended", ":dependencyDashboard"]`
   - Managers: `npm`(pnpm workspace catalog), `gomod`, `github-actions`, `dockerfile`
   - `prConcurrentLimit: 3` (초기 1주)
   - `packageRules`: 보안 패치 auto-merge, 마이너 group weekly, 메이저 manual
2. Dependabot 설정 안 함
3. README에 Renovate badge

**검증:** 24h 내 Renovate PR 1건 이상, dashboard issue 생성 확인.

---

## Migration/Rollback·Review

- 모든 PR은 feature flag 없이 워크플로우 단위 롤백 가능 (`git revert`)
- PR-2 harden-runner audit → 1주 후 block 전환(별도 PR), PR-3 regression guard warn-only → 6주 후 enforce(별도 PR)
- 각 PR 머지 전 4-parallel 리뷰: security-reviewer / oh-my-claudecode:code-reviewer / test-engineer / docs-navigator. Fix-loop 3회 초과 시 user 개입.
