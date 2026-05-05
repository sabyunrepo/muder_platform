#!/usr/bin/env bash
# Summarize MMP PR review, label, CI, CodeRabbit, and Codecov state.

set -euo pipefail

usage() {
  cat <<'MSG'
Usage: scripts/mmp-pr-status.sh [options] [PR_NUMBER]

현재 브랜치의 PR 또는 지정한 PR 번호에 대해 다음을 요약합니다.
- labels / merge state / review decision
- CodeRabbit 최신 리뷰와 unresolved review thread 수
- Codecov Report 최신 코멘트 요약
- GitHub checks 상태

반복 조회가 필요하면 30초 이상 간격으로 실행하세요.

Options:
  --fail-on-blocker  CodeRabbit/review blocker가 있으면 non-zero로 종료합니다.
  -h, --help         Show help
MSG
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: $1" >&2
    exit 127
  fi
}

require_cmd gh
require_cmd jq

fail_on_blocker=0
pr_number=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fail-on-blocker)
      fail_on_blocker=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -* )
      echo "알 수 없는 옵션: $1" >&2
      usage >&2
      exit 64
      ;;
    *)
      if [[ -n "$pr_number" ]]; then
        echo "PR_NUMBER는 하나만 지정할 수 있습니다." >&2
        exit 64
      fi
      pr_number="$1"
      shift
      ;;
  esac
done

if [[ -z "$pr_number" ]]; then
  pr_number="$(gh pr view --json number --jq '.number')"
fi

owner="$(gh repo view --json owner --jq '.owner.login')"
repo="$(gh repo view --json name --jq '.name')"

pr_json="$(gh pr view "$pr_number" --json number,title,url,headRefName,baseRefName,mergeStateStatus,reviewDecision,labels)"
pull_json="$(gh api "repos/$owner/$repo/pulls/$pr_number")"

number="$(printf '%s' "$pr_json" | jq -r '.number')"
title="$(printf '%s' "$pr_json" | jq -r '.title')"
url="$(printf '%s' "$pr_json" | jq -r '.url')"
head="$(printf '%s' "$pr_json" | jq -r '.headRefName')"
base="$(printf '%s' "$pr_json" | jq -r '.baseRefName')"
merge_state="$(printf '%s' "$pr_json" | jq -r '.mergeStateStatus // "UNKNOWN"')"
mergeable_state="$(printf '%s' "$pull_json" | jq -r '.mergeable_state // "unknown"')"
protection_json="$(gh api "repos/$owner/$repo/branches/$base/protection" 2>/dev/null || printf '{}')"
strict_status_checks="$(printf '%s' "$protection_json" | jq -r '.required_status_checks.strict // false')"
review_decision="$(printf '%s' "$pr_json" | jq -r '.reviewDecision // "UNKNOWN"')"
labels="$(printf '%s' "$pr_json" | jq -r '[.labels[].name] | if length == 0 then "없음" else join(", ") end')"

# shellcheck disable=SC2016
graphql_query='query($owner:String!, $repo:String!, $number:Int!, $after:String) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:100, after:$after) { nodes { id isResolved isOutdated path line comments(first:1) { nodes { author { login } body url } } } pageInfo { hasNextPage endCursor } } } } }'
unresolved_threads=0
total_threads=0
unresolved_details=""
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
  page_details="$(printf '%s' "$threads_json" | jq -r '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | "- " + .id + " " + (.path // "unknown") + ":" + ((.line // 0)|tostring) + " outdated=" + ((.isOutdated // false)|tostring) + " " + ((.comments.nodes[0].url // "")) + "\n  author=" + ((.comments.nodes[0].author.login // "unknown")) + " body=" + (((.comments.nodes[0].body // "") | split("\n")[0])[:180])')"
  unresolved_threads=$((unresolved_threads + page_unresolved))
  total_threads=$((total_threads + page_total))
  if [[ -n "$page_details" ]]; then
    if [[ -n "$unresolved_details" ]]; then
      unresolved_details="${unresolved_details}"$'\n'"${page_details}"
    else
      unresolved_details="$page_details"
    fi
  fi

  has_next="$(printf '%s' "$threads_json" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')"
  [[ "$has_next" == "true" ]] || break
  after_cursor="$(printf '%s' "$threads_json" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')"
done

# shellcheck disable=SC2016
latest_coderabbit="$(gh pr view "$pr_number" --json reviews,comments --jq '([.reviews[] | select((.author.login == "coderabbitai[bot]") or (.author.login == "coderabbitai"))] | last) as $review | if $review then ($review.state + " @ " + $review.submittedAt) else (([.comments[] | select((.author.login == "coderabbitai") or (.author.login == "coderabbitai[bot]") or (.body | contains("coderabbit.ai")))] | last) as $comment | if $comment then ("comment @ " + $comment.createdAt) else "없음" end) end')"
codecov_summary="$(gh pr view "$pr_number" --json comments --jq '[.comments[] | select((.author.login == "codecov-commenter") or (.body | contains("Codecov Report")))] | last | if . then (.body | split("\n") | .[0:6] | join("\n")) else "없음" end')"
checks_json="$(gh pr checks "$pr_number" --json name,bucket,state 2>/dev/null || printf '[]')"
coderabbit_check_bucket="$(printf '%s' "$checks_json" | jq -r '[.[] | select(.name == "CodeRabbit")] | last | .bucket // "unknown"')"
ci_scope_env="$(scripts/mmp-pr-ci-scope.sh "$pr_number" --format env)"
eval "$ci_scope_env"

if [[ "$unresolved_threads" -gt 0 ]]; then
  coderabbit_action_state="blocker: unresolved review thread가 남아 있습니다"
elif [[ "$review_decision" == "CHANGES_REQUESTED" ]]; then
  coderabbit_action_state="blocker: GitHub review decision이 CHANGES_REQUESTED입니다"
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
- REST mergeable_state: $mergeable_state
- Base requires up-to-date checks: $strict_status_checks
- Review decision: $review_decision
- CI scope: $CI_SCOPE
- Heavy CI trigger files: ${CI_HEAVY_FILES:-없음}
- CodeRabbit latest review: $latest_coderabbit
- CodeRabbit actionable state: $coderabbit_action_state
- Review threads: unresolved $unresolved_threads / total $total_threads

# Unresolved review thread details
${unresolved_details:-없음}

# Codecov 최신 코멘트 요약
$codecov_summary

# Checks
MSG

gh pr checks "$pr_number" || true

if [[ "$fail_on_blocker" == "1" ]]; then
  if [[ "$coderabbit_action_state" == blocker:* ]]; then
    exit 3
  fi
fi
