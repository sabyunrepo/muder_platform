---
phase_id: "phase-22-w1-5-debt-cleanup"
phase_title: "Phase 22 W1.5 — DEBT cleanup + orphan-gate fixture"
created: 2026-04-28
status: "completed (2026-04-30) — PR #167/168/169/170 머지, PR #172 (PR-5 runs-on) outdated close (main이 arc-runner-set 으로 진화)"
parent_phase: "phase-22-runner-containerization"
prerequisite: "PR-167 머지"
prs_estimated: 3
---

# Phase 22 W1.5 — DEBT Cleanup + Orphan-Gate Fixture

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans` 로 task 단위 실행. 모든 PR은 sonnet-4-6 sub-agent 위임.

**Goal**: PR-167 후 잔여 DEBT 2건 + PR-167 4-agent 리뷰 잔여 HIGH 1건 (H-TEST-1) 처리. Phase 22 W2/W3 진입 전 main lint/security 부채 정리.

**근거**: PR-167 (DEBT-1/2/3) 4-agent 리뷰에서 HIGH 4건 발견, 그 중 H-SEC-1 + H-ARCH-1 + H-ARCH-2(disclosure)는 본 PR fold-in. **H-TEST-1 (orphan 시나리오 fixture 부재)** 와 **DEBT-4 (gitleaks)** + **DEBT-5 (govulncheck)** 은 별도 phase.

**Branch prefix**: `chore/w1-5-*` (single-concern 카논 — H-ARCH-2 lesson 반영).

---

## Wave/PR 분해

### PR-8 — runner third-party action 호환 (4 main DEBT 일괄)
- **Effort** S~M, **Impact** Very High (main CI 부채 일괄 해소)
- **branch**: `chore/w1-5-runner-action-compat`
- **근거**: PR-168 (a31af3f) CI 노출 — 3 third-party action 이 containerized runner 의 working dir / Node version / docker.sock permission 와 호환 X. 본 PR fault 아님 (Phase 22 W1 containerization spillover 부채).
- **single-concern 카논 예외**: 4건 모두 단일 root cause (`runs-on: self-hosted` → containerized routing) — 1 PR 묶음 정당화.
- **변경 (정공)**:
  1. **DEBT-1 gitleaks**: `.github/workflows/security-fast.yml` 의 `Run gitleaks` step 에 `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false` env 변경 (artifact upload step rootDirectory 우회). scan 자체 SUCCESS, upload 만 fail 이라 이게 가장 깨끗한 정공.
  2. **DEBT-2 CodeQL JS-TS**: `.github/workflows/security-deep.yml` 의 `codeql` job javascript-typescript matrix 에 setup-node@v4 + `/usr/local/bin` symlink override step 추가 — SHA-pinned v20 binary 를 system PATH 우선 위치에 symlink (CodeQL action 의 spawn child 가 system Node 사용). NodeSource curl|bash 패턴은 RCE 우려로 reject.
  3. **DEBT-3 Trivy**: `.github/workflows/security-deep.yml` 의 `trivy` job 에 docker socket group permission fix step 추가 — runner user 에 `usermod -aG docker` 또는 step-level 에서 `sudo docker buildx` 우회 (PR-168 e2e-stubbed.yml 동일 패턴).
  4. **DEBT-4 Go Lint+Test**: `.github/workflows/ci.yml` 의 `go-check` job services block 제거 → PR-168 `e2e-stubbed.yml` 패턴 재사용 (manual `docker run` + healthcheck wait + cleanup, runners-net network bridge).
- **Phase 23 carry-over**: image base 에 Node v20 + docker group GID 990 사전 install (Custom Image Option A). 본 PR 은 workflow level fix 만.
- **검증**:
  - gitleaks job: SUCCESS (artifact upload skip)
  - CodeQL JS-TS job: SUCCESS (Node v20 으로 `??` syntax 통과)
  - Trivy job: SUCCESS (docker.sock permission 해소)
  - Go Lint+Test job: SUCCESS (manual postgres+redis healthy → migration → test)
- **상세**: `refs/pr-8-runner-action-compat.md` (본 PR 진입 시 작성)

### PR-5 — ci.yml runs-on `[self-hosted, containerized]` 전환
- **Effort** S, **Impact** Med (CI Lint/Test 도 cache 효과)
- **branch**: `chore/w1-5-ci-runs-on`
- **변경**: `.github/workflows/ci.yml` 의 4 job `runs-on` → `[self-hosted, containerized]`
- **의존**: PR-4 머지 + 사용자 SSH 재배포 완료
- **권고**: PR-4 의 효과 측정 후 진행 (1st/2nd run 비교)

### PR-4 — Runner Cache Volume (Playwright/pnpm/Go)
- **Effort** S~M, **Impact** Very High (CI 시간 ~70% 단축)
- **branch**: `chore/w1-5-runner-cache`
- **변경**:
  - `infra/runners/docker-compose.yml`: 2 named cache volume (playwright + hostedtool) + 2 환경변수 (PLAYWRIGHT_BROWSERS_PATH + RUNNER_TOOL_CACHE)
  - `.github/workflows/e2e-stubbed.yml`: fork PR 게이트 추가 (security)
  - 상세: [`refs/pr-4-runner-cache.md`](refs/pr-4-runner-cache.md) — 의존성, H-2 결정 근거, 검증 시뮬
- **사용자 작업** (PR 머지 후): SSH 접속 → `git pull` → 구 volume 제거 → `docker compose up -d`
- **검증**:
  - 1st CI run: 기존과 동일 시간 (cache 빌드)
  - 2nd CI run+: Playwright hit (~30s), pnpm/Go 는 GHA cache 의존
  - `docker volume ls` 에 playwright/hostedtool-cache 2개 생성

### PR-1 — H-TEST-1: e2e-orphan-gate fixture job
- **Effort** S, **Impact** Med (회귀 방어)
- **branch**: `chore/w1-5-orphan-gate`
- **변경**:
  - `.github/workflows/e2e-stubbed.yml` 또는 별도 `.github/workflows/orphan-gate.yml` — 새 job `e2e-orphan-gate`. `Start server` 진입 전 `nc -l 8080 &` 로 포트 점유 후 step 의 ss precheck `exit 1` 경로 검증.
  - 검증: orphan-gate job 자체가 fail 해야 정상 (precheck 가 작동한다는 신호) — workflow 결과는 inverse pass 처리.
- **검증 시뮬**: PR run 의 orphan-gate job 결과가 expected fail (= ss precheck 가 작동) → workflow status 는 별도 마커로 inverse 처리.
- **상세**: [`refs/pr-1-orphan-gate.md`](refs/pr-1-orphan-gate.md) (작성 예정)

### PR-2 — DEBT-4: gitleaks Secret scan 분석
- **Effort** S~M, **Impact** High (security)
- **branch**: `chore/w1-5-gitleaks`
- **변경**:
  - PR-165 CI gitleaks 결과 read → false positive vs real 분류
  - real LEAK 발견 시 즉시 PAT 회전 + `.gitleaks.toml` allowlist 정리
  - `.gitleaks.toml` 누락 패턴 보강
- **검증**: `gitleaks detect --no-banner --redact` 0 LEAK
- **상세**: [`refs/pr-2-gitleaks.md`](refs/pr-2-gitleaks.md) (작성 예정)

### PR-3 — DEBT-5: govulncheck CRITICAL/HIGH CVE 검토
- **Effort** M, **Impact** High (supply chain)
- **branch**: `chore/w1-5-govulncheck`
- **변경**:
  - PR-165 CI govulncheck 결과 read → CRITICAL / HIGH 분류
  - 영향받는 dependency 업그레이드 (`go get -u <pkg>` + `go mod tidy`)
  - 회귀 가능성 있는 major bump 는 별도 PR
  - `govulncheck-allowlist.txt` (필요 시 신규) 에 false positive 등록
- **검증**: `govulncheck ./...` 0 CRITICAL + 0 HIGH (또는 모두 allowlist 등록)
- **상세**: [`refs/pr-3-govulncheck.md`](refs/pr-3-govulncheck.md) (작성 예정)

---

## Out of Scope

- PID file lockfile 정밀화 (cross-kill 정밀 방어) — Phase 22 W3 atomic switch 후 가드 자체 dead code 가능성 → 본 mini-plan 제외, W3 stable 1주 후 sunset 검토 (`refs/wave-3-label-switch.md` 카논)
- Phase 22 W2/W3 자체 작업 — 별도 plan 유지
- PR-164 carry-over 17건 — 별도 PR-11 hygiene phase 그대로

---

## Carry-over (PR-167 review)

PR-167 4-agent 리뷰 잔여:
- **MEDIUM** 6건 (M-SEC-1 TOCTOU / M-PERF-1 sleep 1 always cost / M-ARCH-1 ad-hoc fragmentation / M-ARCH-2 PR-164 lesson / M-TEST-1 bash unit / M-TEST-2 netstat fallback)
- **LOW** 8건

각 항목은 발견 시점 기록만 — 자동 fix 금지. 특정 항목이 회귀 trigger 시 별도 fix PR.

---

## Carry-over (PR-170 review) → Phase 23 escalate

PR-170 4-agent 리뷰 (security/performance/architecture/test) 잔여 — 모두 Phase 23 entry 로 escalate:

### Phase 23 확정 entry (HIGH/MED escalate)

- **[Phase 23] Composite action 추출** (Arch-HIGH-1) — `.github/actions/start-services/action.yml` 작성. ci.yml + e2e-stubbed.yml 의 `Start postgres + redis` step (95% 동일) 보일러플레이트 제거. PR-5 (`runs-on: [self-hosted, containerized]`) 머지 시 사용처 +N 확대 가능 → 그 전에 추출.
- **[Phase 23] Custom Image Option A** (Sec-MED-2 / Test-T-2 / DEBT-2 / DEBT-3 의존) — base image 에 다음 사전 install:
  - Node v20 (DEBT-2 의 setup-node + symlink 자연 해소)
  - docker group GID 990 정착 (DEBT-3 sudo prefix + Test-T-2 testcontainers-go 자연 해소)
  - Playwright + chromium/firefox (E2E 1st run 의존성 0)
  - 결과: PR-170 의 workflow level fix 4건 중 3건 dead code 가능
- **[Phase 23] Trivy scan 이미지 cleanup** (Sec-MED-3) — `mmp-server:security-scan` tag 가 매 run 마다 build → host disk 누적. Trivy job 마지막 step `if: always()` 으로 `sudo docker rmi mmp-server:security-scan` 추가.
- **[Phase 23] gitleaks artifact 복원** (Sec-MED-2) — Custom Image migration 후 검토. real LEAK 발견 시 forensic 위해 별도 SARIF/upload-artifact 메커니즘 검토.

### Phase 22 W3 carry-over (PR-5 의존)

- **[W3] RUNNERS_NET regex 강화** (Sec-MED-1) — `grep -E '(^|_)runners-net$'` 가 `bad_runners-net` 등 악성 네트워크 매칭 가능. PR-168 LOW-1 패턴이 ci.yml 로 확산. compose project prefix 안정화 후 정확 매칭 (`name: runners-net` explicit 만 검증).
- **[W3] e2e-stubbed.yml 의 동일 패턴** — PR-170 fold-in 으로 health-wait 30→60s 동시 상향 했으나 RUNNERS_NET regex 는 둘 다 동일 약점.

### W1.5 PR-170 노출 부채 처리 결과

PR-170 1st CI run 에서 노출된 pre-existing 부채 처리 (사용자 결정 2026-04-29 admin-skip 만료):

- **testcontainers-go (DEBT-4 후속)** — **PR-170 fold-in 완료**.
  - `ci.yml#go-check` 의 `Run tests` step 을 `sudo -E env "PATH=$PATH" go test` 으로 변경 + `Fix coverage.out ownership` step 추가.
  - 정공은 Phase 23 Custom Image base 에 docker group GID 990 정착 — 본 fold-in 은 workflow level forward port.

- **CodeQL JS-TS query OOM (DEBT-2 후속)** — **자동 해소 (관찰만)**.
  - 2nd CI run (`8a772b5` re-run) 에서 SUCCESS. 1st run fail 은 transient (cache miss 또는 일시적 OOM).
  - 재발 시 `--ram=2048` → `4096` 상향 검토 — 별도 PR 후보로 보관.

### Test review 잔여

- **Test-T-2** testcontainers-go 패키지 (`editor`/`auditlog`) 의 docker.sock 접근 — DEBT-3 Phase 23 carry-over 와 동일 root cause. 1st CI run 결과에서 해당 패키지 SUCCESS 확인 필요.

### Performance review 잔여

- **Perf-MED-1** health-wait 30s ceiling — **fold-in 완료** (60s 상향, ci.yml + e2e-stubbed.yml 동시).

---

## 사용자 승인 게이트

다음 진입은 **사용자 명시 승인 후**:
- `/compound-work PR-4` — Runner Cache Volume (가장 시급)
- `/compound-work PR-1` — orphan-gate fixture 구현
- 초안 직접 수정 — Wave/PR 분해 또는 task 단위 조정
- `/compound-cycle` — 본 mini-plan 진행 상태 확인

---

## 검증 (전체 mini-plan 완료 시)

- [ ] PR-1, PR-2, PR-3 머지 완료 (3 commit on main)
- [ ] CI golangci-lint job pass
- [ ] CI gitleaks job 0 LEAK
- [ ] CI govulncheck job 0 CRITICAL + 0 HIGH
- [ ] e2e-orphan-gate job: 정기 run 에서 inverse-pass (precheck 작동 확인)
- [ ] admin-skip 정책 만료 검토 (`memory/project_ci_admin_skip_until_2026-05-01.md`)

---

## 카논 ref

- 부모 plan: `docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md`
- PR-167 review: `docs/plans/2026-04-28-phase-22-runner-containerization/refs/reviews/PR-167.md`
- 4-agent 리뷰 강제: `memory/feedback_4agent_review_before_admin_merge.md`
- single-concern branch: `memory/feedback_branch_pr_workflow.md`
- admin-skip 정책: `memory/project_ci_admin_skip_until_2026-05-01.md`
- Sonnet 4.6 sub-agent: `memory/feedback_sonnet_46_default.md`
