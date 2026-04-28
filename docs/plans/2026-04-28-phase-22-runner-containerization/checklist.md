---
phase_id: "phase-22-runner-containerization"
phase_title: "Phase 22 — Runner Containerization"
created: 2026-04-28
status: "draft (사용자 승인 대기)"
from_previous_phase: "ci-infra-recovery (PR-164)"
waves: 4
prs_estimated: 3
---

# Phase 22 — Runner Containerization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** self-hosted runner를 호스트 직접 실행에서 myoung34/github-runner 4 컨테이너 ephemeral pool로 전환. PR-164의 fix(EACCES + port collision)를 넘어 runner workspace ↔ dev workspace 동거 함정 자체를 socket mount + named volume + 사용자 정의 bridge network로 근본 격리.

**Architecture:** macOS host에서 `infra/runners/docker-compose.yml`이 4 컨테이너(`containerized-runner-1~4`)를 `runners-net` bridge에 띄우고, fine-grained PAT로 GitHub에 자동 등록. job은 socket mount(`/var/run/docker.sock`)로 host docker daemon이 spawn. 4 wave 점진 마이그레이션(W1 부팅 → W2 smoke → W3 라벨 atomic switch → W4 host runner deregister).

**Tech Stack:** myoung34/github-runner image, docker compose, GitHub Actions runs-on 라벨, GitHub fine-grained PAT, named volumes.

**Spec:** `docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md` (commit `d954328`)
**Branch:** `feat/phase-22-runner-containerization` (created 2026-04-28)
**Predecessor:** PR-164 ci-infra-recovery (`dbe6a65`)

---

## Mandatory Slots

### qmd-recall-table (`mmp-plans` 5건, score 0.61 동률)

<!-- INJECT-RECALL-MANDATORY-START -->
| # | path | 핵심 인용 | docid | score |
|---|------|----------|-------|-------|
| 1 | `mmp-plans/2026-04-14-game-runtime/design.md` | Phase 18.0 게임 런타임 통합 설계 — 통합 런타임 아키텍처, feature flag 전략 | #2278da | 0.61 |
| 2 | `mmp-plans/2026-04-15-phase-18-1-hotfix/refs/local-e2e.md` | Phase 18.1 PR-4 — `game-session-live.spec.ts` 로컬 real-backend E2E 가이드 | #91bf46 | 0.61 |
| 3 | `mmp-plans/2026-04-08-engine-integration/refs/pr-6-progression-modules.md` | Engine integration Wave 4 PR-6 — Progression 7 modules wiring | #2cb5e2 | 0.61 |
| 4 | `mmp-plans/2026-04-10-editor-engine-redesign/refs/phase-a-engine-core.md` | Editor engine redesign Phase A — engine core 구현 plan | #6e2aa3 | 0.61 |
| 5 | `mmp-plans/2026-04-16-e2e-skip-recovery/refs/ci-promotion.md` | E2E skip recovery — real-backend CI promotion plan | #b7b376 | 0.61 |
<!-- INJECT-RECALL-MANDATORY-END -->

> **회상 약함 — 신규 토픽**. score 0.61 동률, 모두 일반 CI/E2E 운영 plan. self-hosted runner 키워드 검색 0건. Phase 22는 본 repo 최초의 runner containerization. brainstorm은 외부 ref(myoung34/github-runner README) + Phase 18.7 CI hardening 패턴 위주 진행.

### anti-pattern-check
- ❌ 기존 host runner 즉시 deregister (W4까지 fallback 보존) — 회귀 시 자동 흡수 보험
- ❌ host bindmount workspace (PR-164 root cause 재발) — `docker compose config | grep 'bind:'` 검증
- ❌ workflow `runs-on` 점진 변경 (half-state 회피) — W3 단일 PR atomic switch
- ❌ DinD 격리 (over-engineering, Q1 거부)
- ❌ host network mode (macOS Docker Desktop 부분 지원, Q4 거부)
- ❌ MD 500줄 cap 위반 — main checklist + refs 분할

---

## File Structure

| 파일/디렉토리 | 역할 | Wave |
|---|---|---|
| `infra/runners/docker-compose.yml` | 4 service (myoung34/github-runner) + named volume + network | W1 |
| `infra/runners/.env.example` | PAT placeholder + REPO_URL + DOCKER_GID | W1 |
| `infra/runners/.gitignore` | `.env` 보호 | W1 |
| `infra/runners/README.md` | bootstrap / register / rotate / decommission 운영 절차 | W1 |
| `.github/workflows/ci-containerized-smoke.yml` | hello-world + go test + ts test + bash 3.2 docker run | W2 |
| `.github/workflows/*.yml` (8 파일) | `runs-on` `[self-hosted, containerized]` 일괄 변경 + bash 3.2 step → docker run | W3 |
| `infra/runners/README.md` | W4 운영 절차 update (deregister + archive 기록) | W4 |

각 wave 독립 동작. **W1 → 4 컨테이너 idle 검증 → W2 → smoke green → W3 → 1주 관측 → W4** 순서.

---

## Wave/PR 분해

### Wave 1: Runner Pool 부팅 (PR-1)
- **PR-1** `infra/runners/` 신규 + 4 컨테이너 부팅 + GH 등록 — Effort M, Impact High
- 상세: [`refs/wave-1-runner-pool.md`](refs/wave-1-runner-pool.md)
- 검증: `docker compose ps` 4 healthy + GH UI에 4 row idle

### Wave 2: Smoke Workflow (PR-2)
- **PR-2** `.github/workflows/ci-containerized-smoke.yml` 신규 — Effort S, Impact High (W3 안전 가드)
- 상세: [`refs/wave-2-smoke-workflow.md`](refs/wave-2-smoke-workflow.md)
- 검증: smoke workflow 4 job green (hello / go / ts / bash 3.2)

### Wave 3: Workflow 라벨 일괄 변경 (PR-3)
- **PR-3** 모든 workflow `runs-on` → `[self-hosted, containerized]` + bash 3.2 step → docker run 인라인 변환 — Effort M, Impact High (atomic switch)
- 상세: [`refs/wave-3-label-switch.md`](refs/wave-3-label-switch.md)
- 검증: PR-3 자체 실행에서 12 job green + main 머지 후 7일 stable 관측

### Wave 4: Decommission (운영 노트, 코드 변경 없음)
- **운영 노트** GH UI deregister + `~/actions-runner` archive → 1주 후 rm
- 상세: [`refs/wave-4-decommission.md`](refs/wave-4-decommission.md)
- 검증: host에 `pgrep -f Runner.Listener` 0건 + GH UI에 host runner 0 row

---

## Carry-over

PR-164 4-agent 리뷰 LOW/MED 17건은 **별도 PR-11 hygiene**으로 분리 (Phase 22 scope 외). 본 plan은 runner containerization에만 집중. 17건 목록은 spec §11 참조.

---

## 검증 시뮬레이션

### Case A: W1 4 runner 부팅 → GH 등록 확인
1. 사용자가 `infra/runners/.env`에 fine-grained PAT 입력 (`ACCESS_TOKEN=ghp_...` + `REPO_URL=https://github.com/sabyunrepo/muder_platform` + `DOCKER_GID=$(stat -f '%g' /var/run/docker.sock)`).
2. `cd infra/runners && docker compose up -d`.
3. `docker compose ps` → 4 service `Up` (status healthy).
4. `docker compose logs runner-1 --tail 20 | grep "Listening for Jobs"` → match.
5. GitHub.com → repo Settings → Actions → Runners → 4 row (`containerized-runner-1`~`4`) status `Idle`, labels `self-hosted, linux, containerized`.
6. **Pass 기준**: 4 row idle + 5 분 내 status disconnect 없음.

### Case B: W2 smoke workflow 실행
1. PR-2 push → smoke workflow trigger.
2. GH UI에서 `Containerized Smoke` workflow run 진입.
3. 4 job (hello-world / go-build / ts-build / bash-3.2-test) 모두 green.
4. 각 job의 runner 라벨이 `containerized-runner-N` (1~4 중 하나) 표기.
5. **Pass 기준**: 4/4 green + bash 3.2 step에서 `bash --version` 출력이 `3.2.x`.

### Case C: W3 라벨 일괄 변경 후 모든 workflow green
1. PR-3 push → 모든 workflow trigger.
2. CI (4 job) + E2E (5 job) + Security Fast (2 job) + Security Deep (4 job) 등 12 job 실행.
3. 4-agent 리뷰 → admin-merge.
4. main 머지 후 7일 동안 PR/push의 fail rate가 PR-164 머지 시점 baseline 이하.
5. **Pass 기준**: PR-3 자체 12 job green + 7일 관측 fail rate 변동 없음.

### Case D: W4 deregister 후 host clean
1. GH UI에서 기존 host runner (예: `sabyun-mbp`) → Remove.
2. host: `mv ~/actions-runner ~/actions-runner.archive-2026-05-XX`.
3. `pgrep -f Runner.Listener` → 0건 (host actions-runner 프로세스 종료).
4. **Pass 기준**: host 프로세스 0 + GH UI host runner 0 + 4 containerized runner 정상 동작 유지.

---

## Out of Scope

- Job-level container isolation (workflow `container:` block).
- ARM64 dedicated runner image (myoung34 x86 emulation으로 충분).
- registry mirror / build cache 사이드카 (Phase 23 후보).
- DinD 격리.
- bash 3.2 step composite action 추출 (사용처 3+ 발생 시).
- PR-164 carry-over 17건 (별도 PR-11 hygiene).

---

## 진행 체크박스

### Wave 1 (PR-1)
- [ ] **W1-Task 1**: `infra/runners/` 디렉토리 + `.gitignore` 생성
- [ ] **W1-Task 2**: `docker-compose.yml` 작성 (4 service + volume + network + mem_limit)
- [ ] **W1-Task 3**: `.env.example` 작성
- [ ] **W1-Task 4**: `README.md` 작성 (bootstrap/register/rotate/decommission)
- [ ] **W1-Task 5**: `docker compose config` 검증 (host bindmount 0건 확인)
- [ ] **W1-Task 6**: 사용자 PAT 발급 + `.env` 채우기 (사용자 작업, Claude 안내)
- [ ] **W1-Task 7**: `docker compose up -d` + GH UI 4 row idle 확인 (사용자 + Claude)
- [ ] **W1-Task 8**: PR-1 생성 + 4-agent 리뷰 + admin-merge

### Wave 2 (PR-2)
- [ ] **W2-Task 1**: `.github/workflows/ci-containerized-smoke.yml` 작성 (4 job)
- [ ] **W2-Task 2**: PR-2 생성 → smoke workflow 실행 → 4 job green 확인
- [ ] **W2-Task 3**: 4-agent 리뷰 + admin-merge

### Wave 3 (PR-3)
- [ ] **W3-Task 1**: `.github/workflows/*.yml` grep 으로 `runs-on` 변경 대상 식별
- [ ] **W3-Task 2**: 모든 workflow `runs-on: self-hosted` → `runs-on: [self-hosted, containerized]` 일괄 변경
- [ ] **W3-Task 3**: bash 3.2 의존 step 식별 + `docker run --rm bash:3.2-alpine` 인라인 변환
- [ ] **W3-Task 4**: PR-3 생성 → 12 job green 확인
- [ ] **W3-Task 5**: 4-agent 리뷰 + admin-merge
- [ ] **W3-Task 6**: main 머지 후 7일 관측 (백그라운드 — Phase 23 진입 가능)

### Wave 4 (운영 노트)
- [ ] **W4-Task 1**: GH UI에서 host runner deregister (사용자 명시 작업)
- [ ] **W4-Task 2**: host에서 `~/actions-runner` → `~/actions-runner.archive-YYYY-MM-DD` 이름 변경
- [ ] **W4-Task 3**: `infra/runners/README.md` 운영 절차 업데이트 (decommission 기록)
- [ ] **W4-Task 4**: 1주 후 `rm -rf ~/actions-runner.archive-*` (사용자 작업, 별도 alarm)
- [ ] TaskList #1 (P5 Phase 22) `completed` 마킹

---

## 검증 (전체 plan 완료 시)

- [ ] PR-1, PR-2, PR-3 머지 완료 (3 commit on main)
- [ ] Case A~D 모두 Pass
- [ ] host에 `actions-runner` 프로세스 0 (`pgrep -f Runner.Listener` empty)
- [ ] GH UI에 4 containerized runner idle + host runner 0 row
- [ ] PR-3 머지 후 7일 fail rate stable
- [ ] `infra/runners/README.md` 최신 운영 절차 반영

---

## 사용자 승인 게이트

다음 진입은 **사용자 명시 승인 후**:
- `/compound-work PR-1` — W1 TDD 구현 시작
- 초안 직접 수정 — Wave/PR 분해 또는 task 단위 조정
- `/compound-cycle` — 현재 phase 상태 확인

---

## 카논 ref

- Spec: `docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md`
- 직전 세션 핸드오프: `memory/sessions/2026-04-28-ci-infra-recovery-phase-22-entry.md`
- ci-infra-recovery plan (sister): `docs/plans/2026-04-28-ci-infra-recovery/checklist.md`
- 사용자 설명 형식: `memory/feedback_explanation_style.md`
- 4-agent 리뷰: `memory/feedback_4agent_review_before_admin_merge.md`
- admin-skip 정책 (D-3, 2026-05-01 만료): `memory/project_ci_admin_skip_until_2026-05-01.md`
- branch + PR 워크플로우: `memory/feedback_branch_pr_workflow.md`
- Sonnet 4.6 위임: `memory/feedback_sonnet_46_default.md`
- 파일 크기 한도: `memory/feedback_file_size_limit.md`
- 외부: https://github.com/myoung34/docker-github-actions-runner
