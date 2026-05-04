#!/usr/bin/env bash
# Summarize MMP PR review, label, CI, CodeRabbit, and Codecov state.

set -euo pipefail

usage() {
  cat <<'MSG'
Usage: scripts/mmp-pr-status.sh [PR_NUMBER]

현재 브랜치의 PR 또는 지정한 PR 번호에 대해 다음을 요약합니다.
- labels / merge state / review decision
- CodeRabbit 최신 리뷰와 unresolved review thread 수
- Codecov Report 최신 코멘트 요약
- GitHub checks 상태

반복 조회가 필요하면 30초 이상 간격으로 실행하세요.
MSG
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: $1" >&2
    exit 127
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

require_cmd gh
require_cmd jq

pr_number="${1:-}"
if [[ -z "$pr_number" ]]; then
  pr_number="$(gh pr view --json number --jq '.number')"
fi

owner="$(gh repo view --json owner --jq '.owner.login')"
repo="$(gh repo view --json name --jq '.name')"

pr_json="$(gh pr view "$pr_number" --json number,title,url,headRefName,baseRefName,mergeStateStatus,reviewDecision,labels)"

number="$(printf '%s' "$pr_json" | jq -r '.number')"
title="$(printf '%s' "$pr_json" | jq -r '.title')"
url="$(printf '%s' "$pr_json" | jq -r '.url')"
head="$(printf '%s' "$pr_json" | jq -r '.headRefName')"
base="$(printf '%s' "$pr_json" | jq -r '.baseRefName')"
merge_state="$(printf '%s' "$pr_json" | jq -r '.mergeStateStatus // "UNKNOWN"')"
review_decision="$(printf '%s' "$pr_json" | jq -r '.reviewDecision // "UNKNOWN"')"
labels="$(printf '%s' "$pr_json" | jq -r '[.labels[].name] | if length == 0 then "없음" else join(", ") end')"

# shellcheck disable=SC2016
graphql_query='query($owner:String!, $repo:String!, $number:Int!, $after:String) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:100, after:$after) { nodes { isResolved } pageInfo { hasNextPage endCursor } } } } }'
unresolved_threads=0
total_threads=0
after_cursor=""
while :; do
  if [[ -z "$after_cursor" ]]; then
    threads_json="$(gh api graphql \
      -F owner="$owner" \
      -F repo="$repo" \
      -F number="$pr_number" \
      -f query="$graphql_query")"
  else
    threads_json="$(gh api graphql \
      -F owner="$owner" \
      -F repo="$repo" \
      -F number="$pr_number" \
      -F after="$after_cursor" \
      -f query="$graphql_query")"
  fi

  page_unresolved="$(printf '%s' "$threads_json" | jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length')"
  page_total="$(printf '%s' "$threads_json" | jq '[.data.repository.pullRequest.reviewThreads.nodes[]] | length')"
  unresolved_threads=$((unresolved_threads + page_unresolved))
  total_threads=$((total_threads + page_total))

  has_next="$(printf '%s' "$threads_json" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')"
  [[ "$has_next" == "true" ]] || break
  after_cursor="$(printf '%s' "$threads_json" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')"
done

# shellcheck disable=SC2016
latest_coderabbit="$(gh pr view "$pr_number" --json reviews,comments --jq '([.reviews[] | select((.author.login == "coderabbitai[bot]") or (.author.login == "coderabbitai"))] | last) as $review | if $review then ($review.state + " @ " + $review.submittedAt) else (([.comments[] | select((.author.login == "coderabbitai") or (.author.login == "coderabbitai[bot]") or (.body | contains("coderabbit.ai")))] | last) as $comment | if $comment then ("comment @ " + $comment.createdAt) else "없음" end) end')"
codecov_summary="$(gh pr view "$pr_number" --json comments --jq '[.comments[] | select((.author.login == "codecov-commenter") or (.body | contains("Codecov Report")))] | last | if . then (.body | split("\n") | .[0:6] | join("\n")) else "없음" end')"
checks_json="$(gh pr checks "$pr_number" --json name,bucket,state 2>/dev/null || printf '[]')"
coderabbit_check_bucket="$(printf '%s' "$checks_json" | jq -r '[.[] | select(.name == "CodeRabbit")] | last | .bucket // "unknown"')"

if [[ "$unresolved_threads" -gt 0 ]]; then
  coderabbit_action_state="blocker: unresolved review thread가 남아 있습니다"
elif [[ "$latest_coderabbit" == CHANGES_REQUESTED* ]]; then
  coderabbit_action_state="blocker: latest review가 CHANGES_REQUESTED입니다"
elif [[ "$coderabbit_check_bucket" == "pending" ]]; then
  coderabbit_action_state="waiting: CodeRabbit check가 아직 진행 중입니다"
elif [[ "$coderabbit_check_bucket" == "fail" ]]; then
  coderabbit_action_state="blocker: CodeRabbit check가 실패했습니다"
elif [[ "$coderabbit_check_bucket" == "pass" && "$unresolved_threads" -eq 0 ]]; then
  coderabbit_action_state="clear: CodeRabbit check pass + unresolved 0"
else
  coderabbit_action_state="unknown: CodeRabbit 상태를 수동 확인하세요"
fi

cat <<MSG
# PR 상태 요약

- PR: #$number $title
- URL: $url
- Branch: $head -> $base
- Labels: $labels
- Merge state: $merge_state
- Review decision: $review_decision
- CodeRabbit latest review: $latest_coderabbit
- CodeRabbit actionable state: $coderabbit_action_state
- Review threads: unresolved $unresolved_threads / total $total_threads

# Codecov 최신 코멘트 요약
$codecov_summary

# Checks
MSG

gh pr checks "$pr_number" || true
