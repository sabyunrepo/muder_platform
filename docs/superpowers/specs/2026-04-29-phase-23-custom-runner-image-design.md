---
title: Phase 23 — Custom Runner Image (Option A multi-stage)
date: 2026-04-29
status: design
parent_phase: phase-22-w1-5-debt-cleanup
prerequisite_pr: "#172 (chore/w1-5-ci-runs-on, open 보류 — 본 phase 머지 후 자동 unblock)"
---

# Phase 23 — Custom Runner Image (Option A multi-stage)

> 부모: [Phase 22 W1.5 plan](../../plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md) | 직전 핸드오프: [`memory/sessions/2026-04-29-phase-23-custom-image-pivot.md`](../../../memory/sessions/2026-04-29-phase-23-custom-image-pivot.md)

## 0. 진단 요약 (이전 세션 결정 카논)

| 발견 | 출처 |
|------|------|
| `myoung34/github-runner` EPHEMERAL=true가 **filesystem reset 안 함** — runner process만 deregister/register, Docker overlay layer는 잔존 | PR-173 첫 CI run `tar: Cannot open: File exists` 패턴 (2026-04-29) |
| `actions/setup-go` default cache가 `~/.cache/go-build`까지 push → cache 369MB → 2,549MB 폭증 (6시간) | `gh cache list` 사용자 직접 관찰 |
| 9 workflow에 base image 결함 우회용 step 누적 (jq install, sudo go test, sudo apt-get, manual sudo docker build) | Phase 22 W1.5 plan PR-8 spec (`refs/pr-8-runner-action-compat.md`) |

→ **정공 fix**: Custom Image base에 사전 install + cleanup hook + 9 workflow 우회 step 제거.

## 1. Goal

Phase 22 W1 containerization (PR-165/166) + W1.5 admin-merge cleanup (PR-167/168/170) 의 누적 부채를 single PR로 정공 해소:

- **Custom Runner Image** (`ghcr.io/sabyunrepo/mmp-runner`)에 다음 사전 install:
  - Go toolchain v1.25.0 (RUNNER_TOOL_CACHE 호환 위치)
  - Node v20.18.0 (DEBT-2 자연 해소)
  - jq, govulncheck (workflow 우회 step 자연 해소)
  - Playwright system deps (E2E 1st run cold start ↓)
  - docker GID 990 정착 (DEBT-3 + testcontainers-go 자연 해소)
- **`ACTIONS_RUNNER_HOOK_JOB_STARTED`** cleanup hook script (EPHEMERAL fs 잔존 정공)
- **9 workflow dead code 정리** (fold-in)
- **Trivy scan image cleanup** Sec-MED-3 1줄 fold-in
- **gitleaks artifact upload 복원** Sec-MED-2 (verify는 다음 CI run)

## 2. 사용자 결정 (brainstorming 카논)

| 결정 | 사유 |
|------|------|
| **단일 mega PR** (Custom Image + 9 workflow 정리) | single-concern 카논상 위반이지만 사용자 명시 결정. 운영 시간차 위험은 admin-skip으로 mitigation. |
| **4-agent 리뷰 우회** | 사용자 명시 결정. `superpowers:requesting-code-review`만 사용. `feedback_4agent_review_before_admin_merge.md` 카논 override (사용자 explicit instructions가 최우선). |
| **admin-skip 머지** | 운영 시간차 위험 (host 재배포 전 main fail) mitigation. 다음 PR에서 자연 verify. |
| **GITHUB_TOKEN 사용** | `secrets.ACCESS_TOKEN` 재사용 거부. blast radius 분리 (`Administration: write` 권한 우회). |
| **GHCR Public visibility** | 사용자 host pull 인증 0건. image에 secret 없으니 risk 낮음. |
| **multi-stage build (Approach B)** | 보안 표면 축소 (builder의 curl/xz 제외) + GHA cache 효율. |
| **EPHEMERAL fs spike = 옵션 C** | base image 검증 무의미. CI 빌드 step에 verify 통합 (`docker run` + cleanup hook fire assert). |
| **Composite action 추출 (Arch-HIGH-1) 별 phase** | 다른 root cause (보일러플레이트). Phase 23.1 또는 Phase 24 후보. |
| **gitleaks artifact 복원 본 PR fold-in** | Custom Image 머지 후 artifact upload env 켜고 verify. fail 시만 별 follow-up. |

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 23 Custom Runner Image                                │
│                                                             │
│  Dockerfile (multi-stage)                                   │
│   ├─ Stage 1 builder (ubuntu:22.04)                         │
│   │   ├─ Go 1.25.0 tarball → /opt/hostedtoolcache/go/...    │
│   │   ├─ Node 20.18.0 tarball → /opt/hostedtoolcache/node/  │
│   │   └─ govulncheck install → /usr/local/bin               │
│   │                                                         │
│   └─ Stage 2 final (FROM myoung34 base@sha256:85a7...)      │
│       ├─ COPY --from=builder /opt/hostedtoolcache           │
│       ├─ COPY --from=builder /usr/local/bin/govulncheck     │
│       ├─ RUN apt-get install jq + Playwright deps           │
│       ├─ RUN groupadd -g 990 docker-host                    │
│       ├─ COPY infra/runners/hooks/job-started.sh            │
│       └─ ENV ACTIONS_RUNNER_HOOK_JOB_STARTED=...            │
│                                                             │
│  build-runner-image.yml                                     │
│   ├─ on: push branches main + pull_request paths            │
│   ├─ permissions: packages: write                           │
│   ├─ build (PR + main, gha cache)                           │
│   ├─ verify (PR only, docker run + cleanup hook assert)     │
│   └─ push (main only, GHCR latest + sha tags)               │
│                                                             │
│  docker-compose.yml diff:                                   │
│   - image: myoung34/github-runner@sha256:85a7...            │
│   + image: ghcr.io/sabyunrepo/mmp-runner:latest             │
│   - pull_policy: never                                      │
│   + pull_policy: always                                     │
│                                                             │
│  9 workflow dead code 정리 (fold-in)                        │
│   ci.yml          : sudo go test 제거, ownership step 제거  │
│   security-deep   : setup-node@v4 + symlink 제거            │
│   security-deep   : usermod docker / sudo docker 제거       │
│   security-deep   : Trivy image cleanup 1줄 추가 (#2)       │
│   security-fast   : GITLEAKS_ENABLE_UPLOAD_ARTIFACT 제거(#3)│
│   여러 workflow   : apt-get install jq 제거                 │
└─────────────────────────────────────────────────────────────┘
```

## 4. Components

### 4.1 `infra/runners/Dockerfile` (신규)

multi-stage:
- **Stage 1 builder** (`ubuntu:22.04`): Go/Node tarball download + govulncheck install. install tool (curl, ca-certificates, xz-utils) 보존하지만 final stage에 미반영.
- **Stage 2 final** (`FROM myoung34/github-runner@sha256:85a7a6a73abd0c0e679ea315b0e773c4a118315e21f47c864041ae6d73d21ea3`): COPY install artifacts + apt-get install jq + Playwright deps + docker GID 990 + cleanup hook script.

ARG:
- `GO_VERSION=1.25.0` (renovate 추적 후보)
- `NODE_VERSION=20.18.0` (renovate 추적 후보)

ENV:
- `ACTIONS_RUNNER_HOOK_JOB_STARTED=/opt/runner-hooks/job-started.sh`
- `RUNNER_TOOL_CACHE=/opt/hostedtoolcache` (compose env와 align, Dockerfile에는 설정 안 함 — compose 우선)

USER: 최종 `runner` (myoung34 base 표준).

### 4.2 `infra/runners/hooks/job-started.sh` (신규)

```bash
#!/usr/bin/env bash
# ACTIONS_RUNNER_HOOK_JOB_STARTED — 매 job 시작 직전 fire.
# myoung34 EPHEMERAL=true가 file system reset 안 함에 대한 정공.
set -euo pipefail
# myoung34 base image의 runner user home은 /home/runner 고정. set -u로 인한 unbound variable abort 방지.
HOME="${HOME:-/home/runner}"
rm -rf "${HOME}/go/pkg/mod" "${HOME}/.cache/go-build" 2>/dev/null || true
# setup-go가 cache restore 시 parent dir 존재 가정 — rm -rf 후 재생성 필수.
mkdir -p "${HOME}/go/pkg/mod" "${HOME}/.cache/go-build"
```

용도: 매 job 시작 직전 fire (myoung34의 EPHEMERAL fs reset 누락 정공). HOME guard는 W1.T1 review fold-in (set -u 안전망).

permission: 755 (Dockerfile `COPY --chmod=0755`).

### 4.3 `.github/workflows/build-runner-image.yml` (신규)

action SHA pinning은 Phase 18.7 카논 + W1.T3 review fold-in. release.yml align.

| step | 동작 |
|------|------|
| 1 | `actions/checkout@34e1148` (v4.3.1) |
| 2 | `docker/setup-buildx-action@f7ce87c` (v3.9.0) |
| 3 | `docker/login-action@4907a6d` (v4.1.0, push event만, GITHUB_TOKEN) |
| 4 | `docker/build-push-action@4f58ea7` (v6.9.0, PR=load, main=push) — `cache-from: type=gha`, `cache-to: type=gha,mode=max` |
| 5 | verify step (PR만) — `docker run` + jq/govulncheck/Go/Node check + cleanup hook fire assert (`~/go/pkg/mod` + `~/.cache/go-build` 둘 다 비었음 검증 — W1.T3 review fold-in) |

trigger paths:
- `infra/runners/Dockerfile`
- `infra/runners/hooks/**`
- `.github/workflows/build-runner-image.yml`

permissions: `contents: read`, `packages: write`.

runs-on: `[self-hosted, containerized]` (runner pool 사용).

### 4.4 `infra/runners/docker-compose.yml` (수정)

diff:
```diff
-  image: myoung34/github-runner@sha256:85a7a6a73abd0c0e679ea315b0e773c4a118315e21f47c864041ae6d73d21ea3
-  pull_policy: never
+  image: ghcr.io/sabyunrepo/mmp-runner:latest
+  pull_policy: always
```

기타 (group_add, mem_limit, networks, volumes, environment): 변경 없음. PR-4 fold-in의 hostedtool-cache/playwright-cache volume 보존.

### 4.5 9 workflow dead code 정리 (fold-in)

| workflow | 변경 | 이유 |
|----------|------|------|
| `ci.yml` | `sudo -E env "PATH=$PATH" go test` → `go test` | docker GID 990 정착 |
| `ci.yml` | `Fix coverage.out ownership` step 제거 | RUN_AS_ROOT=false + group_add로 자동 |
| `security-deep.yml` (CodeQL) | `setup-node@v4` + `/usr/local/bin/node` symlink override 제거 | base에 Node v20 사전 install |
| `security-deep.yml` (Trivy) | `usermod -aG docker` + `sudo docker buildx` → 일반 `docker buildx` | docker GID 990 |
| `security-deep.yml` (Trivy) | (신규) `if: always()` `docker rmi mmp-server:security-scan` 1줄 (#2 fold-in) | host disk 누적 cleanup |
| `security-fast.yml` (gitleaks) | `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false` env 제거 (#3 fold-in) | Custom Image GID 정착 가설 verify, fail 시 별 PR |
| 여러 workflow | `apt-get install jq` step 제거 | base에 jq 사전 install |

## 5. Data Flow

```
PR push → build-runner-image.yml 트리거 (paths match)
  └─ build (load=true) → verify (cleanup hook assert)
                              ↓ assert pass
PR superpowers:requesting-code-review (4-agent 우회)
  └─ review fix 또는 fold-in
                              ↓
admin-skip 머지 (gh pr merge --admin --squash)
  └─ main → build-runner-image.yml 재트리거 (push event)
       └─ GHCR push (latest + sha tag)
                              ↓
사용자 host SSH:
  cd ~/muder_platform/infra/runners
  git pull
  docker compose pull (Public, 인증 0건)
  docker compose up -d (4 runner 재시작)
                              ↓
첫 실 CI run:
  ├─ cleanup hook 실 fire 확인 (gh run view --log)
  ├─ tar 충돌 0건
  ├─ GHA cache size < 1GB
  ├─ 9 workflow 정리 step 통과
  └─ gitleaks artifact upload 동작 (#3 verify)
                              ↓
PR-5 (#172) main rebase + 자동 unblock + 머지
```

## 6. Error Handling

### 6.1 PR build/verify

| 실패 모드 | 대응 |
|----------|------|
| multi-stage builder fail (tarball 404) | upstream 일시 장애. 1회 재실행. 영구 fail 시 version arg 검토. |
| myoung34 base SHA pull fail | base SHA가 회수됨 (드물지만 가능). Renovate가 latest digest로 갱신 (Phase 18.7 카논). |
| 사전 install 검증 fail | Dockerfile RUN block 누락. fix 후 PR push. |
| **cleanup hook 동작 안 함 (verify assert fail)** | **옵션 C 가설 부정**. plan 자체 재검토 (entrypoint override 패턴 전환). |
| build CI hang (cache fetch 정체) | 10분 timeout. 발생 시 `gh cache delete` 또는 cache-from/to 비활성. |

### 6.2 main 머지 + GHCR push

| 실패 모드 | 대응 |
|----------|------|
| GHCR login 401 | `permissions: packages: write` 누락 검증. |
| GHCR push 403 | package 신규 생성 → repo connection 미설정. 첫 push 후 수동 1회: `https://github.com/sabyunrepo/packages/container/mmp-runner/settings` → "Manage Actions access" → `muder_platform` add. |
| GHCR rate limit 429 | free tier 한도. 기다림 + 재push. |
| **9 workflow main 부분 fail (host 재배포 전)** | admin-skip 정책으로 통과. host 재배포 후 자연 정상화. |

### 6.3 사용자 host 재배포

| 실패 모드 | 대응 |
|----------|------|
| `docker compose pull` 401/404 | GHCR Public 미설정. package settings 확인. |
| 4 runner 일부 옛 image 잔존 | `docker compose down && up -d` (강제 재생성). |
| runner 재등록 fail | `.env` ACCESS_TOKEN 만료 검증 (README PAT scope curl). |
| 재배포 도중 active CI 중단 | EPHEMERAL=true graceful: deregister 후 새 image. **active CI 0건일 때 재배포** 권고. |
| 컨테이너 부팅 직후 exit | `docker logs` 확인. **rollback**: compose.yml `image:` 직전 GHCR sha 또는 myoung34 base SHA로 복귀. |

### 6.4 첫 CI run verify

| 실패 모드 | 대응 |
|----------|------|
| **cleanup hook 미작동 (실 runner)** | spike 통과 + 실 runner fail = `ACTIONS_RUNNER_HOOK_JOB_STARTED` fire 누락. **plan 재검토** (entrypoint override 전환). |
| **gitleaks artifact upload fail** | Custom Image GID 정착 불충분. **#3 follow-up PR**로 escalate. 즉시 hotfix: `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false` 복원. |
| govulncheck PATH miss | builder stage `/root/go/bin/govulncheck` 가정 오류. `find / -name govulncheck` 진단. |
| 9 workflow 정리 과도 | step 제거 범위 큼. 필요 step 복구 + dead code 재분류. |

### 6.5 Rollback (전체)

```
사용자 host:
  cd ~/muder_platform/infra/runners
  git revert <Phase 23 commit> (compose.yml만)
  docker compose pull
  docker compose up -d
  → ~5분 내 복귀

main revert PR:
  gh pr create로 revert (compose + 9 workflow 동시 revert)
  admin-skip 머지

사후 진단:
  - Dockerfile / hook / 9 workflow / gitleaks 중 어느 컴포넌트 fail
  - hotfix PR 작성
```

## 7. Testing / Verification Matrix

### 7.1 PR build CI

- Dockerfile 빌드 exit 0
- multi-stage cache hit (2nd run)
- 사전 install 검증 (jq, govulncheck, Go, Node — 모두 exit 0)
- hostedtool-cache 위치 + `.complete` 마커 존재
- cleanup hook fire 시뮬 통과 (`[ -z "$(ls -A ~/go/pkg/mod)" ]`)
- hook script permission 755
- docker GID 990 정착 (`getent group docker-host`)
- runner user PATH 노출 (`docker run --user runner` + `which go && which node`)
- image 크기 < 2GB
- base image SHA pinning 보존

### 7.2 main 머지 + GHCR push

- GHCR login 성공
- GHCR push 성공 (latest + sha tag)
- Public visibility (인증 없이 tags JSON 반환)

### 7.3 사용자 host 재배포

- `docker compose pull` 4 service Pulled
- `docker compose up -d` 4 service Started
- `docker logs` "Listening for Jobs"
- `docker exec` ENTRYPOINT 정상 (Runner.Listener 프로세스)
- 사전 install 노출
- GitHub Settings → Runners 4 idle
- `ACTIONS_RUNNER_HOOK_JOB_STARTED` env 노출

### 7.4 첫 실 CI run

- cleanup hook 실 fire (`gh run view --log` grep)
- tar 충돌 0건
- GHA cache size < 1GB
- 9 workflow 정리 step 통과
- CodeQL JS-TS 통과 (Node v20)
- Trivy + image cleanup (#2)
- gitleaks artifact upload (#3 verify, fail 시 follow-up)
- testcontainers-go 통과
- E2E run 통과

### 7.5 Phase 23 종료 조건

- [ ] PR 머지 + GHCR push
- [ ] host 4 runner 재배포 + idle
- [ ] 첫 실 CI run cleanup hook fire 확인 + tar 충돌 0건
- [ ] 9 workflow 정리 step 통과
- [ ] gitleaks artifact upload 동작 (또는 #3 follow-up 등록)
- [ ] GHA cache 1GB 이하 1주 stable
- [ ] PR-5 (#172) main rebase + 머지 (자동 unblock)
- [ ] follow-up #1 (Composite action) Phase 23.1 또는 Phase 24 plan 등재

## 8. Out of Scope

- Composite action 추출 (Arch-HIGH-1) — 별 phase
- gitleaks SARIF/upload 메커니즘 재설계 — verify fail 시만 별 follow-up
- ARM64 image build — 현 host linux/amd64만
- multi-stage builder 보안 표면 정량 측정 (trivy image scan) — 별 phase
- image 크기 최적화 — 1차 < 2GB 만족 시 충분

## 9. Risks

| Risk | Mitigation |
|------|-----------|
| `RUNNER_TOOL_CACHE` 정밀 매칭 실패 (setup-go가 사전 install 미인식) | `.complete` 마커 검증 + `actions/setup-go` source 확인. fail 시 매번 download fallback이라 fail 모드 가벼움. |
| myoung34 base의 ENTRYPOINT/CMD 손상 | final stage에서 ENTRYPOINT 미override. `USER runner`만 명시. |
| GHA cache size 회귀 | hostedtool-cache volume + setup-go default cache narrow는 본 PR 미포함 (PR-12 retract). 첫 CI run에서 size 측정 필수. 폭증 시 별 PR (PR-12 재진입 후보). |
| `ACTIONS_RUNNER_HOOK_JOB_STARTED` 실 fire 미보장 | 옵션 C verify는 ad-hoc `docker run`으로 검증. 실 runner의 myoung34 entrypoint chain은 다름. **다음 CI run에서 `gh run view --log`로 hook 실행 라인 grep 필수.** fail 시 plan 재검토. |
| 사용자 host 재배포 시점 active CI 충돌 | active CI 0건 확인 후 재배포. 또는 `docker compose down --timeout 120`으로 graceful 대기. |

## 10. Implementation 진입

본 spec 승인 후 `superpowers:writing-plans` 진입 → `docs/plans/2026-04-29-phase-23-custom-runner-image/checklist.md` 작성. 단일 mega PR이라 Wave 분해 X (PR 1개로 종결).

## 11. 카논 ref

- 부모 plan: [Phase 22 W1.5](../../plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md)
- 직전 핸드오프: [`memory/sessions/2026-04-29-phase-23-custom-image-pivot.md`](../../../memory/sessions/2026-04-29-phase-23-custom-image-pivot.md)
- 진단 카논: PR-173 retract 사유 (`tar: Cannot open: File exists`)
- PAT Blast Radius: [`infra/runners/README.md`](../../../infra/runners/README.md)
- single-concern PR: [`memory/feedback_branch_pr_workflow.md`](../../../memory/feedback_branch_pr_workflow.md)
- admin-skip 정책: [`memory/project_ci_admin_skip_until_2026-05-01.md`](../../../memory/project_ci_admin_skip_until_2026-05-01.md)
- 4-agent 카논 (사용자 override): [`memory/feedback_4agent_review_before_admin_merge.md`](../../../memory/feedback_4agent_review_before_admin_merge.md)
- file/함수 크기 티어: [`memory/feedback_file_size_limit.md`](../../../memory/feedback_file_size_limit.md)
- compound-mmp lifecycle: [`refs/lifecycle-stages.md`](../../../.claude/plugins/compound-mmp/refs/lifecycle-stages.md)
