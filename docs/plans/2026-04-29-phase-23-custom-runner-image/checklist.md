---
phase_id: "phase-23-custom-runner-image"
phase_title: "Phase 23 — Custom Runner Image (Option A multi-stage)"
created: 2026-04-29
status: "completed (2026-04-30) — PR #174 squash 025ed78 + hotfix #175 squash c32d123. follow-ups → memory/project_phase21_backlog.md 이월"
parent_phase: "phase-22-w1-5-debt-cleanup"
spec: "docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md"
prs_estimated: 1
prs_actual: 2
follow_ups_resolution:
  - P0-2 GHCR repo connection — 사용자 manual 1회 작업 완료
  - P0-3 PR-5 #172 — outdated close (main이 arc-runner-set 으로 진화)
  - P0-1 / P1-4 / P1-5 / P1-6 / P1-7 — Phase 21 backlog 이월
---

# Phase 23 — Custom Runner Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans` 로 task 단위 실행. 모든 코드 작성은 sonnet-4-6 sub-agent 위임 (`memory/feedback_sonnet_46_default.md` 카논).
>
> **Spec 카논 단일 source**: `docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md` (343 line, 모든 코드 예시 포함). 본 plan은 task 추적용. Spec과 drift 시 **spec 우선** + plan revise.
>
> **MD 500-line 카논**: 본 checklist는 index. Wave별 task 상세는 `refs/wave-N-*.md`로 분할.

**Goal:** Custom Runner Image (`ghcr.io/sabyunrepo/mmp-runner`) 도입으로 (a) myoung34 EPHEMERAL fs 잔존 정공 + (b) 9 workflow 우회 step 제거 + (c) GHCR build CI 정착.

**Architecture:** multi-stage Dockerfile (builder=ubuntu:22.04 + final=myoung34 base) + `ACTIONS_RUNNER_HOOK_JOB_STARTED` cleanup script + `.github/workflows/build-runner-image.yml` (GHA cache, Public visibility, GITHUB_TOKEN). 단일 mega PR (4-agent 우회, admin-skip 머지).

**Tech Stack:** Docker multi-stage, GitHub Actions (`docker/build-push-action@v5`, `docker/login-action@v3`), Bash (cleanup hook), GHCR Public.

---

## File Structure

| 변경 | 경로 | 책임 | 작성 task |
|------|------|------|----------|
| 신규 | `infra/runners/Dockerfile` | multi-stage 이미지 정의 (Spec 4.1) | Wave 1 Task 2 |
| 신규 | `infra/runners/hooks/job-started.sh` | EPHEMERAL fs cleanup (Spec 4.2) | Wave 1 Task 1 |
| 신규 | `infra/runners/hooks/job-started.test.sh` | hook bash unit test (TDD) | Wave 1 Task 1 |
| 신규 | `.github/workflows/build-runner-image.yml` | PR build + verify, main GHCR push (Spec 4.3) | Wave 1 Task 3 |
| 수정 | `infra/runners/docker-compose.yml` | image: + pull_policy: 변경 (Spec 4.4) | Wave 2 Task 4 |
| 수정 | `infra/runners/README.md` | Custom Image 섹션 + GHCR 첫 push 절차 | Wave 2 Task 5 |
| 수정 | `.github/workflows/ci.yml` | sudo go test 제거, ownership step 제거, jq install 제거, manual sudo docker build 정리 | Wave 3 Task 6 |
| 수정 | `.github/workflows/security-deep.yml` | CodeQL setup-node + symlink 제거; Trivy sudo docker 제거 + image cleanup 1줄 추가 (#2) | Wave 3 Task 7-8 |
| 수정 | `.github/workflows/security-fast.yml` | `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false` env 제거 (#3) | Wave 3 Task 9 |

**Out of scope** (별 phase): Composite action 추출 (Arch-HIGH-1), gitleaks SARIF/upload 메커니즘 재설계 (verify fail 시), ARM64 build, multi-stage builder 보안 표면 정량 측정.

---

## Wave 인덱스

각 wave 상세는 `refs/wave-N-*.md`. 본 checklist는 task 진행 추적용 체크박스만 유지.

### Wave 0 — Worktree 분기 ([refs/wave-0-setup.md](refs/wave-0-setup.md))

- [ ] **Task 0**: `superpowers:using-git-worktrees`로 분기 + spec/plan untracked 인계

### Wave 1 — Image Build Infrastructure ([refs/wave-1-image-build.md](refs/wave-1-image-build.md))

- [ ] **Task 1**: cleanup hook script `job-started.sh` + bash unit test (TDD red→green→commit)
- [ ] **Task 2**: multi-stage `Dockerfile` (Spec 4.1) + 로컬 docker build syntax 검증 + ad-hoc 컨테이너 verify + commit
- [ ] **Task 3**: `.github/workflows/build-runner-image.yml` (Spec 4.3) + yaml syntax 검증 + commit

### Wave 2 — Compose + README ([refs/wave-2-compose-readme.md](refs/wave-2-compose-readme.md))

- [ ] **Task 4**: `infra/runners/docker-compose.yml` image + pull_policy 2줄 patch + `docker compose config` 검증 + commit
- [ ] **Task 5**: `infra/runners/README.md`에 "Custom Image (Phase 23+)" 섹션 + GHCR 첫 push 운영 절차 + 사용자 host 재배포 + Rollback + commit

### Wave 3 — 9 workflow Dead Code 정리 (Fold-In) ([refs/wave-3-workflow-cleanup.md](refs/wave-3-workflow-cleanup.md))

- [ ] **Task 6**: `ci.yml` sudo docker / sudo go test / ownership step / jq install / manual docker build 정리 + commit
- [ ] **Task 7**: `security-deep.yml` CodeQL setup-node + symlink override 제거 + commit
- [ ] **Task 8**: `security-deep.yml` Trivy sudo docker 정리 + image cleanup 1줄 (#2 fold-in) + commit
- [ ] **Task 9**: `security-fast.yml` `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false` env 제거 (#3 fold-in) + commit

### Wave 4 — Code Review + PR ([refs/wave-4-pr.md](refs/wave-4-pr.md))

- [ ] **Task 10**: 로컬 docker build 종합 검증 (선택, PR CI 위임 가능)
- [ ] **Task 11**: 모든 commit 확인 + spec/plan 첫 stage commit + branch push
- [ ] **Task 12**: `superpowers:requesting-code-review` 호출 (4-agent 우회, 사용자 명시 결정) + fix fold-in
- [ ] **Task 13**: PR 생성 + build-runner-image.yml CI verify 통과 확인 + 사용자 결정 admin-skip 머지

### Wave 5 — Operational Verify (사용자 host 작업) ([refs/wave-5-operational.md](refs/wave-5-operational.md))

- [ ] **Task 14**: GHCR push 성공 확인 + Public visibility + 첫 push 후 repo connection 1회 설정
- [ ] **Task 15**: 사용자 host SSH 재배포 (`docker compose pull && up -d`) + 4 runner idle 확인 + 사전 install + hook env 확인
- [ ] **Task 16**: 첫 실 CI run cleanup hook fire + tar 충돌 0건 + GHA cache size + gitleaks artifact upload (#3 verify, fail 시 hotfix + #3 follow-up PR)
- [ ] **Task 17**: PR-5 (#172) main rebase + CI 자연 통과 + 머지 (자동 unblock)
- [ ] **Task 18**: Spec 7.5 종료 조건 8건 verify + `/compound-wrap` 호출 + status `closed`

---

## Self-Review (writing-plans 카논)

### Spec coverage
- Spec § 4.1 Dockerfile → Task 2 ✓
- Spec § 4.2 hook script → Task 1 ✓
- Spec § 4.3 build CI workflow → Task 3 ✓
- Spec § 4.4 compose 변경 → Task 4 ✓
- Spec § 4.5 9 workflow 정리 → Task 6-9 ✓
- Spec § 6 Error Handling → Wave 5 verify steps + Task 16 fail 분기 ✓
- Spec § 7 Testing → Task 1 (TDD) + Task 2 step 2-4 + Task 16 ✓
- Spec § 7.5 종료 조건 → Task 18 ✓

### Placeholder scan
- "결정 필요" / "TBD" / "TODO" / "fill in" 매칭 0건 (모든 step 실 명령 + 코드 inline 또는 spec reference)
- 사용자 host 정보 (sabyun@100.90.38.7) 명시 (Wave 2 Task 5 + Wave 5 Task 15)
- GHCR repo connection 절차 명시 (Wave 2 Task 5 + Wave 5 Task 14)

### Type consistency
- `mmp-runner` 이미지 이름 모든 task 일치
- `ACTIONS_RUNNER_HOOK_JOB_STARTED=/opt/runner-hooks/job-started.sh` 경로 모든 task 일치
- `chore/phase-23-custom-runner-image` 브랜치 이름 모든 task 일치
- `ghcr.io/sabyunrepo/mmp-runner:latest` GHCR 경로 모든 task 일치

### Scope check
- single mega PR로 결정 (사용자) → Wave 분해 0~5 (워크플로우 단계, PR 분해 X)
- Out of Scope 명시 (Composite action, gitleaks 메커니즘 재설계)

### MD 500-line 카논 align
- 본 checklist는 index (~150 line)
- Wave 상세는 `refs/wave-N-*.md`로 분할 (`feedback_file_size_limit.md` 카논)

---

## 사용자 승인 게이트

다음 진입은 **사용자 명시 승인 후**:
- `/compound-work Task-0` 또는 worktree 분기 직접 진행 (Wave 0 시작)
- 초안 직접 수정 — Wave/Task 분해 또는 step 단위 조정
- `/compound-cycle` — 본 plan 진행 상태 확인

---

## 카논 ref

- Spec 단일 source: [Phase 23 design](../../superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md)
- 부모 plan: [Phase 22 W1.5](../2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md)
- 직전 핸드오프: [`memory/sessions/2026-04-29-phase-23-custom-image-pivot.md`](../../../memory/sessions/2026-04-29-phase-23-custom-image-pivot.md)
- single-concern PR 카논: [`memory/feedback_branch_pr_workflow.md`](../../../memory/feedback_branch_pr_workflow.md)
- admin-skip 정책: [`memory/project_ci_admin_skip_expired_2026-04-29.md`](../../../memory/project_ci_admin_skip_expired_2026-04-29.md) (만료됨 2026-04-29, Phase 23은 explicit 사용자 결정 카논으로 admin-skip 사용)
- 4-agent 카논 (사용자 override): [`memory/feedback_4agent_review_before_admin_merge.md`](../../../memory/feedback_4agent_review_before_admin_merge.md)
- file size 카논: [`memory/feedback_file_size_limit.md`](../../../memory/feedback_file_size_limit.md)
- Sonnet 4.6 sub-agent: [`memory/feedback_sonnet_46_default.md`](../../../memory/feedback_sonnet_46_default.md)
- compound-mmp lifecycle: [`refs/lifecycle-stages.md`](../../../.claude/plugins/compound-mmp/refs/lifecycle-stages.md)
