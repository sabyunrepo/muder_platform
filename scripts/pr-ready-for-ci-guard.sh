#!/usr/bin/env bash
# Guard for adding ready-for-ci only after review cleanup.

set -euo pipefail

usage() {
  cat <<'MSG'
Usage: scripts/pr-ready-for-ci-guard.sh [--apply] [PR_NUMBER]

기본은 dry-run입니다. 조건을 통과하면 라벨 추가 명령만 출력합니다.
--apply를 주면 `ready-for-ci` 라벨을 실제로 붙입니다.

차단 조건:
- unresolved review thread가 1개 이상
- CodeRabbit 리뷰가 없거나 최신 CodeRabbit review가 CHANGES_REQUESTED

예외:
- ALLOW_NO_CODERABBIT=1 이면 CodeRabbit 리뷰 없음은 경고만 출력합니다.
MSG
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: $1" >&2
    exit 127
  fi
}

apply="0"
pr_number=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      apply="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      pr_number="$1"
      shift
      ;;
  esac
done

require_cmd gh
require_cmd jq

if [[ -z "$pr_number" ]]; then
  pr_number="$(gh pr view --json number --jq '.number')"
fi

owner="$(gh repo view --json owner --jq '.owner.login')"
repo="$(gh repo view --json name --jq '.name')"

threads_json="$(gh api graphql \
  -F owner="$owner" \
  -F repo="$repo" \
  -F number="$pr_number" \
  -f query='query($owner:String!, $repo:String!, $number:Int!) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:100) { nodes { isResolved } } } } }')"
unresolved_threads="$(printf '%s' "$threads_json" | jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length')"

if [[ "$unresolved_threads" != "0" ]]; then
  echo "🚫 ready-for-ci 차단: unresolved review thread가 $unresolved_threads개 남아 있습니다." >&2
  exit 2
fi

latest_state="$(gh pr view "$pr_number" --json reviews --jq '[.reviews[] | select(.author.login == "coderabbitai[bot]")] | last | if . then .state else "NONE" end')"
if [[ "$latest_state" == "NONE" && "${ALLOW_NO_CODERABBIT:-}" != "1" ]]; then
  echo "🚫 ready-for-ci 차단: CodeRabbit 리뷰가 아직 없습니다." >&2
  echo "   필요 시 ALLOW_NO_CODERABBIT=1 로 예외 처리할 수 있지만, 기본 정책은 리뷰 후 CI입니다." >&2
  exit 3
fi

if [[ "$latest_state" == "CHANGES_REQUESTED" ]]; then
  echo "🚫 ready-for-ci 차단: 최신 CodeRabbit review가 CHANGES_REQUESTED 입니다." >&2
  exit 4
fi

if [[ "$apply" == "1" ]]; then
  gh pr edit "$pr_number" --add-label ready-for-ci
  echo "✅ ready-for-ci 라벨을 추가했습니다: PR #$pr_number"
else
  echo "✅ ready-for-ci 가드 통과: PR #$pr_number"
  echo "   실제 라벨 추가: scripts/pr-ready-for-ci-guard.sh --apply $pr_number"
fi
