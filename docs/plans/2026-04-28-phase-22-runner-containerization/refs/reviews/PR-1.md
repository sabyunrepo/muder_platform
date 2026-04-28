# PR-1 4-Agent Review (Phase 22 W1)

> **PR**: https://github.com/sabyunrepo/muder_platform/pull/165
> **Branch**: `feat/phase-22-runner-containerization`
> **Commits**: `d954328` (spec) + `3f40ae8` (plan) + `4f994c3` (W1 4 파일) + `40fa7f8` (repo owner hotfix)
> **Date**: 2026-04-28
> **Reviewers**: 4 parallel agents (security opus / perf sonnet / arch superpowers:code-reviewer opus / test sonnet)

## 종합

| 영역 | HIGH | MEDIUM | LOW |
|------|------|--------|-----|
| security | 0 | 3 | 2 |
| performance | 2 | 2 | 3 |
| architecture | 3 | 5 | 2 |
| test coverage | 2 | 4 | 1 |
| **합계 (raw)** | **7** | **14** | **8** |
| **dedup distinct** | **6 cluster** | — | — |

## HIGH 6 cluster (dedup)

### H-1 — Image `latest` tag 미pinning (PERF-2 + ARCH-2)
- **영향**: `myoung34/github-runner:latest` + `restart: always` + `EPHEMERAL=true` 조합. 컨테이너 재기동 시 또는 `docker compose pull` 시 upstream digest 교체 → silent breakage 또는 supply chain 침해 자동 전파. socket mount(Q1)로 host docker daemon 접근 가능 → 침해 blast radius 큼.
- **권장 수정 (1줄)**: `docker inspect myoung34/github-runner:latest --format='{{index .RepoDigests 0}}'`로 digest 취득 → `image: myoung34/github-runner@sha256:<digest>` 교체 + `pull_policy: never` 추가. Phase 18.7 Renovate 카논 재사용 (digest 자동 추적).
- **권고**: **즉시 수정**. 1줄 변경, blast radius 방어 효과 큼.

### H-2 — `restart: always` + PAT 만료 시 무한 CPU burn (PERF-3)
- **영향**: spec §7에 "5분 5회 fail 시 멈춤" 명시되어 있으나 docker-compose에 `max-retry` 없음. PAT 만료/네트워크 fail 시 4 컨테이너 × 32초 간격 무한 restart. CPU burn + GitHub API 401/429 누적.
- **권장 수정 (옵션 1, 즉시 가능)**: README Troubleshooting 섹션 1단락 추가 — `docker compose logs runner-1 | grep -c 'Token request failed'` 5회 이상이면 `.env` ACCESS_TOKEN 교체.
- **권장 수정 (옵션 2, watchdog)**: `infra/runners/scripts/healthcheck.sh` + macOS launchd cron. **W4 이후 별도 PR** 추천 (PR-1 scope 외).
- **권고**: **README 1단락은 즉시**, watchdog은 PR-11 hygiene 또는 W4 후속.

### H-3 — `LABELS` env precedence + Apple Silicon 컨텍스트 명시 부족 (ARCH-1)
- **영향**: `LABELS`가 compose `environment:`에 hard-code, `.env` override 시 silent override (warning 없음). `linux` 라벨이 macOS 호스트와 의미 충돌(컨테이너는 linux 맞음, 운영자 혼란). arm64/amd64 명시 부재 → Phase 23 ARM image 마이그레이션 시 workflow 분기 어려움.
- **권장 수정 (1줄)**: docker-compose.yml에 `# precedence: env_file < environment` 주석 + `LABELS`에 architecture 라벨 추가 검토 (Apple Silicon이면 `arm64`).
- **권고**: 주석 1줄 즉시. arm64 라벨은 Phase 23 ARM 진입 시 결정.

### H-4 — fine-grained PAT `Administration:write` = repo admin equivalent (ARCH-3)
- **영향**: `Administration:write`는 runner 등록 API(`registration-token`)에 필수지만 동일 scope이 **delete-repo / transfer-ownership / change-default-branch / manage-protections** 권한 동등. `feedback_branch_pr_workflow.md` main 보호 정책을 **이 PAT 하나로 우회 가능**. spec §3 Q2 brainstorm 결정의 도전.
- **권장 수정 (option A, 즉시)**: README에 1Password CLI 패턴 (`op run --env-file=.env -- docker compose up -d`) + 30일 회전 (admin-skip 정책 D-3 종료까지). `.env` plaintext 디스크 잔존 회피.
- **권장 수정 (option B, 후속)**: GitHub App installation token 마이그레이션 (spec Q2 거부 결정 재고). short-lived token + Administration scope 회피. **별도 phase**.
- **권고**: spec 결정 align한 명시 수용. README에 PAT blast radius 1줄 + 1Password 패턴 추가는 즉시.

### H-5 — Task 5 bindmount 검증 grep false alarm (TEST-1)
- **영향**: `wave-1-runner-pool.md` Task 5의 `grep -E '(type: bind|bind:)'`가 의도된 `/var/run/docker.sock` bindmount(Q1 결정)도 잡음. 검증 명령이 항상 hit → 매번 사용자가 "OK" 무시 또는 false positive로 W2 차단.
- **권장 수정 (1줄)**: grep 패턴을 `grep -v 'docker.sock' | grep -E 'type: bind'` 로 docker.sock 허용 리스트 처리. 또는 `grep 'source:.*runner._work'`로 named volume만 검증.
- **권고**: **즉시 수정** (plan 카논 신뢰성).

### H-6 — `DOCKER_GID` 빈/0 silent fail 검증 부재 (TEST-2)
- **영향**: macOS Docker Desktop 버전에 따라 GID 0 또는 빈 문자열 가능. compose가 `group_add: [""]`로 컨테이너에 전달 → entrypoint silent fail → `Listening for Jobs` log 안 나옴. Task 7 grep이 timeout 후에 알 수 있음.
- **권장 수정**: README Bootstrap에 `DOCKER_GID` 숫자 검증 step + Task 7 Step 2에 `docker compose logs runner-1 | grep -i 'permission denied'` 음성 확인 추가.
- **권고**: **즉시 수정** (W1-Task 7 시점 trace 어려움 회피).

## MEDIUM 14건 (요약)

- **SEC-1** PAT scope blast radius 명시 보강 — 즉시
- **SEC-2** docker.sock `:ro` 검토 (entrypoint write 필요라 불가, no-new-privileges 추가 검토) — PR-11 hygiene
- **SEC-3** image digest pinning — H-1과 중복
- **PERF-1** dev compose 동시 가동 RAM peak 측정 — W2 baseline
- **PERF-7** `security_opt: ["no-new-privileges:true"]` 추가 — PR-11 hygiene
- **ARCH-4** anchor merge 패턴 4× duplication "KEEP IN SYNC" 주석 — 즉시 (1줄)
- **ARCH-5** runners-net bridge YAGNI 도전 — spec §5.4 결정 align, 도전 acknowledge
- **ARCH-6** `infra/` 디렉토리 inconsistency (sister docker-compose 위치) — accept debt, spec에 명시
- **ARCH-7** sister-canon skip 명시 부재 — checklist에 1줄 추가
- **ARCH-8** README Decommission에 host runner archive 절차 부재 — W4 진입 전 README 보강
- **TEST-3** named volume per-runner 격리 실증 검증 — W2 smoke에 추가
- **TEST-4** Case A "5분 disconnect 없음" 자동 polling — Case A 보강
- **TEST-5** rollback 시 named volume cleanup 명시 — README Decommission 분기
- **TEST-6** PAT scope curl 검증 step — README + Task 6 보강

## LOW 8건 (요약)

- **SEC-4** PAT 회전 reminder (calendar/launchd) — W4 후속
- **SEC-5** runners-net egress 무제한 (macOS firewall 제약) — Phase 22+ 운영
- **PERF-4** Apple Silicon emulation wall clock baseline — W2 smoke
- **PERF-5** named volume 디스크 cleanup — W4 후속
- **PERF-6** bridge NAT 오버헤드 — 수용 가능, 조치 X
- **ARCH-9** `container_name` + `RUNNER_NAME` double-name — 운영 디버그용 유지
- **ARCH-10** `cpus:` budget 미명시 — Apple Silicon 8 core, runner 4 × 1.5 추가 검토
- **TEST-7** TDD N/A 명시 — PR description에 이미 1줄, OK

## 권장 액션 — H-1~H-6 즉시 수정 cluster

PR-1 머지 전 다음 8 line 변경으로 HIGH 6건 모두 해소 가능 (carry-over 0):

1. **H-1** (docker-compose.yml): image latest → digest pinning (1줄 + pull_policy)
2. **H-2** (README.md): Troubleshooting "PAT 만료 detection" 1단락
3. **H-3** (docker-compose.yml): `# precedence` 주석 1줄
4. **H-4** (README.md): Bootstrap에 1Password CLI + 30일 회전 1단락
5. **H-5** (refs/wave-1-runner-pool.md): Task 5 grep 패턴 수정 (docker.sock 허용)
6. **H-6** (README.md + refs/wave-1-runner-pool.md): DOCKER_GID 숫자 검증 + permission denied 음성 확인

W4 후속/PR-11 hygiene으로 이월: H-2 watchdog, SEC-2/3, PERF-7, TEST-3 격리 실증 등.

## 사용자 결정 후보

- **(a) 즉시 수정** — 위 8 line hotfix commit + 본 PR-1에 push (PR-1 단일 카논 유지)
- **(b) 다음 PR 이월** — H-1, H-3, H-5는 즉시 / H-2, H-4, H-6는 PR-11 hygiene
- **(c) 무시** — H-4 (spec §3 Q2 brainstorm 결정 align 수용) 외에는 권장 X
- **(d) admin-merge 진행** — HIGH 잔존 상태 머지는 카논 위반 (`memory/feedback_4agent_review_before_admin_merge.md`)

## 카논 ref

- 본 review: `docs/plans/2026-04-28-phase-22-runner-containerization/refs/reviews/PR-1.md`
- Spec: `docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md`
- Plan: `docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md`
- 4-agent 카논: `memory/feedback_4agent_review_before_admin_merge.md`
- post-task-pipeline 매핑: `.claude/plugins/compound-mmp/refs/post-task-pipeline-bridge.md`
- Sim case A: `.claude/plugins/compound-mmp/refs/sim-case-a.md`
