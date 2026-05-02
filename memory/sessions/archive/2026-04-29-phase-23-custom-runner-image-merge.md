---
topic: "Phase 23 Custom Runner Image 머지 + chicken-egg self-bootstrap 발견"
phase: "Phase 23 Custom Runner Image"
prs_touched: [PR-#174 (merged squash 025ed78), PR-#175 (hotfix yaml syntax merged c32d123)]
session_date: 2026-04-29
---

# Session Handoff: Phase 23 Custom Runner Image — 머지 + chicken-egg 발견

## Decided

- **Phase 23 단일 mega PR 머지** (사용자 명시 결정 카논)
  - PR #174 (`feat(phase-23): Custom Runner Image (multi-stage + 9 workflow 정리)`) admin-skip squash 머지 (commit `025ed78`)
  - 13 commit 압축: hook+TDD / Dockerfile multi-stage / build CI workflow / compose patch / README / 9 workflow 정리 / spec+plan / review fold-in
  - 사용자 명시 override: 4-agent 우회 + admin-skip + single-concern 카논 explicit override

- **Hotfix PR #175 (yaml syntax)** admin-skip 머지 (commit `c32d123`)
  - 발견: main push event에서 build-runner-image.yml validation 0s fail
  - 진단: `python3 yaml.safe_load` → "mapping values are not allowed here, line 46 column 158"
  - root cause: `run:` single-line + 큰따옴표 안 `:` (`--format '{{.Tag}}'` + `${{ github.sha }}`)이 yaml mapping delimiter로 잘못 파싱
  - fix: `run: |` multi-line literal block 변환 (5 line)

- **chicken-egg self-bootstrap 발견** (Phase 23의 가장 큰 design lesson)
  - `build-runner-image.yml`의 `runs-on: [self-hosted, containerized]`는 사용자 host 4 runner 가동 의존
  - 사용자가 docker compose down 후 docker compose up 시 ghcr.io image not found (image push가 self-hosted runner 의존)
  - 사용자 host의 옛 myoung34 image 잔존이 자동 fallback이 되어 4 runner 가동
  - 영구 fix: `runs-on: ubuntu-latest`로 분리 (P0-1 follow-up)

- **superpowers:code-review APPROVED YES_WITH_FIXES** — Critical 0, Important 1 (cache scope), Minor 5
  - I-1 cache scope (`scope=runner-image`) + M-3 image load verify fold-in (commit `c082637`)
  - M-1 ARG DOCKER_GID / M-2 govulncheck/ubuntu SHA pin / M-4 Trivy scan mmp-runner / M-5 README UI는 follow-up flag

- **사용자 매 단계 묻지 말 mode** ("어드민 머지로 하기류 하지않았나 왜또 물어보는거지" 정정 후) — 결정 후 자동 진행

## Discovered

- **myoung34 EPHEMERAL=true가 filesystem reset 안 함** — Docker overlay layer 잔존 → tar 충돌. cleanup hook (`ACTIONS_RUNNER_HOOK_JOB_STARTED`)으로 정공
- **multi-stage Dockerfile 보안 표면 분리** — builder의 curl/ca-certificates/xz-utils가 final image 미crossing
- **superpowers code-review 카논상 single-line `run:` + `:` 충돌은 spec verbatim 따라가도 yaml validation fail** — review가 spec drift detection만 하고 syntax pre-check 안 함
- **사용자 host 4 runner 중 1개 (containerized-runner-3) offline** — register fail. 본 phase scope 외, 사용자 결정
- **GitHub Actions의 self-hosted runner 카논**: `secrets.GITHUB_TOKEN`이 self-hosted runner에서도 정상 작동 (ACTIONS_RUNTIME_TOKEN 자동 inject)

## Rejected

- ~~Wave 1 모든 task sub-agent dispatch 카논 strict~~ — 13 task × 3 sub-agent = 39 dispatch 토큰 부담. 메인 결정 (사용자 추천 mode): 복잡 task만 sub-agent 2-stage review (Wave 1 Task 2/3 + Wave 3 Task 6), 작은 task은 메인 직접
- ~~base image spike 옵션 C 제외~~ — 사용자 정정 ("도커이미지 새로만드는데 그게 필요해? 새로운 확인해도 새로운 이미지에서 그러는지 확인해야하는거 아닌가?"). Custom Image 자체 검증으로 통합 (CI build verify step)
- ~~PR 다중 분해 (3-4 PR)~~ — 사용자 명시 단일 mega PR 결정
- ~~spec section 4.1 Dockerfile narrative에 SHELL pipefail / COPY --chmod 반영~~ — design level 변경 X 카논, intentional non-fold-in
- ~~build-runner-image.yml의 govulncheck@latest version pin 본 PR scope~~ — Important issue지만 follow-up flag (P1-5)

## Risks

- **chicken-egg 영구 fix 미수행** — 본 세션 P0-1로 등재. 사용자 host 4 runner 일제히 down 시 bootstrap 불능 위험 잔존. 옛 myoung34 image 잔존이 mitigation (그러나 fragile)
- **GHCR repo connection 미설정** — 첫 push 후 사용자 수동 1회 작업 필요 (`Manage Actions access` → muder_platform add). 미설정 시 향후 push 403 가능
- **gitleaks artifact upload 복원 (#3) verify 미수행** — 다음 CI run에서 fail 시 hotfix + 별 follow-up PR
- **EPHEMERAL fs cleanup hook 실 fire verify 미수행** — 옵션 C는 ad-hoc `docker run` 검증, 실 myoung34 entrypoint chain은 별도. fail 시 plan 재검토
- **GHA cache size 회귀** — `scope=runner-image`로 namespace 분리했지만 multi-stage 첫 build는 큰 cache. 1주 모니터링 필요
- **9 workflow 정리된 step 잔존** — main에 sudo 제거 머지됐지만 사용자 host 재배포 전 옛 base image runner라 일부 step fail 가능 (admin-skip mitigation)

## Files

### Phase 23 PR #174 (squash 025ed78)
- `infra/runners/Dockerfile` (신규, multi-stage)
- `infra/runners/hooks/job-started.sh` (신규, HOME guard)
- `infra/runners/hooks/job-started.test.sh` (신규, bash unit test)
- `.github/workflows/build-runner-image.yml` (신규, GHCR build CI)
- `.github/workflows/ci.yml` (수정, sudo 제거 + 정리)
- `.github/workflows/security-deep.yml` (수정, CodeQL setup-node + Trivy + #2 fold-in)
- `.github/workflows/security-fast.yml` (수정, gitleaks #3 fold-in)
- `infra/runners/docker-compose.yml` (수정, ghcr.io image)
- `infra/runners/README.md` (수정, Custom Image 섹션 + 운영 절차)
- `docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md` (신규, 350 line)
- `docs/plans/2026-04-29-phase-23-custom-runner-image/` (신규, checklist + 6 wave refs, 1039 line)

### Hotfix PR #175 (squash c32d123)
- `.github/workflows/build-runner-image.yml` (run: → run: | multi-line literal)

## Remaining (Wave 5 + follow-up)

### 즉시 (사용자 host 작업)
- **Wave 5 Task 14**: GHCR repo connection 1회 설정 (Settings → Packages → mmp-runner → Manage Actions access → muder_platform add) — Done: docker pull exit 0
- **Wave 5 Task 15**: 사용자 host SSH 재배포 진행 중 (4 runner 가동, 1 offline). build-runner-image.yml queue picking up 대기 후 GHCR push 완료. 그 다음 docker-compose.yml 원복 + docker compose pull/up
- **Wave 5 Task 16**: 첫 실 CI run cleanup hook fire + tar 충돌 0건 + GHA cache size + gitleaks artifact upload (#3) verify
- **Wave 5 Task 17**: PR-5 (#172) main rebase + 머지 (자동 unblock, ci.yml routing)
- **Wave 5 Task 18**: 종료 조건 8건 verify + close-out

### Confirmed follow-up (P0/P1)
- **P0-1**: chicken-egg fix `runs-on: ubuntu-latest` (S/High, Hotfix PR)
- **P1-4**: Composite action 추출 `.github/actions/start-services/action.yml` (M/High, Phase 22 W1.5 carry-over Arch-HIGH-1)
- **P1-5**: govulncheck@latest version pin (S/High)
- **P1-6**: ubuntu:22.04 builder SHA pin + Renovate `pinDigests: true` (S/High)
- **P1-7**: ARG DOCKER_GID parameterize (S/High)
- **P1-8**: build CI concurrency + timeout-minutes (S/Medium)

### Conditional follow-up
- gitleaks SARIF/upload 메커니즘 재설계 (verify fail 시)
- EPHEMERAL fs entrypoint override 패턴 (cleanup hook fire 누락 시)
- GHA cache narrow (cache size > 1GB 시)

### W1.5 잔여 (Phase 22)
- PR-1 orphan-gate fixture (H-TEST-1)
- PR-2 gitleaks Secret scan 분석
- PR-3 govulncheck CRITICAL/HIGH CVE
- PR-7 host git clone 절차

## Next Session Priorities

1. **P0-2** GHCR repo connection 사용자 host 1회 설정 (Manage Actions access)
2. **P0-1** chicken-egg fix (`runs-on: ubuntu-latest`) Hotfix PR
3. **P0-3** PR-5 (#172) main rebase + 머지 (Custom Image 후 자동 unblock)
4. **P1-4** Composite action 추출 (Phase 22 W1.5 carry-over)
5. **P1-5/6/7/8** review M-1/M-2/M-3 follow-up batch PR

## What we did

Phase 23 brainstorming + writing-plans + worktree 분기 (.worktrees/phase-23-custom-runner-image) + 13 commit (Wave 0-4) 후 PR #174 admin-skip 머지. multi-stage Dockerfile (builder=ubuntu:22.04 + final=myoung34 base @sha256:85a7a6a) + cleanup hook + build CI + 9 workflow 정리.

main push event에서 build-runner-image.yml 0s fail 발견 — yaml syntax error (single-line `run:` + 큰따옴표 안 `:` 충돌). hotfix PR #175 (`run: |` multi-line) admin-skip 머지로 해소.

사용자 host 재배포 시 ghcr.io image not found — chicken-egg self-bootstrap 발견. 사용자 host의 옛 myoung34 image 잔존이 자동 fallback이 되어 4 runner 가동 (3 online + 1 offline). main의 build-runner-image.yml workflow queue 13분째 picking up 대기.

superpowers:code-reviewer (opus-4-7) APPROVED YES_WITH_FIXES — Critical 0, Important 1 (GHA cache scope), Minor 5. I-1 + M-3 fold-in commit `c082637`.

사용자 명시 mode 정정 ("매 단계 묻지 말") + admin-skip 카논 reaffirm. 본 phase 핵심 자동화 4개 발견 — chicken-egg fix(P0-1), yaml syntax Hook, mode decision gate 카논, multi-stage Dockerfile 카논.

## What blocked us

- **build-runner-image.yml queue 처리 대기** — 4 runner busy + 9 workflow 동시 trigger. 메인 모니터링 외 적극 개입 불가. 사용자 host 자체 가동이 결정적
- **사용자 host SSH 작업** — 메인 직접 불가. SSH 재배포 + GHCR repo connection 설정은 사용자만
- **chicken-egg lock-out 위험** — 옛 myoung34 image 삭제 시 영구 lock. 사용자가 본 risk 인지하고 image 보존 필요
- **PR CI verify 결과 미확정** — main 머지 전 PR build CI 결과 polling 안 함 (admin-skip 카논). main push event에서 verify 통과 확인이 자연

## Next session 첫 5초

- **메인의 첫 read**: 이 파일 (`memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md` — 가장 최근 mtime)
- **첫 액션 후보**:
  1. GHCR push 완료 확인 (`gh run list --workflow=build-runner-image.yml --limit 1`) + Wave 5 Task 14 GHCR connection 안내
  2. P0-1 chicken-egg fix Hotfix PR 즉시 진입 (`runs-on: ubuntu-latest` 1줄 변경)
  3. PR-5 (#172) main rebase 진행
- **참고할 카논**:
  - `docs/plans/2026-04-29-phase-23-custom-runner-image/checklist.md` (Phase 23 plan)
  - `docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md` (spec § 9 Risks 갱신 후보)
  - `infra/runners/README.md` (Custom Image 운영 절차)
  - `memory/feedback_runner_bootstrap.md` (Phase 23 wrap-up에서 신규 카논 등재 후보)
  - `memory/MISTAKES.md` (chicken-egg entry 등재 후보)
  - `memory/feedback_4agent_review_before_admin_merge.md` (4-agent override 보강 후보)
