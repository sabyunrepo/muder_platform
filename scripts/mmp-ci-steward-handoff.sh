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
number="$(printf '%s' "$pr_json" | jq -r '.number')"
title="$(printf '%s' "$pr_json" | jq -r '.title')"
url="$(printf '%s' "$pr_json" | jq -r '.url')"
state="$(printf '%s' "$pr_json" | jq -r '.state')"
head="$(printf '%s' "$pr_json" | jq -r '.headRefName')"
head_sha="$(printf '%s' "$pr_json" | jq -r '.headRefOid')"
base="$(printf '%s' "$pr_json" | jq -r '.baseRefName')"
merge_state="$(printf '%s' "$pr_json" | jq -r '.mergeStateStatus // "UNKNOWN"')"
review_decision="$(printf '%s' "$pr_json" | jq -r '.reviewDecision // "UNKNOWN"')"
labels="$(printf '%s' "$pr_json" | jq -r '[.labels[].name] | if length == 0 then "없음" else join(", ") end')"

read -r unresolved_threads total_threads < <(review_thread_counts "$owner" "$repo" "$number")

# shellcheck disable=SC2016
latest_coderabbit="$(gh pr view "$number" --json reviews,comments --jq '([.reviews[] | select((.author.login == "coderabbitai[bot]") or (.author.login == "coderabbitai"))] | last) as $review | if $review then ($review.state + " @ " + $review.submittedAt) else (([.comments[] | select((.author.login == "coderabbitai") or (.author.login == "coderabbitai[bot]") or (.body | contains("coderabbit.ai")))] | last) as $comment | if $comment then ("comment @ " + $comment.createdAt) else "없음" end) end')"
checks_summary="$(gh pr checks "$number" --json name,bucket,state,link 2>/dev/null | jq -r 'if length == 0 then "checks 없음" else .[] | "- " + .name + ": " + (.bucket // "unknown") + "/" + (.state // "unknown") + " " + (.link // "") end' || printf 'checks 조회 실패')"
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
- Review decision: $review_decision
- Labels: $labels
- CodeRabbit latest: $latest_coderabbit
- Review threads: unresolved $unresolved_threads / total $total_threads
- Repo root: $repo_root
- Current local branch: $current_branch

## Checks
$checks_summary

## Steward 허용 범위
- 이 PR branch/worktree에서만 CodeRabbit, CI, Codecov 원인을 확인하고 수정합니다.
- 타당한 리뷰/실패만 고치고 focused validation을 실행한 뒤 fix commit을 push할 수 있습니다.
- CodeRabbit 정리 후 full CI가 필요하면 반드시 scripts/pr-ready-for-ci-guard.sh --apply $number 로 ready-for-ci 라벨을 붙입니다.
- scripts/mmp-pr-watch.sh $number --code-rabbit-only 는 CodeRabbit 정리 확인용 중간 대기입니다. 성공해도 완료 보고하지 말고 즉시 ready-for-ci guard를 적용하세요.
- ready-for-ci 라벨은 full CI 실행 허가일 뿐이며, 라벨만으로 모든 workflow가 생성됐다고 가정하지 않습니다.
- ready-for-ci 라벨 적용 후에는 scripts/mmp-pr-watch.sh $number --trigger-missing-workflows 로 현재 head SHA의 required workflow를 확인하고, 누락된 workflow를 workflow_dispatch로 생성합니다.
- Required workflow set: CI, E2E — Stubbed Backend, Security — Fast Feedback.
- gitleaks, File Size Guard, ci-hooks, module-isolation, build-runner-image 등은 이 steward의 full-CI 완료 판정용 required set이 아닙니다. PR checks에 보이면 참고하되, 위 required set 누락 여부를 기준으로 행동하세요.
- 이전 보고 이후 메인 Codex가 추가 커밋을 push했다면 최신 Head SHA 기준으로 CodeRabbit/check 상태를 다시 확인합니다.

## Steward 금지 범위
- PR merge, PR 생성, Issue 생성, force-push, destructive git, secret 조회, unrelated branch/worktree 수정은 금지입니다.
- 테스트 스킵, coverage 약화, 유효한 리뷰 무시도 금지입니다.

## 메인 Codex 복귀 조건
- MERGE_READY: unresolved thread 0, CodeRabbit clear, ready-for-ci label present, required checks green, Codecov 기준 충족 또는 비대상 근거 확인.
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
- ready-for-ci 라벨은 scripts/pr-ready-for-ci-guard.sh --apply $number 를 통과할 때만 붙이세요.
- CodeRabbit 통과만으로 완료 보고하지 마세요. CodeRabbit 통과 후 ready-for-ci 라벨을 붙이고 required workflow와 Codecov까지 확인해야 합니다.
- scripts/mmp-pr-watch.sh $number --code-rabbit-only 성공은 중간 단계입니다. 그 다음 scripts/pr-ready-for-ci-guard.sh --apply $number 와 scripts/mmp-pr-watch.sh $number --trigger-missing-workflows 를 이어서 실행하세요.
- 라벨 이벤트만 기다리지 마세요. required workflow(CI, E2E — Stubbed Backend, Security — Fast Feedback)가 현재 head SHA에 없으면 watcher가 workflow_dispatch로 생성해야 합니다.
- 변경했다면 focused validation을 실행하고 push하세요.
- 최종 보고는 한국어로 발견 / 수행 / 판단 / 미해결 4섹션으로 작성하고, 확인한 Head SHA와 판단의 MERGE_READY, NEEDS_FIX, BLOCKED 중 하나를 명시하세요.
MSG
