#!/usr/bin/env bash
# MMP workflow 상태 요약 뷰.

set -euo pipefail

usage() {
  cat <<'MSG'
Usage:
  scripts/mmp-workflow-status.sh issue <번호>
  scripts/mmp-workflow-status.sh branch [브랜치명]

Examples:
  scripts/mmp-workflow-status.sh issue 248
  scripts/mmp-workflow-status.sh branch feat/issue-248-foo
  scripts/mmp-workflow-status.sh  # 기본: 현재 브랜치 기반 branch 모드
MSG
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: $1" >&2
    exit 127
  fi
}

require_cmd git
require_cmd jq

workflow_root() {
  local common_dir
  common_dir="$(git rev-parse --git-common-dir 2>/dev/null || true)"
  [ -n "$common_dir" ] || {
    echo "🚫 git 공용 디렉터리를 찾지 못했습니다. Git 저장소 루트에서 실행하세요." >&2
    exit 1
  }
  printf '%s/mmp-workflow' "$common_dir"
}

seed_file() {
  local issue="$1"
  echo "$(workflow_root)/seeds/issue-${issue}.json"
}

issue_from_branch() {
  local branch="$1"
  if [[ "$branch" =~ (^|/)issue-([0-9]+)($|[^0-9]) ]]; then
    echo "${BASH_REMATCH[2]}"
    return 0
  fi
  return 1
}

show_issue() {
  local issue="$1"
  local file
  file="$(seed_file "$issue")"
  if [[ ! -f "$file" ]]; then
    echo "⚠️ Seed 없음: issue-$issue"
    return 1
  fi

  jq -r '
    {
      issue:.issue,
      title:.title,
      status:.status,
      source:.source,
      objective:.objective,
      scope_in:.scope_in,
      scope_out:.scope_out,
      constraints:.constraints,
      acceptance_criteria:.acceptance_criteria,
      done_criteria:.done_criteria,
      risks:.risks,
      branch_hint:.branch_hint,
      block_reason:.block_reason,
      updated_at:.updated_at,
      completed_at:.completed_at
    }' "$file"
}

show_events() {
  local issue="$1"
  local event_file
  event_file="$(workflow_root)/events.jsonl"
  [[ -f "$event_file" ]] || return 0
  jq -c --argjson issue "$issue" 'select(.issue == $issue)' "$event_file" 2>/dev/null | tail -n 8 || true
}

mode="${1:-branch}"
if [[ "${1:-}" == "issue" ]]; then
  mode="issue"
  shift
elif [[ "${1:-}" == "branch" ]]; then
  mode="branch"
  shift
elif [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "$mode" == "issue" ]]; then
  if [[ $# -lt 1 ]]; then
    usage
    exit 2
  fi
  if ! [[ "$1" =~ ^[0-9]+$ ]]; then
    echo "🚫 issue 번호는 숫자여야 합니다: $1" >&2
    exit 2
  fi
  issue="$1"
  if show_issue "$issue"; then
    echo "---"
    show_events "$issue"
  fi
  exit 0
fi

branch="${1:-$(git rev-parse --abbrev-ref HEAD)}"
if ! issue="$(issue_from_branch "$branch")"; then
  if [[ -n "${MMP_ISSUE_NUMBER:-}" ]]; then
    issue="${MMP_ISSUE_NUMBER}"
  else
    echo "⚠️ 현재 브랜치에서 issue 번호를 추출할 수 없습니다: $branch" >&2
    echo "   예: issue/issue-248-<slug> 또는 MMP_ISSUE_NUMBER 지정" >&2
    exit 2
  fi
fi
echo "Branch issue: $issue"
if show_issue "$issue"; then
  echo "---"
  show_events "$issue"
fi
