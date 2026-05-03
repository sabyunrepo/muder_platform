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
graphql_query='query($owner:String!, $repo:String!, $number:Int!) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:100) { nodes { isResolved } } } } }'
threads_json="$(gh api graphql \
  -F owner="$owner" \
  -F repo="$repo" \
  -F number="$pr_number" \
  -f query="$graphql_query")"
unresolved_threads="$(printf '%s' "$threads_json" | jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length')"
total_threads="$(printf '%s' "$threads_json" | jq '[.data.repository.pullRequest.reviewThreads.nodes[]] | length')"

latest_coderabbit="$(gh pr view "$pr_number" --json reviews --jq '[.reviews[] | select(.author.login == "coderabbitai[bot]")] | last | if . then (.state + " @ " + .submittedAt) else "없음" end')"
codecov_summary="$(gh pr view "$pr_number" --json comments --jq '[.comments[] | select((.author.login == "codecov-commenter") or (.body | contains("Codecov Report")))] | last | if . then (.body | split("\n") | .[0:6] | join("\n")) else "없음" end')"

cat <<MSG
# PR 상태 요약

- PR: #$number $title
- URL: $url
- Branch: $head -> $base
- Labels: $labels
- Merge state: $merge_state
- Review decision: $review_decision
- CodeRabbit latest review: $latest_coderabbit
- Review threads: unresolved $unresolved_threads / total $total_threads

# Codecov 최신 코멘트 요약
$codecov_summary

# Checks
MSG

gh pr checks "$pr_number" || true
