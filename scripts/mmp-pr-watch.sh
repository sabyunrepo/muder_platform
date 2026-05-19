#!/usr/bin/env bash
# Watch MMP PR Codex review state until it needs attention or is complete.
# Intended for CI steward agents, not the main Codex thread.

set -euo pipefail

usage() {
  cat <<'MSG'
Usage: scripts/mmp-pr-watch.sh [options] [PR_NUMBER]

This is a CI steward tool. Main Codex should use one-shot status commands
(`scripts/mmp-pr-status.sh`, `gh pr view`) and delegate waiting to
`mmp-ci-steward`.

Options:
  --interval SECONDS       Poll interval. Default: 60
  --timeout SECONDS        Stop after timeout. Default: 3600
  --workflows LIST         Deprecated; ignored in development-minimum mode.
  --trigger-missing-workflows
                           Deprecated; never dispatches workflows in development-minimum mode.
  --update-branch-if-needed
                           If base branch requires strict up-to-date checks and PR is behind,
                           update the PR branch through GitHub and restart latest-head waiting
  --codex-review-only      Stop once Codex review is clear and review threads are resolved
  --no-notify              Do not send macOS notification / terminal bell
  -h, --help               Show help

Stops with:
  0 when Codex review is clear
  2 reserved for legacy workflow failures
  3 when Codex review has unresolved threads or latest review requests changes
  4 on timeout
MSG
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: $1" >&2
    exit 127
  fi
}

notify() {
  local title="$1"
  local message="$2"
  if [[ "$notify_enabled" == "1" ]]; then
    printf '\a' >&2 || true
    if command -v osascript >/dev/null 2>&1; then
      osascript -e "display notification \"${message//\"/\\\"}\" with title \"${title//\"/\\\"}\"" >/dev/null 2>&1 || true
    fi
  fi
}


gh_retry() {
  local attempt=1
  local max_attempts=3
  local delay=2
  local output status
  while (( attempt <= max_attempts )); do
    if output="$(gh "$@" 2>&1)"; then
      printf '%s' "$output"
      return 0
    fi
    status=$?
    echo "⚠️ gh $* failed (attempt ${attempt}/${max_attempts}, status ${status})" >&2
    echo "$output" >&2
    if (( attempt < max_attempts )); then
      sleep "$delay"
      delay=$((delay * 2))
    fi
    attempt=$((attempt + 1))
  done
  return 1
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
      if ! threads_json="$(gh_retry api graphql -F owner="$owner" -F repo="$repo" -F number="$pr_number" -f query="$graphql_query")"; then
        return 1
      fi
    else
      if ! threads_json="$(gh_retry api graphql -F owner="$owner" -F repo="$repo" -F number="$pr_number" -F after="$after_cursor" -f query="$graphql_query")"; then
        return 1
      fi
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

latest_workflow_rows() {
  local branch="$1"
  local head_sha="$2"
  gh_retry run list --branch "$branch" --limit 80 --json databaseId,workflowName,status,conclusion,createdAt,url,headSha \
    | jq -r --arg head_sha "$head_sha" '.[] | select(.headSha == $head_sha) | [.workflowName, .status, (if (.conclusion == null or .conclusion == "") then "none" else .conclusion end), (.databaseId|tostring), .url, .createdAt, .headSha] | @tsv'
}

base_requires_up_to_date_checks() {
  local owner="$1"
  local repo="$2"
  local base="$3"
  local protection_json
  if ! protection_json="$(gh_retry api "repos/$owner/$repo/branches/$base/protection" 2>/dev/null)"; then
    printf 'false'
    return 0
  fi
  printf '%s' "$protection_json" | jq -r '.required_status_checks.strict // false'
}

interval=60
timeout=3600
workflow_csv="CI,E2E — Stubbed Backend,Security — Fast Feedback"
notify_enabled=1
trigger_missing_workflows=0
update_branch_if_needed=0
review_only=0
pr_number=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval)
      interval="$2"
      shift 2
      ;;
    --timeout)
      timeout="$2"
      shift 2
      ;;
    --workflows)
      workflow_csv="$2"
      shift 2
      ;;
    --trigger-missing-workflows)
      echo "⚠️ --trigger-missing-workflows is ignored in development-minimum mode." >&2
      trigger_missing_workflows=0
      shift
      ;;
    --update-branch-if-needed)
      update_branch_if_needed=1
      shift
      ;;
    --codex-review-only)
      review_only=1
      workflow_csv=""
      shift
      ;;
    --no-notify)
      notify_enabled=0
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

require_cmd gh
require_cmd jq

if [[ "${MMP_CI_STEWARD:-}" != "1" && "${MMP_ALLOW_MAIN_PR_WATCH:-}" != "1" ]]; then
  cat >&2 <<'MSG'
🚫 mmp-pr-watch는 CI steward 전용 장시간 대기 도구입니다.
   메인 Codex thread에서 직접 watcher를 돌리지 마세요.
   대신 scripts/mmp-ci-steward-handoff.sh <PR> 로 steward에 위임하세요.
   수동 디버깅 예외가 꼭 필요하면 MMP_ALLOW_MAIN_PR_WATCH=1 을 명시하세요.
MSG
  exit 65
fi

if [[ -z "$pr_number" ]]; then
  pr_number="$(gh_retry pr view --json number --jq '.number')"
fi

owner="$(gh_retry repo view --json owner --jq '.owner.login')"
repo="$(gh_retry repo view --json name --jq '.name')"
review_check_name="${MMP_PR_REVIEW_CHECK_NAME:-Codex}"
review_author_regex="${MMP_PR_REVIEW_AUTHOR_REGEX:-codex|openai}"
ci_scope_env="$(scripts/mmp-pr-ci-scope.sh "$pr_number" --format env)"
eval "$ci_scope_env"
if [[ "$CI_SCOPE" == "codex-review-only" && "$review_only" != "1" ]]; then
  echo "🚫 PR #$pr_number 은 codex-review-only scope입니다." >&2
  echo "   개발 최소 워커 모드에서는 heavy CI workflow를 PR gate로 실행하지 않습니다." >&2
  echo "   scripts/mmp-pr-watch.sh $pr_number --codex-review-only 로 확인하세요." >&2
  echo "   ready-for-ci 라벨이나 --trigger-missing-workflows 를 사용하지 마세요." >&2
  exit 64
fi
triggered_workflows="|"

start_epoch="$(date +%s)"

while :; do
  now_epoch="$(date +%s)"
  elapsed=$((now_epoch - start_epoch))
  if (( elapsed > timeout )); then
    notify "MMP PR watch timeout" "PR #$pr_number timed out after ${timeout}s"
    echo "🚫 timeout: PR #$pr_number 상태 확인이 ${timeout}s를 초과했습니다." >&2
    exit 4
  fi

  if ! pr_view_json="$(gh_retry pr view "$pr_number" --json headRefName,headRefOid,labels,reviews)"; then
    echo "⚠️ PR 상태 조회 실패; 다음 주기에 재시도합니다." >&2
    sleep "$interval"
    continue
  fi
  pr_json="$(printf '%s' "$pr_view_json" | jq --arg regex "$review_author_regex" '{headRefName, headRefOid, labels:[.labels[].name], latestReview:([.reviews[] | select((.author.login | test($regex; "i")) or ((.body // "") | test("Codex"; "i")))] | last | if . then .state else "NONE" end)}')"
  if ! pull_json="$(gh_retry api "repos/$owner/$repo/pulls/$pr_number")"; then
    echo "⚠️ PR REST 상태 조회 실패; 다음 주기에 재시도합니다." >&2
    sleep "$interval"
    continue
  fi
  branch="$(printf '%s' "$pr_json" | jq -r '.headRefName')"
  head_sha="$(printf '%s' "$pr_json" | jq -r '.headRefOid')"
  base_branch="$(printf '%s' "$pull_json" | jq -r '.base.ref')"
  mergeable_state="$(printf '%s' "$pull_json" | jq -r '.mergeable_state // "unknown"')"
  strict_status_checks="$(base_requires_up_to_date_checks "$owner" "$repo" "$base_branch")"
  if [[ "$update_branch_if_needed" == "1" && "$strict_status_checks" == "true" && "$mergeable_state" == "behind" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] PR #$pr_number sha=${head_sha:0:7} is behind $base_branch and strict status checks are enabled. Updating branch through GitHub..."
    if gh_retry pr update-branch "$pr_number" >/dev/null; then
      triggered_workflows="|"
      sleep "$interval"
      continue
    fi
    notify "MMP PR branch update failed" "PR #$pr_number could not be updated"
    scripts/mmp-pr-status.sh "$pr_number" || true
    exit 2
  fi
  labels_csv="$(printf '%s' "$pr_json" | jq -r '.labels | join(",")')"
  latest_review="$(printf '%s' "$pr_json" | jq -r '.latestReview')"
  checks_json="$(gh_retry pr checks "$pr_number" --json name,bucket || true)"
  if [[ -z "$checks_json" ]]; then
    echo "⚠️ PR checks 조회 실패; 다음 주기에 재시도합니다." >&2
    sleep "$interval"
    continue
  fi
  review_bucket="$(printf '%s' "$checks_json" | jq -r --arg name "$review_check_name" '[.[] | select(.name == $name)] | last | .bucket // "unknown"')"
  if ! read -r unresolved_threads total_threads < <(review_thread_counts "$owner" "$repo" "$pr_number"); then
    echo "⚠️ review thread 조회 실패; 다음 주기에 재시도합니다." >&2
    sleep "$interval"
    continue
  fi

  if [[ "$unresolved_threads" -gt 0 ]]; then
    notify "MMP PR needs review" "PR #$pr_number has ${unresolved_threads} unresolved thread(s)"
    scripts/mmp-pr-status.sh "$pr_number" || true
    exit 3
  fi
  if [[ "$latest_review" == "CHANGES_REQUESTED" ]]; then
    notify "MMP PR Codex review blocker" "PR #$pr_number has CHANGES_REQUESTED"
    scripts/mmp-pr-status.sh "$pr_number" || true
    exit 3
  fi
  if [[ "$review_bucket" == "fail" ]]; then
    notify "MMP PR Codex review failed" "PR #$pr_number ${review_check_name} check failed"
    scripts/mmp-pr-status.sh "$pr_number" || true
    exit 3
  fi
  review_clear=0
  if [[ "$review_bucket" != "pending" && "$review_bucket" != "fail" && "$unresolved_threads" -eq 0 ]]; then
    review_clear=1
  fi

  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  if [[ "$review_only" == "1" ]]; then
    echo "[$timestamp] PR #$pr_number sha=${head_sha:0:7} mergeable_state=$mergeable_state strict=$strict_status_checks CodexReview=$latest_review/$review_bucket check=$review_check_name threads=$unresolved_threads/$total_threads labels=${labels_csv:-없음}"
    if [[ "$review_clear" == "1" ]]; then
      notify "MMP PR Codex review clear" "PR #$pr_number Codex review clear and review threads resolved"
      scripts/mmp-pr-status.sh "$pr_number" || true
      exit 0
    fi
    sleep "$interval"
    continue
  fi

  all_workflows_done=1
  workflow_failure=0
  workflow_summary=()
  if ! run_rows="$(latest_workflow_rows "$branch" "$head_sha")"; then
    echo "⚠️ workflow run 조회 실패; 다음 주기에 재시도합니다." >&2
    sleep "$interval"
    continue
  fi
  IFS=',' read -ra workflow_names <<< "$workflow_csv"
  for workflow_name in "${workflow_names[@]}"; do
    [[ -n "$workflow_name" ]] || continue
    workflow_name="${workflow_name#"${workflow_name%%[![:space:]]*}"}"
    workflow_name="${workflow_name%"${workflow_name##*[![:space:]]}"}"
    latest_row="$(printf '%s\n' "$run_rows" | awk -F '\t' -v wf="$workflow_name" '$1 == wf { print; exit }')"
    if [[ -z "$latest_row" ]]; then
      all_workflows_done=0
      workflow_summary+=("$workflow_name=missing")
      if [[ "$trigger_missing_workflows" == "1" && "$review_clear" == "1" ]]; then
        if [[ "$triggered_workflows" != *"|$workflow_name|"* ]]; then
          echo "  → trigger workflow: $workflow_name on $branch ($head_sha)"
          if gh_retry workflow run "$workflow_name" --ref "$branch" >/dev/null; then
            triggered_workflows+="$workflow_name|"
          else
            echo "⚠️ workflow dispatch 실패: $workflow_name; 다음 주기에 재시도합니다." >&2
          fi
        fi
      fi
      continue
    fi
    IFS=$'\t' read -r _wf status conclusion run_id _url _created_at <<< "$latest_row"
    workflow_summary+=("$workflow_name=$status/$conclusion#$run_id")
    case "$status/$conclusion" in
      completed/success)
        ;;
      completed/failure|completed/cancelled|completed/timed_out|completed/action_required)
        workflow_failure=1
        all_workflows_done=0
        ;;
      *)
        all_workflows_done=0
        ;;
    esac
  done

  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$timestamp] PR #$pr_number sha=${head_sha:0:7} mergeable_state=$mergeable_state strict=$strict_status_checks CodexReview=$latest_review/$review_bucket check=$review_check_name threads=$unresolved_threads/$total_threads labels=${labels_csv:-없음} workflows: ${workflow_summary[*]}"

  if [[ "$workflow_failure" == "1" ]]; then
    notify "MMP CI failed" "PR #$pr_number has failed CI"
    scripts/mmp-pr-status.sh "$pr_number" || true
    exit 2
  fi

  if [[ "$all_workflows_done" == "1" ]]; then
    notify "MMP PR ready" "PR #$pr_number Codex review clear and CI passed"
    scripts/mmp-pr-status.sh "$pr_number" || true
    exit 0
  fi

  sleep "$interval"
done
