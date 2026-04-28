# CI Infra Recovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-hosted runner CI 12 job fail 정상화 — `apps/server/tmp/build-errors.log` EACCES + postgres 5432 host port collision 두 root cause 영구 제거.

**Architecture:** dev 컨테이너를 호스트 UID/GID와 매칭되는 non-root user로 동작시켜 host bindmount의 root 소유 파일 생성을 차단. CI workflow는 service container의 host port 매핑을 ephemeral로 전환하고 `${{ job.services.X.ports['Y'] }}` 템플릿으로 동적 참조. dev/prod compose 분리 + Phase 18.3 카논(golangci-lint v2 + ESLint 9) 그대로 유지.

**Tech Stack:** Docker (alpine multi-stage), docker-compose, GitHub Actions service containers, goose migration, psql, bash env interpolation.

**Spec:** `docs/superpowers/specs/2026-04-28-ci-infra-recovery-design.md` (commit `39a56fe`)
**Branch:** `fix/ci-infra-recovery` (created 2026-04-28)
**Pre-flight cleanup:** runner host `sudo rm -rf .../apps/server/tmp/*` — **2026-04-28 사용자 완료**

---

## Mandatory Slots

- **qmd-recall-table**: Phase 18.3 PR-1 (`#0282fc` ci-infra.md, `#035d77` checklist) — 코드 레벨 부채 무관. `feedback_ci_infra_debt.md` outdated 표기.
- **anti-pattern-check**: workflow `sudo rm -rf` step X (root cause 우회), prod Dockerfile 변경 X (scope 위반), admin-skip 해제 같이 X (single concern), MD 500줄 cap 준수 (index + refs 분할).

---

## File Structure

| 파일 | 역할 | 변경 그룹 |
|---|---|---|
| `apps/server/Dockerfile.dev` | dev hot-reload 컨테이너 | A. dev compose |
| `docker-compose.dev.yml` | dev compose override (bindmount) | A. dev compose |
| `.github/workflows/ci.yml` | go-check + ts-check + coverage + docker-build | B. workflow |
| `.github/workflows/e2e-stubbed.yml` | E2E (4 shard) + merge-reports | B. workflow |
| `apps/server/CLAUDE.md` | server 룰 + dev 시작 명령 | C. docs |

각 그룹 독립 동작. **A → 검증 → B → 검증 → C** 순서로 진행 (의존성 없으나 검증 단계 분리).

---

## Task Overview

| Task | 범위 | Detail |
|---|---|---|
| 1 | Dockerfile.dev — non-root user ARG/USER | [`refs/task-1-2-dev-compose.md`](refs/task-1-2-dev-compose.md#task-1) |
| 2 | docker-compose.dev.yml — HOST_UID/HOST_GID 주입 | [`refs/task-1-2-dev-compose.md`](refs/task-1-2-dev-compose.md#task-2) |
| 3 | ci.yml — postgres/redis ephemeral port + env 템플릿 | [`refs/task-3-4-workflows.md`](refs/task-3-4-workflows.md#task-3) |
| 4 | e2e-stubbed.yml — 동일 + goose/psql 템플릿 | [`refs/task-3-4-workflows.md`](refs/task-3-4-workflows.md#task-4) |
| 5 | apps/server/CLAUDE.md — dev 시작 명령 카논 | [`refs/task-5-docs.md`](refs/task-5-docs.md) |
| 6 | 로컬 dev compose 회귀 검증 | [`refs/task-6-local-verify.md`](refs/task-6-local-verify.md) |
| 7 | push & 12 job CI green 검증 | [`refs/task-7-9-merge.md`](refs/task-7-9-merge.md#task-7) |
| 8 | 4-agent 병렬 리뷰 (compound-review) | [`refs/task-7-9-merge.md`](refs/task-7-9-merge.md#task-8) |
| 9 | admin-merge + 사용자 dev rebuild 안내 | [`refs/task-7-9-merge.md`](refs/task-7-9-merge.md#task-9) |

---

## 진행 체크박스

- [x] **Task 1**: Dockerfile.dev 수정 + 로컬 build/run 권한 검증 + commit (`0cfbbf8`)
- [x] **Task 2**: docker-compose.dev.yml 수정 + dev 띄우기 검증 + commit (`0cfbbf8`)
- [x] **Task 3**: ci.yml ports + env 템플릿 (`c29c6df`)
- [x] **Task 4**: e2e-stubbed.yml ports + env + goose + psql 템플릿 + commit (3+4 묶음, `c29c6df` + `1ac6d20` 인라인 코멘트)
- [x] **Task 5**: apps/server/CLAUDE.md dev 명령 카논 + commit (`8d4135d`, dev port shift 25432/26379 포함)
- [x] **Task 6**: 로컬 dev compose 회귀 검증 (runner에서 직접 검증 — image build OK + 호스트 user owner sabyun:sabyun + 25432/26379 healthy + langfuse no collision, 2026-04-28)
- [x] **Task 7**: push + PR 생성 (PR #164) + 12 job CI green 폴링 (CI 진행 중)
- [x] **Task 8**: 4-agent 병렬 리뷰 (`refs/reviews/PR-164.md`, HIGH 0 실질 / IMPORTANT 3 fold-in 완료)
- [ ] **Task 9**: admin-merge + main pull + dev rebuild 안내
- [ ] TaskList #1 (P1) `completed` 마킹 → P2 자동 unblock

---

## 검증 (전체 plan 완료 시)

- [ ] Task 1~5 commit 4~5건
- [ ] Task 6 로컬 dev 회귀 PASS (air + 호스트 user owner)
- [ ] Task 7.3 self-hosted runner **13 검사** green (CI 4 + E2E 5 + Security Fast 2 + Security Deep 4)
- [ ] Task 8 4-agent HIGH 0 (또는 RESOLVED)
- [ ] Task 9 admin-merge 완료 + dev rebuild 안내 확인

## 카논 ref

- Spec: `docs/superpowers/specs/2026-04-28-ci-infra-recovery-design.md`
- 사용자 설명 형식: `memory/feedback_explanation_style.md`
- 4-agent 리뷰 카논: `memory/feedback_4agent_review_before_admin_merge.md`
- admin-skip 정책: `memory/project_ci_admin_skip_until_2026-05-01.md`
- branch + PR 워크플로우: `memory/feedback_branch_pr_workflow.md`
- Sonnet 4.6 위임: `memory/feedback_sonnet_46_default.md`
- 파일 크기 한도: `memory/feedback_file_size_limit.md`
