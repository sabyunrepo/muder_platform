---
topic: "PR-170 runner third-party action 호환 (4 main DEBT 일괄) + admin-skip 만료 + pre-existing 부채 fold-in 5건"
phase: "Phase 22 W1.5"
prs_touched: [PR-#170 (chore/w1-5-runner-action-compat)]
session_date: 2026-04-29
---

# Session Handoff: PR-170 정공 fix + admin-skip 정책 만료

## Decided

- **PR-170 진입** (`chore/w1-5-runner-action-compat`) — 4 main DEBT 일괄 처리 정공
  - DEBT-1 gitleaks: `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false`
  - DEBT-2 CodeQL JS-TS: setup-node@v4 + `/usr/local/bin/node` symlink (NodeSource curl|bash 패턴 reject — RCE 우려)
  - DEBT-3 Trivy: 1차 (sudo docker build + image-ref) fail → 2차 정공 (docker save tarball + trivy-action `input:` mode)
  - DEBT-4 Go Lint+Test services: PR-168 `e2e-stubbed.yml` 패턴 (manual `sudo docker run` + healthcheck wait + cleanup)

- **admin-skip 정책 즉시 만료** (사용자 결정 2026-04-29) — main DEBT 5건 모두 해소 + PR-170 으로 정상 머지 모드 복귀
  - `memory/project_ci_admin_skip_until_2026-05-01.md` → `expired_2026-04-29.md` rename + 만료 사유 갱신
  - MEMORY.md 인덱스 갱신
  - 이후 PR 머지: `gh pr merge --squash` (admin 권한 사용 X)

- **PR-170 fold-in 9건** — admin-skip 만료 결정 후 PR-170 자체가 ALL pass 필요 → pre-existing 부채 노출 시 별도 PR 분리 대신 본 PR fold-in
  1. 4-agent review fold-in: health-wait ceiling 30s → 60s (ci.yml + e2e-stubbed.yml 일관성)
  2. testcontainers-go: `sudo -E env "PATH=$PATH" go test` + `chown coverage.out` step
  3. CodeQL JS-TS query OOM: `--ram=2048` → `4096` (init + analyze 둘 다)
  4. Docker Build Check: `setup-buildx-action` + `build-push-action` 제거 → manual `sudo docker build` (digest 추출 + tarball export)
  5. SBOM: `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` (PR run skip)
  6. Coverage Regression Guard: `sudo apt-get install -y jq` 사전 step
  7. govulncheck timeout: 5 → 10분
  8. Spec drift 갱신 (`pr-8-runner-action-compat.md` + `checklist.md`)
  9. 4-agent review 4 파일 worktree 보존 (PR-170-{security,performance,arch,test}.md)

- **4-agent 병렬 review 완료** (사용자 카논 `feedback_4agent_review_before_admin_merge.md`):
  - Security (sonnet-4-6): conditional, HIGH 0, MED 3 → 모두 Phase 23 carry-over
  - Performance (sonnet-4-6): conditional, HIGH 0, MED 1 → fold-in (health-wait)
  - Architecture (opus-4-7): conditional pass, HIGH 1, MED 4 → composite action 추출 escalate (PR-5 머지 전)
  - Test (sonnet-4-6): conditional, HIGH 1 → fold-in (health-wait, perf 와 공통). T-2 (testcontainers-go) → fold-in 으로 처리

- **PR-170 정상 머지** (commit ?? on main, gh pr merge --squash) — admin-skip 만료 후 첫 정상 머지 (admin 권한 X)

## Discovered

- **🚨 Pre-existing 부채 노출 패턴** — services block 등 1차 차단 fix 시 hidden 부채 표면화:
  - DEBT-4 services 통과 → testcontainers-go (`internal/auditlog`, `internal/editor`) 가 host docker.sock 직접 접근 → permission denied 노출
  - go-check 통과 → Docker Build Check 가 실행 → `setup-buildx` docker.sock permission denied
  - go-check 통과 → Coverage Regression Guard 실행 → `jq` 명령 부재 (exit 127)
  - 일정 시간 cancel → govulncheck 5분 timeout 부족 → cache miss 시 cancelled
  - 1st CodeQL run pass (transient) → 2nd run OOM reproducible (cache state 차이)

- **사용자 host bare-host runner 발견** — `/home/sabyun/actions-runner/_work/...` 경로 등장. 4 containerized runner 외 추가 self-hosted runner 등록 가능성. Coverage Regression Guard 가 그 runner 로 routing 된 것으로 추정 — jq 부재 노출.

- **Trivy action root cause 깊이** — `aquasecurity/trivy-action@0.35.0` 이 trivy CLI 로 image scan 시 host docker.sock 직접 접근. `sudo docker build` 만으로는 부족, `docker save` + `input:` (tarball mode) 가 정공.

- **Go module cache 누락** (사용자 직접 관찰) — `infra-runners/docker-compose.yml` 의 named volume 이 Playwright + hostedtool 만 mapping. `~/go/pkg/mod` + `~/.cache/go-build` + `~/.local/share/pnpm/store` 매핑 부재 → 매 컨테이너 재시작마다 cache reset → 매 PR run 마다 Go module 재다운로드.

- **CodeQL `--ram` 파라미터 위치** — `init` 과 `analyze` 둘 다 명시 필요. `init` 만 명시 시 `analyze` 단계는 default 2048 사용.

- **NodeSource curl|bash 패턴 reject** (자동 보안 차단) — `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -` 가 자동으로 차단됨 ("RCE 패턴 도입"). `setup-node@v4` 의 SHA-pinned binary + symlink 으로 우회.

## Rejected

- ~~NodeSource apt repo 직접 install (`curl | sudo bash`)~~ — RCE 패턴, supply chain 표면 ↑. setup-node@v4 + symlink 으로 동일 효과 + 안전.
- ~~docker/build-push-action GHA cache (type=gha) 유지~~ — Trivy + Docker Build Check 모두 1회용 image. cache 무가치.
- ~~PR-9/PR-10 별도 PR 분리~~ — 사용자 admin-skip 즉시 만료 결정 → PR-170 자체 ALL pass 필요. fold-in 으로 통합.
- ~~`if: false` Diagnostic step 비활성~~ (PR-168 시점) — git log 잔존 + readability 손해.

## Risks

- **Phase 23 carry-over 5건** — Custom Image (Option A) 가 Node v20 + docker group GID 990 + Playwright + jq 사전 install 시 본 PR fold-in 4건 자연 해소.
- **Go cache 비효율** — 사용자 host docker-compose.yml 변경 (named volume 추가) + 재배포 필요. 별도 PR (W1.5 PR-11 후보).
- **govulncheck 10분 timeout 도** cache cold start 시 타이트. Phase 23 Custom Image 후 5분 환원 가능성.
- **bare-host runner 가시성 부족** — `/home/sabyun/actions-runner/` 경로 노출됐으나 host 의 self-hosted runner 등록 상태 미확인. infra-runners 와 별개 runner 면 정책 통일 필요.

## Files

### `chore/w1-5-runner-action-compat` 누적 commit (14 commit + 1 update-branch)

| commit | 내용 |
|--------|------|
| `dc7d1e8` | docs: PR-8 spec |
| `5be282a` | DEBT-1 gitleaks |
| `fd227f9` | DEBT-2 CodeQL Node v20 + DEBT-3 Trivy 1차 (실패) |
| `e2106ad` | DEBT-4 services block |
| `7a104f7` | fold-in: 4-agent review carry-over + health-wait 60s |
| `99ba252` | DEBT-3 hotfix: Trivy tarball mode |
| `8a772b5` | docs: 1st CI 결과 + PR-9/PR-10 후보 |
| `ce1fa62` | testcontainers-go fold-in + admin-skip 만료 + 4-agent review 보존 |
| `46b269b` | CodeQL ram=4096 |
| `4c7e8ca` | Docker Build sudo docker fold-in |
| `fe425b6` | SBOM main-push only |
| `8ce9c0b` | Coverage Guard jq install |
| `3c844eb` | govulncheck timeout 10분 |
| `update-branch` | main의 #171 (ebab2b0 docs/memory canon) merge in |

### main 추가 (PR-170 머지 전 1건)

- `ebab2b0` PR #171 (docs/memory): 코딩 작업 수행 규율 카논 추가 — PR-170 update-branch 시 head 비호환 노출 → resolve

## Remaining

### 다음 세션 P0
- **PR-170 머지 완료 후 wrap-up**:
  - ✅ 핸드오프 노트 (이 파일)
  - MEMORY.md entry 추가
  - worktree cleanup (`git worktree remove ../muder_platform.wt/w1-5-runner-action-compat`)
  - main pull
- **Go module + pnpm cache named volume** (사용자 직접 관찰, P1):
  - `infra-runners/docker-compose.yml` 추가 매핑 (`~/go/pkg/mod`, `~/.cache/go-build`, `~/.local/share/pnpm/store`)
  - 사용자 host 재배포
  - W1.5 mini-plan PR-11 후보 등록

### W1.5 mini-plan 잔여
- **PR-1** orphan-gate fixture (H-TEST-1) — `chore/w1-5-orphan-gate`
- **PR-2** DEBT-4 gitleaks Secret scan 분석
- **PR-3** DEBT-5 govulncheck CRITICAL/HIGH CVE 검토
- **PR-5** ci.yml runs-on `[self-hosted, containerized]` + fork PR 게이트
- **PR-7** host git clone 절차 (Test-T-5 docker compose config fixture)
- **PR-11** Go module + pnpm cache named volume (신규 후보)

### Phase 22 W3 carry-over
- **RUNNERS_NET dynamic detection cleanup** — explicit `name: runners-net` host 안정화 1주 후
- **services: block 복귀 검토** — myoung34/github-runner upstream fix 시점
- **RUNNERS_NET regex 강화** (Sec MED-1) — `bad_runners-net` 매칭 가능 (PR-168 LOW-1 + PR-170 ci.yml 확산)

### Phase 23 carry-over (확정 escalate)
- **Custom Image (Option A)** — base image 사전 install:
  - Node v20 → DEBT-2 setup-node + symlink dead code
  - docker group GID 990 → DEBT-3 sudo docker + testcontainers-go fold-in dead code
  - Playwright → 1st run cache build 0
  - jq → Coverage Guard fold-in dead code
  - govulncheck → fold-in timeout 환원 가능
- **Composite action** `.github/actions/start-services/action.yml` (Arch HIGH-1) — ci.yml + e2e-stubbed.yml 95% 보일러플레이트 추출. PR-5 머지 전 우선.
- **Trivy scan 이미지 cleanup** (Sec MED-3) — `if: always() sudo docker rmi mmp-server:security-scan`
- **gitleaks artifact 복원** (Sec MED-2) — Custom Image migration 후

## Next Session Priorities

1. **P0** 머지 완료 확인 → worktree cleanup + main pull
2. **P0** Go module + pnpm cache named volume 추가 (W1.5 PR-11) — 사용자 직접 관찰
3. **P1** W1.5 PR-1 (orphan-gate fixture, H-TEST-1)
4. **P1** Phase 23 entry — Custom Image (Option A) plan 작성 — fold-in 4건 자연 해소 가치
5. **P2** W1.5 PR-5 (ci.yml runs-on containerized + fork gate)
6. **P2** W1.5 PR-7 (host git clone 절차)
7. **P3** Phase 22 W3 RUNNERS_NET cleanup

## What we did

이전 세션 (`2026-04-29-pr-168-fold-in-shellcheck-cascade.md`) 의 PR-170 진입 신호 받고 시작. 사용자 host SSH 재배포 검증 후 4 main DEBT 일괄 처리 PR-170 (`chore/w1-5-runner-action-compat`) 분기.

4 DEBT 정공 fix 구현 (1 commit per DEBT) + 4-agent 병렬 review (sec/perf/arch/test, sonnet+opus). Review 결과:
- Performance MED-1 + Test HIGH-1 (공통 health-wait 30s ceiling) → fold-in (60s 상향)
- Architecture HIGH-1 (보일러플레이트 95%) → Phase 23 carry-over escalate
- Security/Architecture MED 다수 → Phase 23 carry-over

1st CI run 에서 DEBT-3 (Trivy) FAILURE — `aquasecurity/trivy-action` 자체가 docker.sock 접근. 2차 정공 (docker save tarball + `input:` mode) hotfix 으로 해소.

사용자 결정: **admin-skip 정책 즉시 만료 + pre-existing 부채 즉시 fix** — testcontainers-go 부채 (Test review T-2 risk) 별도 PR-9 분리 대신 PR-170 fold-in 으로 통합. 이후 후속 fail 노출 → 순차 fold-in (CodeQL OOM, Docker Build sudo, SBOM main-push only, Coverage jq, govulncheck timeout).

각 fold-in 마다 CI 재실행 → 새 fail 노출 → 다음 fold-in. 14 commit 누적 후 ALL CHECKS PASS.

main 의 새 PR #171 (`ebab2b0` docs/memory canon) 머지로 head not up-to-date → `gh pr update-branch 170` 으로 main merge in. 12 check 재실행. 

CI 통과 확인 후 정상 머지 (`gh pr merge --squash --delete-branch`, admin 없이) — admin-skip 만료 후 첫 정상 머지.

## What blocked us

- **Trivy action 의 docker.sock 의존** — 1차 sudo docker build 만으로 부족. trivy CLI 가 image inspect 시 socket 접근 — 진단 후 tarball mode (input:) 로 우회.
- **순차 부채 노출** — 각 fix 통과 시마다 다음 layer 의 fail 노출. 5 fold-in 누적.
- **NodeSource curl|bash 자동 차단** — RCE 패턴 자동 차단 (보안 정당). setup-node@v4 + symlink 으로 회피.
- **CodeQL 1st run pass 가 transient** — 2nd run reproducible OOM. ce1fa62 push 시점에 와서야 fail 노출.
- **head not up-to-date** — main 의 PR #171 머지 → update-branch 후 12 check 재실행. cache hit 으로 빠른 결과.

## Next session 첫 5초

- **메인의 첫 read**: 이 파일 (`memory/sessions/2026-04-29-pr-170-runner-action-compat-admin-skip-expiry.md` — 가장 최근 mtime)
- **첫 액션 후보**:
  1. PR-170 머지 검증 — `git log main --oneline -5` 으로 squash commit 확인
  2. worktree cleanup — `git worktree remove ../muder_platform.wt/w1-5-runner-action-compat` (이미 완료 가능성)
  3. Go module + pnpm cache named volume PR-11 진입 (사용자 직접 관찰 부채)
  4. W1.5 PR-1 (orphan-gate fixture) 진입
- **참고할 카논**:
  - `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md` (mini-plan, PR-9/PR-10 → PR-170 fold-in 통합)
  - `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/pr-8-runner-action-compat.md` (PR-170 spec + 1st CI run 결과)
  - `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/reviews/PR-170-{security,performance,arch,test}.md` (4-agent 4 파일)
  - `memory/project_ci_admin_skip_expired_2026-04-29.md` (만료 사유 + 정상 머지 모드 복귀)
  - `memory/feedback_4agent_review_before_admin_merge.md` (강제 정책)
  - `memory/feedback_branch_pr_workflow.md` (single-concern 카논 + 예외 정당화 case)
