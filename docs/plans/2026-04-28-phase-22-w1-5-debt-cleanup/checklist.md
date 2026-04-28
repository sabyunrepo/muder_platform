---
phase_id: "phase-22-w1-5-debt-cleanup"
phase_title: "Phase 22 W1.5 — DEBT cleanup + orphan-gate fixture"
created: 2026-04-28
status: "draft (PR-167 머지 후 진입)"
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

### PR-4 — Runner Cache Volume (Playwright/pnpm/Go)
- **Effort** S~M, **Impact** Very High (CI 시간 ~70% 단축)
- **branch**: `chore/w1-5-runner-cache`
- **변경**:
  - `infra/runners/docker-compose.yml`: 4 named cache volume 추가 (playwright/pnpm/go/hostedtool) + 4 환경변수 명시 (PLAYWRIGHT_BROWSERS_PATH 등)
  - `infra/runners/README.md`: Cache Volumes 섹션 추가 + 사용자 SSH 재배포 절차
- **사용자 작업** (PR 머지 후): SSH 접속 → `git pull` → `docker compose up -d --force-recreate`
- **검증**:
  - 1st CI run: 기존과 동일 시간 (cache 빌드)
  - 2nd CI run+: setup 단계 ~30s 이하 (cache hit)
  - `docker volume ls` 에 playwright/pnpm/go/hostedtool-cache 4개 생성
- **상세**: [`refs/pr-4-runner-cache.md`](refs/pr-4-runner-cache.md) (작성 예정 — 본 PR 머지 후)

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
