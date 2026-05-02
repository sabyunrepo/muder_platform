---
topic: "Phase 22 W1 완료 + ci.yml hotfix + admin-skip 정책 reverse + DEBT 5 catalog"
phase: "Phase 22 W1"
prs_touched: [PR-#165, PR-#166]
session_date: 2026-04-28
---

# Session Handoff: Phase 22 W1 완료 + ci.yml hotfix + admin-skip 정책 reverse

## Decided

- **Phase 22 W1 (PR #165)** infra/runners/ 4 파일 + spec 234줄 + plan 1,197줄 + reviews/PR-1.md (109줄) → main `58caa33` (admin-merge, admin-skip 사용)
- **ci.yml workflow file issue 해소 (PR #166)** PR-164에서 도입한 `${{ job.services.X.ports['Y'] }}`가 job-level env 사용 불가 → 첫 step에서 `GITHUB_ENV` export로 이동. ci.yml + e2e-stubbed.yml 2 파일, 4 line → main `a4d2b4c` (admin-merge)
- **runner pool 가동** SSH 100.90.38.7 (Linux Ubuntu 31GB, Docker 29.1.3) → `~/infra/runners/` 4 컨테이너 ephemeral pool 부팅. GH 등록 5대 (기존 sabyun 1 + 신규 containerized-runner-1~4 4)
- **admin-skip 정책 reverse** 2026-04-28 D-3 만료 결정 후 PR-166/165에서 main 누적 부채 5건 노출 → 정책 연장 (DEBT 정리 phase 완료까지)
- **PR-165 4-agent review HIGH 6 cluster 모두 fold-in** image digest pinning + restart loop README + LABELS precedence 주석 + PAT blast radius README + Task 5 grep multi-line + DOCKER_GID 음성 확인 (commit `957b8ed`)
- **repo owner hotfix** sanghoon-pyun → sabyunrepo, 5 location (commit `40fa7f8`)
- **README docker pull bootstrap step + Linux stat -c 분기** (commit `d19abf7`)

## Rejected

- ~~admin-skip 즉시 만료~~ — 누적 부채 5건 검증 후 reverse
- ~~PR-166에 lint fix fold-in~~ — scope creep 회피, 별도 phase
- ~~stale runner 진단 결과 호스트에 actions-runner 0건~~ — 잘못된 진단 (Claude는 macOS에서 봤지만 실제 runner는 Linux 100.90.38.7)
- ~~classic PAT~~ — fine-grained PAT 90자+ 기본 (사용자가 처음 placeholder 28자 입력 → "Invalid configuration" 후 진짜 PAT 발급)

## Risks

- **DEBT 5건 main 정리 지연** — admin-skip 가린 상태. 다음 세션 P0 처리 안 하면 4-agent review 의미 무효화
- **PAT 만료 detection 자동화 없음** — README 30일 수동 회전 + Troubleshooting 1단락만. PAT 만료 시 4 컨테이너 동시 restart loop
- **W2 smoke workflow 미실행** — W3 atomic switch 전 회귀 가드 latency
- **Linux/macOS 환경 분기** spec/plan은 macOS 가정. 실제 runner Linux. 추후 spec drift 정리 필요
- **graphify-out 변경 미커밋** — 정책 D 유지

## Files

### main 머지 (PR #165 + #166, 13 files / +1,765 line)
- `.github/workflows/ci.yml` (+11/-3, env GITHUB_ENV export)
- `.github/workflows/e2e-stubbed.yml` (+9/-2, env GITHUB_ENV export)
- `infra/runners/{docker-compose.yml(76줄), .env.example(20줄), .gitignore(2줄), README.md(91줄)}`
- `docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md` (234줄)
- `docs/plans/2026-04-28-phase-22-runner-containerization/{checklist.md(207줄), refs/{wave-1(384줄), wave-2(190줄), wave-3(250줄), wave-4(187줄), reviews/PR-1.md(109줄)}}`

### 이번 wrap (메모리)
- `memory/project_ci_admin_skip_until_2026-05-01.md` (만료 → 연장)
- `memory/MEMORY.md` (admin-skip entry 갱신 + Phase 22 W1 entry 추가)
- `memory/QUESTIONS.md` (Q-runner-w3-fallback + Q-pat-rotation-automation + Q-graphify-wrap-update append)
- `memory/sessions/2026-04-28-phase-22-w1-complete.md` (이 파일)
- (사용자 승인 시) `memory/MISTAKES.md` (M-A actionlint dead zone + M-B spec env 가정 + M-C worktree carve-out 부재)

## Remaining

### DEBT 5건 (다음 세션 P0)
- **DEBT-1** Go gofmt 3 file (`handler_start_test:101`, `envelope_catalog_system:30`, `hub:7`) → `gofmt -w` 1줄
- **DEBT-2** Go staticcheck S1025 `text_chat_test:313` → `string(data)` 1 line edit
- **DEBT-3** E2E backend `/api/v1/auth/register` HTTP 500 (4 shard 모두 fail, "failed to check existing user") → handler/DB schema 진단 필요
- **DEBT-4** gitleaks Secret scan 결과 분석 + 유출 시 PAT 즉시 회전
- **DEBT-5** govulncheck CRITICAL/HIGH CVE 검토

### Phase 22 후속
- **W2** smoke workflow `ci-containerized-smoke.yml` (smoke + bash 3.2 docker run inline)
- **W3** atomic switch (모든 workflow `runs-on` → `[self-hosted, containerized]`) — sister sabyun runner fallback 정책 결정 후 (Q-runner-w3-fallback)
- **W4** host runner deregister + archive (1주 stable 후)

### 누적 carry-over
- PR-1 review MED 8건 + LOW 8건 (`refs/reviews/PR-1.md`)
- PR-164 carry-over 17건 (spec §11)
- → 통합 PR-11 hygiene phase

## Next Session Priorities

1. **P0 DEBT-3 진단** — E2E register 500 root cause (handler logic? DB schema drift? migration?). Done: 4 shard E2E green
2. **P1 DEBT-4/5 분석** — security scan 결과 분류 (false positive vs real). Done: gitleaks 0 LEAK + govulncheck CRITICAL 0
3. **P1 DEBT-1+2 fix** — `gofmt -w` + 1 line edit, 단일 commit. Done: golangci-lint pass
4. **P1 Phase 22 W2 진입** — smoke workflow PR. Done: 1회 green run on containerized runner
5. **(병행) admin-skip 만료** — 위 4건 정리 후 정상 머지 모드 복귀

## What we did



### CI workflow file issue 진단 + hotfix
사용자 발화 "워커가 잡 픽업 안 하는 것 같다" → CI 폴링 + actionlint detect: `${{ job.services.X.ports['Y'] }}` job-level env 사용 불가 (PR-164 회귀, main 1주 broken). fix branch `fix/ci-job-env-context` (PR #166) 첫 step `Export service connection env`로 GITHUB_ENV export 이동. CI 정상 trigger 확인 (이전 0s fail → 9m53s 실행).

### runner pool 부팅
사용자 SSH 권한 부여 → Linux Ubuntu host 진단. ~/actions-runner 정상 동작 확인 (이전 macOS 검색이 잘못된 진단). SCP 4 파일 (권한 1차 거부 후 명시 승인) → 사용자 PAT 발급 후 docker compose up. image pull (digest pinning + pull_policy: never로 첫 boot manual pull 필수) → 4 컨테이너 등록 완료.

### 누적 부채 노출 + 정책 reverse
PR-166 admin-merge 후 main 정상화. PR-165 CI 결과로 DEBT 5건 노출 (Go lint, E2E register 500, gitleaks/govulncheck). admin-skip 만료 결정 reverse → 부채 정리 phase까지 연장. PR-165도 admin-skip 사용 머지.

## What blocked us

- runner stale 진단 잘못 (macOS에서 ~/actions-runner 검색 → Linux 호스트 미인지)
- SSH 작업 권한 거부 2회 (SCP, .env heredoc) — 사용자 명시 승인 필요
- 사용자 PAT placeholder 28자 입력 → "Invalid configuration provided for token" → 진짜 PAT 90자 발급 필요
- ci.yml/e2e-stubbed.yml workflow file issue 진단 시간 (admin-skip 가린 PR-164 회귀)

## Next session 첫 5초

- **메인의 첫 read**: 이 파일 (`memory/sessions/2026-04-28-phase-22-w1-complete.md` — 가장 최근 mtime)
- **첫 액션 후보**:
  1. DEBT-3 E2E register 500 진단 (Go server log + handler 추적)
  2. DEBT-4/5 security scan 결과 분류
  3. DEBT-1+2 lint fix 단일 commit
- **참고할 카논**:
  - `docs/plans/2026-04-28-phase-22-runner-containerization/refs/reviews/PR-1.md` (4-agent HIGH 6 cluster 해소 기록)
  - `memory/project_ci_admin_skip_until_2026-05-01.md` (정책 연장)
  - `memory/feedback_explanation_style.md` (사용자 설명 형식)
  - `infra/runners/README.md` (runner 운영 절차 — Linux stat -c, 1Password CLI, PAT 회전)
