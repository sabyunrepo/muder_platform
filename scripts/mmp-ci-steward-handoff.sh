#!/usr/bin/env bash
# Print a copy-ready handoff prompt for an MMP CI steward agent.

set -euo pipefail

usage() {
  cat <<'MSG'
Usage: scripts/mmp-ci-steward-handoff.sh [PR_NUMBER]

지정한 PR의 현재 상태를 요약하고, 별도 Codex pane/sub-agent에 붙여넣을
CI steward handoff prompt를 출력합니다.

Steward의 범위:
- 단일 PR branch/worktree의 CodeRabbit, Codecov, CI 보정
- main Codex가 명시한 경우에만 strict up-to-date merge gate 해소용 GitHub PR branch update
- 해결이 확인된 대상 PR review thread 정리
- focused validation 및 fix commit push
- ready-for-ci guard 통과 후 라벨 적용

Steward가 하지 않는 일:
- PR 생성, Issue 생성, merge, force-push, destructive git
MSG
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: $1" >&2
    exit 127
  fi
}

review_thread_counts() {
  local owner="$1"
  local repo="$2"
  local pr_number="$3"
  local graphql_query after_cursor threads_json page_unresolved page_total has_next
  # shellcheck disable=SC2016
  graphql_query='query($owner:String!, $repo:String!, $number:Int!, $after:String) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:100, after:$after) { nodes { isResolved } pageInfo { hasNextPage endCursor } } } } }'
  after_cursor=""
  local unresolved=0
  local total=0
  while :; do
    if [[ -z "$after_cursor" ]]; then
      threads_json="$(gh api graphql -F owner="$owner" -F repo="$repo" -F number="$pr_number" -f query="$graphql_query")"
    else
      threads_json="$(gh api graphql -F owner="$owner" -F repo="$repo" -F number="$pr_number" -F after="$after_cursor" -f query="$graphql_query")"
    fi
    page_unresolved="$(printf '%s' "$threads_json" | jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length')"
    page_total="$(printf '%s' "$threads_json" | jq '[.data.repository.pullRequest.reviewThreads.nodes[]] | length')"
    unresolved=$((unresolved + page_unresolved))
    total=$((total + page_total))
    has_next="$(printf '%s' "$threads_json" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')"
    [[ "$has_next" == "true" ]] || break
    after_cursor="$(printf '%s' "$threads_json" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')"
  done
  printf '%s %s\n' "$unresolved" "$total"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

require_cmd gh
require_cmd git
require_cmd jq

pr_number="${1:-}"
if [[ -z "$pr_number" ]]; then
  pr_number="$(gh pr view --json number --jq '.number')"
fi

owner="$(gh repo view --json owner --jq '.owner.login')"
repo="$(gh repo view --json name --jq '.name')"
repo_root="$(git rev-parse --show-toplevel)"
current_branch="$(git branch --show-current)"

pr_json="$(gh pr view "$pr_number" --json number,title,url,state,headRefName,headRefOid,baseRefName,mergeStateStatus,reviewDecision,labels)"
pull_json="$(gh api "repos/$owner/$repo/pulls/$pr_number")"
protection_json="$(gh api "repos/$owner/$repo/branches/$(printf '%s' "$pr_json" | jq -r '.baseRefName')/protection" 2>/dev/null || printf '{}')"
number="$(printf '%s' "$pr_json" | jq -r '.number')"
title="$(printf '%s' "$pr_json" | jq -r '.title')"
url="$(printf '%s' "$pr_json" | jq -r '.url')"
state="$(printf '%s' "$pr_json" | jq -r '.state')"
head="$(printf '%s' "$pr_json" | jq -r '.headRefName')"
head_sha="$(printf '%s' "$pr_json" | jq -r '.headRefOid')"
base="$(printf '%s' "$pr_json" | jq -r '.baseRefName')"
merge_state="$(printf '%s' "$pr_json" | jq -r '.mergeStateStatus // "UNKNOWN"')"
mergeable_state="$(printf '%s' "$pull_json" | jq -r '.mergeable_state // "unknown"')"
strict_status_checks="$(printf '%s' "$protection_json" | jq -r '.required_status_checks.strict // false')"
review_decision="$(printf '%s' "$pr_json" | jq -r '.reviewDecision // "UNKNOWN"')"
labels="$(printf '%s' "$pr_json" | jq -r '[.labels[].name] | if length == 0 then "없음" else join(", ") end')"

read -r unresolved_threads total_threads < <(review_thread_counts "$owner" "$repo" "$number")

# shellcheck disable=SC2016
latest_coderabbit="$(gh pr view "$number" --json reviews,comments --jq '([.reviews[] | select((.author.login == "coderabbitai[bot]") or (.author.login == "coderabbitai"))] | last) as $review | if $review then ($review.state + " @ " + $review.submittedAt) else (([.comments[] | select((.author.login == "coderabbitai") or (.author.login == "coderabbitai[bot]") or (.body | contains("coderabbit.ai")))] | last) as $comment | if $comment then ("comment @ " + $comment.createdAt) else "없음" end) end')"
checks_summary="$(gh pr checks "$number" --json name,bucket,state,link 2>/dev/null | jq -r 'if length == 0 then "checks 없음" else .[] | "- " + .name + ": " + (.bucket // "unknown") + "/" + (.state // "unknown") + " " + (.link // "") end' || printf 'checks 조회 실패')"
ci_scope_env="$(scripts/mmp-pr-ci-scope.sh "$number" --format env)"
eval "$ci_scope_env"
if [[ "$CI_SCOPE" == "code-rabbit-only" ]]; then
  steward_mode="code-rabbit-only exception"
  ci_instruction="이 PR은 heavy CI path filter에 걸리는 파일이 없습니다. ready-for-ci 라벨, workflow_dispatch, full CI 대기를 하지 마세요. CodeRabbit clear + unresolved 0 + light checks + 변경 스크립트/설정 focused validation이 완료 조건입니다."
  merge_ready_rule="MERGE_READY 또는 MERGE_CANDIDATE: code-rabbit-only exception 근거 확인, unresolved thread 0, CodeRabbit clear, light checks pass, changed scripts/config focused validation pass. ready-for-ci 라벨과 required workflow green은 요구하지 않습니다. strict behind만 남으면 MERGE_CANDIDATE로 보고하고 main Codex가 admin merge 또는 update를 결정합니다."
  copy_ready_rule="이 PR은 code-rabbit-only exception입니다. MMP_CI_STEWARD=1 scripts/mmp-pr-watch.sh $number --code-rabbit-only 로 CodeRabbit/threads 상태만 확인하고, ready-for-ci 라벨이나 workflow_dispatch/full CI는 실행하지 마세요. main Codex가 명시하지 않은 branch update는 하지 마세요."
  full_ci_wait_rule="이 PR에서는 full CI required workflow 대기를 하지 마세요. missing heavy-CI context는 path-filter 기대 동작입니다."
else
  steward_mode="full-ci"
  ci_instruction="이 PR은 heavy CI trigger path를 변경했습니다. CodeRabbit 정리 후 scripts/pr-ready-for-ci-guard.sh --apply $number 로 ready-for-ci 라벨을 붙이고, scripts/mmp-pr-watch.sh $number --trigger-missing-workflows 로 현재 head SHA의 required workflow를 확인하세요. strict behind는 품질 실패가 아니므로 main Codex가 merge batch 순서에서 update 또는 admin merge를 결정합니다."
  merge_ready_rule="MERGE_READY 또는 MERGE_CANDIDATE: unresolved thread 0, CodeRabbit clear, ready-for-ci label present, required checks green, Codecov 기준 충족 또는 비대상 근거 확인. strict behind만 남으면 MERGE_CANDIDATE로 보고하고 main Codex가 admin merge 또는 update를 결정합니다."
  copy_ready_rule="CodeRabbit 통과 후 scripts/pr-ready-for-ci-guard.sh --apply $number 와 MMP_CI_STEWARD=1 scripts/mmp-pr-watch.sh $number --trigger-missing-workflows 를 이어서 실행하세요. main Codex가 명시하지 않은 branch update는 하지 마세요."
  full_ci_wait_rule="라벨 이벤트만 기다리지 마세요. required workflow(CI, E2E — Stubbed Backend, Security — Fast Feedback)가 현재 head SHA에 없으면 watcher가 workflow_dispatch로 생성해야 합니다."
fi
state_note=""
if [[ "$state" != "OPEN" ]]; then
  state_note="주의: 이 PR은 현재 $state 상태입니다. 실제 steward handoff는 OPEN PR에 사용하세요."
fi

cat <<MSG
# MMP CI Steward Handoff

## 목표
단일 PR #$number 의 CodeRabbit 리뷰, Codecov, CI 보정을 steward에게 맡기고, 메인 Codex는 별도 worktree에서 다음 이슈를 계속 진행합니다.
$state_note

## 현재 PR
- PR: #$number $title
- URL: $url
- State: $state
- Branch: $head -> $base
- Head SHA: $head_sha
- Merge state: $merge_state
- REST mergeable_state: $mergeable_state
- Base requires up-to-date checks: $strict_status_checks
- Review decision: $review_decision
- Labels: $labels
- CodeRabbit latest: $latest_coderabbit
- Review threads: unresolved $unresolved_threads / total $total_threads
- CI scope: $steward_mode
- Heavy CI trigger files: ${CI_HEAVY_FILES:-없음}
- Light/operational files: ${CI_LIGHT_FILES:-없음}
- Repo root: $repo_root
- Current local branch: $current_branch

## Checks
$checks_summary

## CI scope 판단
$ci_instruction

## Steward 허용 범위
- 이 PR branch/worktree에서만 CodeRabbit, CI, Codecov 원인을 확인하고 수정합니다.
- 타당한 리뷰/실패만 고치고 focused validation을 실행한 뒤 fix commit을 push할 수 있습니다.
- 최종 보고 직전 반드시 scripts/mmp-pr-status.sh $number --fail-on-blocker --allow-behind 를 실행합니다. 이 명령이 실패하면 MERGE_READY/MERGE_CANDIDATE 보고 금지이며, 남은 thread/check를 계속 처리하거나 BLOCKED로 보고합니다.
- CodeRabbit check pass는 충분 조건이 아닙니다. Review threads unresolved 0, GitHub review decision non-blocking, CodeRabbit actionable state clear를 모두 만족해야 합니다.
- Codecov patch coverage 70% 미만은 실제 blocker입니다. scripts/mmp-pr-status.sh가 Codecov gate state를 blocker로 표시하면 해당 changed file/branch를 덮는 focused test를 추가하고 다시 검증하세요.
- Coverage Plan 또는 deferred/follow-up 추적이 누락되어 PR/Issue metadata 수정이 필요하면 main Codex로 `NEEDS_FIX` 또는 `BLOCKED`를 보고하세요. steward가 직접 PR 본문이나 Issue checklist를 수정하지 않습니다.
- 남은 review thread가 현재 코드와 테스트로 해결됐다고 검증되면 steward가 해당 thread만 resolve할 수 있습니다. 애매하거나 사용자-authored thread면 resolve하지 말고 BLOCKED로 보고합니다.
- Base requires up-to-date checks가 true이고 REST mergeable_state가 behind이면 자동 branch update를 하지 않습니다. 품질 gate가 clear이면 MERGE_CANDIDATE로 보고하고, main Codex가 merge batch 순서에서 admin merge 또는 gh pr update-branch $number 실행을 결정합니다. 단, main Codex가 명시적으로 최신화를 요청했거나 merge conflict/main drift 근거가 있으면 gh pr update-branch $number 를 수행한 뒤 새 Head SHA 기준으로 처음부터 다시 확인합니다.
- full-ci PR에서는 CodeRabbit 정리 후 반드시 scripts/pr-ready-for-ci-guard.sh --apply $number 로 ready-for-ci 라벨을 붙입니다.
- code-rabbit-only exception PR에서는 ready-for-ci 라벨과 workflow_dispatch를 실행하지 않습니다.
- watcher는 CI steward 전용입니다. 메인 Codex thread에서 직접 실행하지 않습니다.
- full-ci PR에서 MMP_CI_STEWARD=1 scripts/mmp-pr-watch.sh $number --code-rabbit-only 는 CodeRabbit 정리 확인용 중간 대기입니다. 성공해도 완료 보고하지 말고 즉시 ready-for-ci guard를 적용하세요.
- full-ci PR에서 ready-for-ci 라벨은 full CI 실행 허가일 뿐이며, 라벨만으로 모든 workflow가 생성됐다고 가정하지 않습니다.
- full-ci PR에서 ready-for-ci 라벨 적용 후에는 MMP_CI_STEWARD=1 scripts/mmp-pr-watch.sh $number --trigger-missing-workflows 로 현재 head SHA의 required workflow를 확인하고, 누락된 workflow를 workflow_dispatch로 생성합니다. branch update는 main Codex가 명시한 경우에만 추가합니다.
- Required workflow set: CI, E2E — Stubbed Backend, Security — Fast Feedback.
- gitleaks, File Size Guard, ci-hooks, module-isolation, build-runner-image 등은 이 steward의 full-CI 완료 판정용 required set이 아닙니다. PR checks에 보이면 참고하되, 위 required set 누락 여부를 기준으로 행동하세요.
- 이전 보고 이후 메인 Codex가 추가 커밋을 push했다면 최신 Head SHA 기준으로 CodeRabbit/check 상태를 다시 확인합니다.
- local rebase, local merge commit, force-push는 금지입니다. main Codex가 branch update를 지시한 경우 strict up-to-date gate 해소에는 gh pr update-branch $number 만 사용합니다.
- pending 상태는 완료가 아닙니다. CodeRabbit/CI/Codecov가 아직 도는 중이고 watcher가 계속 가능하면 최종 보고하지 말고 계속 진행하세요.
- 메인 Codex가 상태를 물으면 최신 Head SHA, 현재 phase(CODE_RABBIT/READY_FOR_CI/FULL_CI/FIXING/BRANCH_UPDATE/BLOCKED), 실행 중이거나 방금 끝난 명령, pending check/thread, 다음 자율 행동을 짧게 보고하세요.
- watcher timeout 또는 한 timeout window 동안 상태 변화가 없으면 BLOCKED로 보고하고, 마지막 Head SHA, elapsed time, pending 항목, main Codex가 재실행할 명령을 포함하세요.

## Steward 금지 범위
- PR merge, PR 생성, Issue 생성, force-push, destructive git, secret 조회, unrelated branch/worktree 수정, 임의 branch 최신화는 금지입니다. 단, main Codex가 명시했거나 merge conflict/main drift 근거가 있는 대상 PR의 gh pr update-branch 실행은 허용합니다.
- 테스트 스킵, coverage 약화, 유효한 리뷰 무시도 금지입니다.

## 메인 Codex 복귀 조건
- $merge_ready_rule
- NEEDS_FIX: steward가 수정 commit을 push했고 재검토/CI 재대기 필요.
- BLOCKED: 권한, 외부 장애, 설계 판단, merge conflict 등 main/user 결정이 필요.

## Copy-ready prompt
아래 작업을 mmp-ci-steward 역할로 진행하세요.

대상 PR: #$number $url
대상 branch: $head
목표: CodeRabbit 리뷰, Codecov, CI 상태를 확인하고 타당한 문제를 수정해 PR을 MERGE_READY 상태까지 끌고 가세요.
제약:
- 이 PR branch/worktree만 수정하세요.
- PR 생성/Issue 생성/merge/force-push/destructive git/secret 조회는 하지 마세요.
- CI scope: $steward_mode
- $copy_ready_rule
- $full_ci_wait_rule
- 변경했다면 focused validation을 실행하고 push하세요.
- 최종 보고 직전 scripts/mmp-pr-status.sh $number --fail-on-blocker --allow-behind 를 실행하고 통과하지 못하면 MERGE_READY/MERGE_CANDIDATE라고 말하지 마세요.
- Codecov gate state가 blocker이면 테스트를 추가해 같은 PR branch에서 해결하세요. 별도 PR로 쪼개지 마세요.
- pending은 최종 상태가 아닙니다. 계속 watch할 수 있으면 계속 진행하고, timeout/no-progress일 때만 BLOCKED로 보고하세요.
- 최종 보고는 한국어로 발견 / 수행 / 판단 / 미해결 4섹션으로 작성하고, 확인한 Head SHA와 판단의 MERGE_READY, MERGE_CANDIDATE, NEEDS_FIX, BLOCKED 중 하나를 명시하세요.
MSG
