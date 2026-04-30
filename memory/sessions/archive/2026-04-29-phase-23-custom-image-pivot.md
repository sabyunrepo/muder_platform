---
topic: "Phase 23 Custom Image pivot — PR-12 retract + 다음 세션 Custom Image 진입 결정"
phase: "Phase 22 W1.5 → Phase 23 (Custom Image Option A)"
prs_touched: [PR-#172 (open, 보류), PR-#173 (close, retract)]
session_date: 2026-04-29
---

# Session Handoff: Phase 23 Custom Image pivot (PR-12 retract)

## Decided

- **PR-5 (#172) 작성 + 4-agent review pass + push** (`chore/w1-5-ci-runs-on`, commit `f8f7475`)
  - ci.yml 4 job (`go-check`, `ts-check`, `coverage-guard`, `docker-build`) `runs-on` → `[self-hosted, containerized]` (4줄 변경)
  - Spec ref `pr-5-ci-runs-on.md` + checklist W3 carry-over fold-in
  - 4-agent: Security pass / Performance conditional / Architecture pass / Test pass
  - **상태: open 보류** — Custom Image 머지 후 main rebase + CI 재실행 + 머지 (다음 세션 P1)

- **PR-12 (#173) 작성 + 4-agent review + retract** (`chore/w1-5-go-cache-narrow`)
  - 9 setup-go 호출 변경 (ci/e2e/security-deep/security-fast/module-isolation/flaky-report/phase-18.1) — `cache: false` + 명시적 `actions/cache@v4.2.3` (~/go/pkg/mod만) + `go mod verify` step
  - hotfix 추가: 9 곳에 `sudo rm -rf ~/go/pkg/mod ~/.cache/go-build` cleanup step (commit `e7cd387`)
  - **사용자 결정: Custom Image 진입으로 PR-12 dead code → retract** (PR close + branch 삭제 + worktree cleanup 완료)

- **Phase 23 Custom Image Option A 즉시 진입** (사용자 결정 2026-04-29)
  - Scope: Dockerfile + GHCR build CI + docker-compose 교체 + 사용자 host 재배포
  - Out of scope: 9 workflow dead code 정리는 별도 follow-up PR
  - 다음 세션 P0 진입

- **GHA cache 강제 삭제** (옵션 1) — Go 1.24.13 cache 4건 + Go 1.25.0 cache 1건 (총 5.3GB+) `gh cache delete`. baseline 369MB 회복. 그러나 진행 중 CI가 재push로 다시 폭증.

## Discovered

- **🚨 myoung34/github-runner EPHEMERAL=true가 file system reset하지 않음** — runner process만 deregister/register. Docker overlay layer의 `/home/runner/go/pkg/mod`는 잔존. PR-173 첫 CI에서 `/usr/bin/tar: ~/go/pkg/mod/dario.cat/mergo@v1.0.2/...: Cannot open: File exists` 패턴으로 확정. PR-170 진단의 "bare-host runner tar 충돌" 가설 부정확 — containerized runner도 동일.

- **🚨 actions/setup-go default cache가 `~/.cache/go-build`까지 push** — `cache: true` (default)가 mod + build 모두 cache. testcontainers-go + race-instrumented test의 build output이 매 run incremental 누적 → cache size 369MB → 2,549MB 폭증 (6시간).

- **GHA cache fetch throughput 정체** — Azure blob → containerized runner runners-net 경유, 5분+ stuck (`Received 0 of 1009MB at 0.0 MB/s`). 사용자 직접 관찰이 진단의 결정적 단서.

- **`gh cache list`에서 같은 key 4건 entry** — branch scope 분리 또는 시점별 등록. immutable key 가설과 다른 운영 패턴 (외부 til 수준, 등재 X).

- **osv/govulncheck timeout 10분이 cache push 부담**과 결합 — cache size 폭증 + tar 충돌 → fresh download → 10분 timeout cancel.

- **PR-12 단독 fix가 부분 root cause만 해소** — cache size narrowing은 OK, 그러나 file system 잔존은 cleanup step 추가 필요. 그래도 Phase 23 Custom Image entrypoint hook + base image pre-populate으로 양쪽 모두 dead code → 정공 fix.

## Rejected

- ~~PR-12 hotfix 단독 머지 (옵션 A)~~ — Custom Image 진입 결정 후 dead code 가능성. retract.
- ~~PR-12 + PR-13 통합 PR (옵션 B)~~ — single-concern 위반 + 같은 root cause. Custom Image가 두 PR 모두 dead code 해소.
- ~~build cache 별도 actions/cache (key: github.sha)~~ (PR-13 carry-over) — Custom Image base image populate으로 dead code.
- ~~컨테이너 reset 위해 docker-compose `restart: always` 제거~~ — 큰 부채 + 외부 supervisor 필요. Custom Image entrypoint hook이 더 단순.

## Risks

- **Phase 23 Dockerfile의 RUNNER_TOOL_CACHE 호환 위치 정밀 매칭 필요** — `/opt/hostedtoolcache/go/1.25.0/x64/` 등 정확 경로. setup-go의 toolchain detection (PATH check + version compare) 호환.
- **PR-5 (#172) 보류 중 main의 osv/govulncheck 영구 fail** — Custom Image 머지 전까지 main CI 부분 fail 상태. admin-skip 만료 정책 충돌 가능성.
- **사용자 host 재배포 중 4 runner 일시 다운** — CI run 중단 위험. 재배포 시점 신중.
- **GHCR push 권한** — PAT 또는 GITHUB_TOKEN scope 확인 필요.
- **EPHEMERAL fs 잔존이 cleanup hook으로 진짜 해소되는지 미검증** — Phase 23 진입 전 spike 권장 (Q-myoung34-ephemeral-fs).

## Files

### `chore/w1-5-ci-runs-on` (PR #172, OPEN)
- `commit f8f7475` — ci.yml 4 routing label + spec ref + 4-agent review fold-in (review 4 파일)
- branch 유지, worktree 제거됨

### `chore/w1-5-go-cache-narrow` (PR #173, CLOSED)
- `commit 98263f9` (PR-12 base) + `e7cd387` (hotfix) — retract됨, branch 삭제, worktree 제거

### main 추가 (이번 세션 동안)
- 없음 (PR-170 머지 후 새 머지 X)

## Remaining

### 다음 세션 P0
- **Phase 23 plan 작성** (`superpowers:brainstorming` + `superpowers:writing-plans`)
- **Custom Image Dockerfile 작성**:
  - FROM `myoung34/github-runner@sha256:85a7a6a73abd0c0e679ea315b0e773c4a118315e21f47c864041ae6d73d21ea3`
  - 사전 install: jq, govulncheck, Node v20, Playwright deps
  - Go toolchain → RUNNER_TOOL_CACHE 호환 위치 (`/opt/hostedtoolcache/go/1.25.0/x64/`)
  - docker GID 990 정착
  - `ACTIONS_RUNNER_HOOK_JOB_STARTED` → cleanup script (`rm -rf ~/go/pkg/mod ~/.cache/go-build`)
- **GHCR build/push CI** (`.github/workflows/build-runner-image.yml` 신규, linux/amd64)

### 다음 세션 P1
- **docker-compose.yml image 교체** + 사용자 host SSH 재배포 (`docker compose pull + up -d`)
- **PR-5 (#172) main rebase + CI 재실행 + 머지** — Custom Image 머지 후 cache 폭증 + tar 충돌 자연 해소
- **9 workflow dead code 정리 PR** — Custom Image 후 dead code 4건 (jq install, sudo go test, sudo apt-get, manual sudo docker build) 제거. single-concern.

### W1.5 잔여 (Phase 23 무관)
- **PR-1** orphan-gate fixture (H-TEST-1)
- **PR-2** gitleaks Secret scan 분석
- **PR-3** govulncheck CRITICAL/HIGH CVE 처리
- **PR-7** host git clone 절차

### Phase 22 W3 carry-over
- RUNNERS_NET regex 정확 매칭
- bare-host self-hosted runner 등록 해제

## Next Session Priorities

1. **P0** Phase 23 plan 작성 (brainstorming + writing-plans)
2. **P0** Custom Image Dockerfile + GHCR build CI
3. **P1** docker-compose 교체 + 사용자 host 재배포
4. **P1** PR-5 (#172) 재실행 + 머지
5. **P1** 9 workflow dead code 정리 PR
6. **P2** W1.5 PR-1/PR-2/PR-3/PR-7

## What we did

이전 세션 (2026-04-29 PR-170 머지) 핸드오프 받고 Phase 22 W1.5 P0 (Go module cache named volume) 진입 의도. PR-4 spec read + 최근 CI run 분석으로 진짜 부채는 named volume 부재가 아니라 **bare-host runner tar 충돌 + GHA cache 폭증** 식별. 사용자 옵션 C (PR-5 우선) 선택.

PR-5 (`chore/w1-5-ci-runs-on`) 4줄 routing label 변경 + spec ref + 4-agent 병렬 review (sec/test/arch + perf conditional). HIGH 0, fold-in 2건 (checklist W3 + spec ref). PR #172 push.

PR-172 CI 진행 중 사용자가 직접 stuck 로그 paste — `Received 0 of 1009MB at 0.0 MB/s`. `gh cache list` 확인으로 cache 폭증 (369MB → 2.4GB+) 발견. 옵션 1 (cache delete) + 옵션 2 (PR-12 actions/cache narrowing) 조합 결정.

PR-12 (`chore/w1-5-go-cache-narrow`) 9 workflow setup-go cache 좁힘 + go mod verify fold-in + 4-agent review pass. PR #173 push. 그러나 첫 CI에서 osv/govulncheck timeout — `tar: Cannot open: File exists` 진단으로 **EPHEMERAL=true가 file system reset 안 함** 확정. PR-170의 bare-host 가설 부정확.

PR-12에 cleanup step hotfix 9 곳 추가 (commit `e7cd387`). 사용자 질문: "커스텀 이미지로 진행하면 다음 phase 다 필요없을 것" — Phase 23 Custom Image Option A가 PR-12 + 9 workflow fold-in을 모두 dead code화한다는 통찰. 사용자 결정: **PR-12 retract + Phase 23 즉시 진입**.

PR #173 close, branch 삭제, worktree cleanup. PR-5 (#172)는 routing 변경이 Custom Image 후에도 유효하므로 open 보류. wrap-up 진행.

## What blocked us

- **사용자 host 직접 관찰 의존** — `gh run view --log` 만으로는 stuck의 정확 진행 (Received 0 of 1GB) 식별 어려움. 사용자 paste가 결정적.
- **EPHEMERAL=true 동작 가정 오류** — bare-host 가설로 진단 → containerized runner도 동일 패턴 발견까지 3+ CI 사이클.
- **myoung34/github-runner 공식 docs 부족** — EPHEMERAL ↔ file system 동작 명시 부재. 운영 실측 의존.

## Next session 첫 5초

- **첫 메시지**: `/compound-resume`
- **메인의 첫 read**: 이 파일 (`memory/sessions/2026-04-29-phase-23-custom-image-pivot.md` — 가장 최근 mtime)
- **첫 액션 후보**:
  1. Phase 23 plan 진입 — `/compound-plan` 또는 `superpowers:brainstorming` 직접 호출
  2. Custom Image Dockerfile 작성 (사용자가 본 PR이라면 immediate worktree 분기 가능)
  3. EPHEMERAL fs 잔존 spike (Q-myoung34-ephemeral-fs 검증) — `docker exec containerized-runner-1 ls ~/go/pkg/mod` 사용자 SSH
- **참고할 카논**:
  - `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md` (Phase 23 entry, Composite action 추출 carry-over)
  - `infra/runners/docker-compose.yml` (현 image SHA + 환경변수)
  - `infra/runners/README.md` (PAT scope, bootstrap 절차, cache volumes 섹션)
  - `memory/QUESTIONS.md` (Q-myoung34-ephemeral-fs 검증 가설)
  - `memory/feedback_4agent_review_before_admin_merge.md` (Custom Image PR도 4-agent review 강제)
  - `memory/feedback_branch_pr_workflow.md` (single-concern, Custom Image도 single-concern PR)
