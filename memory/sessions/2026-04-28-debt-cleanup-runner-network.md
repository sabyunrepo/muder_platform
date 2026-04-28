---
topic: "DEBT cleanup PR-167 머지 + PR-168 (Runner Cache + service container fix) + PR-169 (Stop hook schema)"
phase: "Phase 22 W1.5"
prs_touched: [PR-#167, PR-#168, PR-#169]
session_date: 2026-04-28
---

# Session Handoff: DEBT cleanup + Runner Network Migration + Hook Schema Fix

## Decided

- **PR-167 admin-merge** (`6fa7460` on main) — DEBT-1 (gofmt 4 file) + DEBT-2 (text_chat_test.go S1025) + DEBT-3 (E2E orphan listener guard) + 4-agent HIGH 4건 fold-in (H-1/H-2/H-4/H-5 commit `dddf2d5` + W3 partial migration `30a263d`)
- **PR-168 진행 중** (`chore/w1-5-runner-cache`, 6 commits) — Phase 22 W1.5 PR-4 Runner Cache Volume + service container init bug fix + RUNNERS_NET 동적 검출. CI 25062718727 in_progress (firefox shard 1)
- **PR-169 admin-merge** (`35f8e0e` on main) — Stop hook 스키마 위반 fix (hookSpecificOutput → systemMessage)
- **사용자 host SSH 재배포 완료** — `~/infra-runners/docker-compose.yml` 의 `name: runners-net` 적용 (commit `6d5a71d`). 4 containerized-runner-1~4 정상 idle
- **PAT 노출 발견 + 회전 안내** — `docker compose config` 출력에 PAT 그대로 노출. 사용자 회전 권고 (이전 conversation 에 잔존)
- **W3 partial migration** (`e2e-stubbed.yml runs-on: [self-hosted, containerized]`) — sabyun host runner 의 dev compose `:8080` 충돌 회피용

## Rejected

- ~~PR-168 cache volume 4종 (Playwright/pnpm/Go/hostedtool)~~ — H-2 fold-in 으로 pnpm-cache/go-cache 제거. setup-go/setup-node 의 GHA cache 와 충돌. 최종 2 cache (playwright + hostedtool) 만 유지
- ~~SSH 직접 host orphan kill~~ — Auto mode permission 거부, 사용자 수동 SSH 로 진단 + 재배포
- ~~services: block 유지~~ — myoung34/github-runner ↔ GH Actions service container 호환 부재. workflow step 의 docker run 으로 우회 (`runners-net` bridge 공유)
- ~~hardcoded `--network runners-net`~~ — host 의 실제 이름 (`runners-net` 또는 `infra-runners_runners-net`) 양쪽 매칭 위해 동적 검출

## Risks

- **PR-168 CI 진행 중 상태로 세션 종료** — 다음 세션 첫 작업: CI 결과 polling + admin-merge 결정 (`gh run list --branch=chore/w1-5-runner-cache`)
- **PAT 노출 미회전 시 token leak risk** — 다음 세션 첫 작업으로 회전 검증 필요
- **host `~/infra-runners` 가 git repo 아님** — 사용자 manual sync. PR 머지 시 자동 동기화 안 됨. W1.5 PR-7 후보 (Task #19)
- **ci.yml 4 job runs-on 미전환** — H-3 (PR-168 4-agent review) carry-over → W1.5 PR-5 별도. dev compose 가 :8080 점유 시 collision 잠재

## Files

### main 머지 (PR-167 + PR-169, 7 files / +302/-37)
- `apps/server/internal/domain/room/handler_start_test.go` (-1) — gofmt
- `apps/server/internal/ws/{envelope_catalog_system.go,hub.go,catalog_stats_test.go}` — gofmt
- `apps/server/internal/module/communication/text_chat_test.go` (+1/-1) — S1025
- `.github/workflows/e2e-stubbed.yml` (+35/-3) — Start server + W3 partial
- `docs/plans/2026-04-28-phase-22-runner-containerization/refs/reviews/PR-167.md` (+116)
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md` (+102) — W1.5 mini-plan 신설
- `.claude/plugins/compound-mmp/hooks/stop-wrap-reminder.sh` (+2/-1) — PR-169

### PR-168 진행 중 (`chore/w1-5-runner-cache`, 8 commits, +380/-75)
- `c3f68c5` 초기 PR-4 (4 cache volume + 4 환경변수)
- `c8a6110` HIGH fold-in (env 정리 + fork PR 게이트 + pr-4-runner-cache.md)
- `542497b` services block → workflow step docker run
- `6aa013c` diagnostic step + sudo docker
- `6d5a71d` runners-net explicit name
- `4b21eba` RUNNERS_NET 동적 검출
- `f300b5f` Seed E2E theme — psql CLI 대신 docker exec
- `3b90c49` Merge (rebase artifact)

### CI 검증 진행 (commit 4b21eba 의 firefox shard 1 결과)
- ✅ Detected runners-net: runners-net (동적 검출 + 사용자 host 재배포)
- ✅ Both services healthy after 6s
- ✅ Run migrations OK
- ✅ Start server OK
- ✅ Seed E2E user OK — **PR-167 register fix 진정한 검증 완료**
- ❌ Seed E2E theme — `psql: command not found` → commit `f300b5f` 로 fix (`docker exec -i $PG_NAME psql`)

## Remaining

### 다음 세션 P0
- **PR-168 CI 결과 확인** — `gh run list --branch=chore/w1-5-runner-cache`. 현재 25062718727 firefox shard 1 in_progress. green 시 admin-merge
- **PAT 회전 검증** — github_pat_11A2XU... 노출됐으니 사용자 회전 했는지 확인

### W1.5 mini-plan (3 PR carry-over)
- **PR-1** orphan-gate fixture job (H-TEST-1) — `chore/w1-5-orphan-gate`
- **PR-5** ci.yml runs-on `[self-hosted, containerized]` 전환 (H-3) — `chore/w1-5-ci-runs-on`
- **PR-7 (신규 등록)** host git clone 절차 (Task #19) — `chore/w1-5-host-repo-sync`. host `~/infra-runners` 가 git repo 아님 → PR 머지 자동 동기화 부재

### DEBT 5건 잔여
- **DEBT-4** gitleaks Secret scan 분석 (false positive vs real)
- **DEBT-5** govulncheck CRITICAL/HIGH CVE 검토 (5분 timeout fix 포함)

## Next Session Priorities

1. **P0** PR-168 CI 결과 polling — `gh run list --branch=chore/w1-5-runner-cache --limit=5` + 4 shard E2E green 확정 시 admin-merge
2. **P0** PAT 회전 확인 — 사용자 GH UI revoke + 재발급 했는지
3. **P1** W1.5 PR-1 (orphan-gate fixture) 진입 — `/compound-work PR-1` (단 PR-168 머지 후)
4. **P1** W1.5 PR-5 (ci.yml runs-on) 진입 — DEBT-1/2 효과 영구 회복
5. **P2** W1.5 PR-7 (host git clone) — manual SCP 부담 제거
6. **P2** DEBT-4 (gitleaks) + DEBT-5 (govulncheck) 분석

## What we did

### PR-167 머지 + 4-agent review fold-in
이전 세션 직전 핸드오프 (Phase 22 W1 + ci.yml hotfix) 의 DEBT 5건 catalog → DEBT-1/2/3 단일 PR 으로 통합. 4-agent 리뷰 결과 HIGH 4건 발견 — H-SEC-1 (pkill cross-kill), H-ARCH-1 (가드 sunset 표지 부재), H-ARCH-2 (scope creep), H-TEST-1 (orphan fixture 부재). 머지 전 fold-in 으로 H-SEC-1+H-ARCH-1+H-ARCH-2 (disclosure) 처리, H-TEST-1 은 W1.5 mini-plan 분리. admin-merge 후 main `6fa7460`.

### PR-168 W1.5 PR-4 Runner Cache + 다중 fix
초기 PR-4 (4 cache volume + 4 환경변수) → 4-agent 리뷰 HIGH 5건. H-1 (fork PR poisoning) + H-2 (setup-go/setup-node cache 충돌) + H-4 (race-safe 근거) + H-5 (Option A carry-over) + L-ARCH-1 (RUNNER_TOOL_CACHE) fold-in. `pnpm-cache`/`go-cache` 제거하고 `playwright-cache` + `hostedtool-cache` 만 유지. H-3 (ci.yml 적용 범위) 는 PR-5 분리.

이후 service container init bug 노출 — myoung34/github-runner 가 GH Actions services: block 처리 못함 (`Value cannot be null. (Parameter 'network')`). services block 제거 + workflow step 의 `docker run --network runners-net` 으로 우회. 그러나 다시 fail — runner user 가 docker.sock 권한 없음 (sup group 990 lost in workflow step). diagnostic step 추가로 root cause 확정 + sudo docker prefix 적용. 또 다시 fail — `runners-net` not found (compose project prefix). docker-compose.yml 에 `name: runners-net` 명시 (host 재배포 필요) + workflow 에 동적 검출 (`docker network ls | grep -E '(^|_)runners-net$'`) 양쪽 적용.

사용자 host 재배포 완료 후 commit 4b21eba 의 동적 검출 가 4 shard 진행 중.

### PR-169 Stop hook schema fix
사용자가 매 turn 보던 "Hook JSON output validation failed — (root): Invalid input" 에러 — `stop-wrap-reminder.sh` 의 Stop event 출력이 `hookSpecificOutput` (Stop event 미지원 키) 사용. `systemMessage` 로 변경. PR-168 와 분리해서 single concern PR 로 admin-merge (`35f8e0e`).

## What blocked us

- SSH 직접 진단 불가 (Auto mode permission 거부) — 사용자 수동 SSH 진행
- `_temp` 디렉토리 EACCES (이전 phase 22 W1 + 또 발생 가능) — runner pool ephemeral 운영
- service container init bug — Phase 22 W1 plan 의 spec 미스 (myoung34 + GHA services 호환 미검증)
- docker compose project name prefix — `~/infra-runners` 디렉토리명이 prefix 로 적용
- workflow step 의 sup group 990 lost — `docker exec -u runner` 와 다른 process 컨텍스트
- PAT 노출 — `docker compose config` 가 ACCESS_TOKEN 그대로 출력 → conversation 잔존

## Next session 첫 5초

- **첫 메시지**: `/compound-resume`
- **메인의 첫 read**: 이 파일 (`memory/sessions/2026-04-28-debt-cleanup-runner-network.md` — 가장 최근 mtime)
- **첫 액션 후보**:
  1. PR-168 CI 결과 polling + admin-merge 결정 (가장 시급)
  2. PAT 회전 확인
  3. W1.5 PR-1 (orphan-gate fixture) 진입
- **참고할 카논**:
  - `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md` (mini-plan)
  - `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/reviews/PR-168.md` (4-agent 결과)
  - `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/pr-4-runner-cache.md` (PR-4 상세)
  - `memory/feedback_4agent_review_before_admin_merge.md` (강제 정책)
  - `memory/project_ci_admin_skip_until_2026-05-01.md` (정책 연장)
