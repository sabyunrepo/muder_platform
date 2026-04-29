---
name: CI admin-skip 머지 정책 (만료됨 — 2026-04-29)
description: 2026-04-18 도입, 2026-04-29 만료. PR-170 (Phase 22 W1.5) 4 main DEBT 일괄 처리 + testcontainers-go fold-in 으로 main CI 정상화 → admin-skip 종료, 정상 PR 머지 모드 복귀.
type: project
---

## 만료 (2026-04-29)

**사용자 결정 — admin-skip 즉시 만료**. 이후 모든 PR 은 `gh pr merge --squash` (admin 없이) 정상 머지.

### 만료 가능 조건 충족

PR-170 (`chore/w1-5-runner-action-compat`) 머지 직전 main DEBT 5건 모두 해소:
- ✅ DEBT-1 gitleaks-action artifact upload (PR-170 fold-in: `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false`)
- ✅ DEBT-2 CodeQL JS-TS Node v20 (PR-170 fold-in: setup-node@v4 + `/usr/local/bin` symlink)
- ✅ DEBT-3 Trivy docker.sock (PR-170 hotfix: docker save tarball + trivy-action input mode)
- ✅ DEBT-4 Go Lint+Test services block (PR-170 fold-in: PR-168 e2e-stubbed.yml 패턴 + testcontainers-go fold-in: `sudo -E go test`)
- ✅ ci-hooks workflow shellcheck cascade (PR-168 머지 시 자동 해소)

### Why 만료

main 의 13 required check 가 PR-170 으로 ALL pass 가능 상태 도달 → 더 이상 admin-skip 가릴 부채 없음. admin-skip 가 가린 부채 없이 정상 진행 가능.

## How to apply (만료 후)

- **PR 머지**: `gh pr merge <N> --squash` (admin 권한 사용 X)
- **CI red 시**: 머지 차단됨 → 부채 노출 즉시 fix PR 또는 hotfix 진입
- **예외**: 보안·데이터 마이그레이션·권한 경로 변경 PR 은 사용자 사전 확인 후 진행 (정책 무관 — 기존과 동일)

## 만료 이전 정황 (이력 보존)

### 도입 (2026-04-18)
CI 인프라 부채 (golangci-lint↔Go1.25 incompatibility, ESLint9 config 미흡 등 — `feedback_ci_infra_debt.md` 참조) 로 main 자체 CI red. 기다리면 green 확보 불가 + Phase 20 이후 작업 차단 → admin-skip 임시 도입.

### 1차 만료 시도 (2026-04-28) → reverse
- PR-164 (`dbe6a65`) ci-infra-recovery 머지로 인프라 부채 일부 해소
- 사용자 결정: 2026-04-28 D-3 조기 만료
- 그러나 admin-skip 만료 시도 시 PR-166 + PR-165 CI 결과로 main 누적 부채 5건 노출:
  - Go Lint (gofmt 3 + staticcheck 1)
  - E2E backend register 500
  - gitleaks 진행 중
  - govulncheck 진행 중
- admin-skip 가린 lint debt = 정상 머지 시도 시 즉시 차단
- 결정: 부채 정리까지 admin-skip 유지 (부채 정리 phase 후 재만료 평가)

### 2026-04-29 PR-170 진입
- DEBT-1/2/3/4 + testcontainers-go pre-existing 부채 모두 PR-170 에서 일괄 해소
- 4-agent review 4건 모두 conditional pass (HIGH carry-over, MED 일부 fold-in)
- 모든 main DEBT 해소 → admin-skip 만료 가능 조건 충족

## 카논 ref

- `memory/feedback_branch_pr_workflow.md` (main 보호 + PR 필수)
- `memory/feedback_4agent_review_before_admin_merge.md` (HIGH 잔존 머지 금지)
- `memory/feedback_ci_infra_debt.md` (이전 부채 — PR-164/PR-167/PR-170 에서 모두 해소)
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md` (W1.5 mini-plan)
