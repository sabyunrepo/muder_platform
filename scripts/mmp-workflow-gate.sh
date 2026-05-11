#!/usr/bin/env bash
# Workflow gate utilities (issue seed + strict runbook checkpoints).

set -euo pipefail

usage() {
  cat <<'MSG'
Usage:
  scripts/mmp-workflow-gate.sh issue --issue <번호> [--min-status approved] [--require-acceptance] [--require-done]
  scripts/mmp-workflow-gate.sh branch [--branch <브랜치명>] [--min-status approved] [--require-acceptance] [--require-done]

Checks:
- issue seed 존재 여부
- seed.status >= min-status
- blocked 상태 방지
- 필요 시 acceptance/done criteria 존재성 검사

Examples:
  scripts/mmp-workflow-gate.sh issue --issue 248 --min-status approved --require-acceptance --require-done
  scripts/mmp-workflow-gate.sh branch --branch feat/issue-248-...
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

status_rank() {
  case "$1" in
    draft) echo 0 ;;
    approved) echo 1 ;;
    completed) echo 2 ;;
    blocked) echo -1 ;;
    *) echo -1 ;;
  esac
}

status_name() {
  local s="$1"
  if [[ -z "$s" ]]; then
    echo "missing"
  else
    echo "$s"
  fi
}

require_valid_issue() {
  local issue="$1"
  if ! [[ "$issue" =~ ^[0-9]+$ ]]; then
    echo "🚫 issue 번호가 유효하지 않습니다: $issue" >&2
    exit 2
  fi
}

require_seed_file() {
  local issue="$1"
  local path
  path="$(seed_file "$issue")"
  if [[ ! -f "$path" ]]; then
    echo "🚫 Seed 파일이 없습니다: $path" >&2
    return 1
  fi
}

status_value() {
  local issue="$1"
  local path
  path="$(seed_file "$issue")"
  jq -r '.status // "missing"' "$path"
}

gate_issue() {
  local issue="" min_status="approved" require_acceptance=0 require_done=0
  local min_status_rank_current

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue) issue="$2"; shift 2 ;;
      --min-status) min_status="$2"; shift 2 ;;
      --require-acceptance) require_acceptance=1; shift ;;
      --require-done) require_done=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) echo "🚫 알 수 없는 옵션: $1" >&2; usage; exit 2 ;;
    esac
  done

  if [[ -z "$issue" ]]; then
    echo "🚫 --issue is required for issue gate" >&2
    exit 2
  fi
  require_valid_issue "$issue"
  if ! require_seed_file "$issue"; then
    cat >&2 <<MSG
🚫 MMP 워크플로우 게이트 실패
   다음 명령으로 Seed를 먼저 만드세요:
   scripts/mmp-workflow-seed.sh init --issue $issue --title "..." --acceptance "..." --done-criteria "..."
MSG
    return 2
  fi

  local path status status_rank_current min_status_rank accept_len done_len block_reason
  path="$(seed_file "$issue")"
  status="$(status_value "$issue")"
  status_rank_current="$(status_rank "$status")"
  min_status_rank="$(status_rank "$min_status")"
  if (( min_status_rank < 0 )); then
    echo "🚫 지원하지 않는 --min-status 값: $min_status" >&2
    return 2
  fi
  block_reason="$(jq -r '.block_reason // empty' "$path")"

  if [[ "$status" == "blocked" ]]; then
    echo "🚫 Seed가 blocked 상태입니다. 사유: ${block_reason:-미기재}" >&2
    return 2
  fi

  if (( status_rank_current < min_status_rank )); then
    echo "🚫 Seed 상태가 낮습니다." >&2
    echo "   현재: $(status_name "$status"), 요구: $min_status" >&2
    echo "   조치: scripts/mmp-workflow-seed.sh set-status --issue $issue --status approved" >&2
    return 2
  fi

  if ((require_acceptance)); then
    accept_len="$(jq -r '.acceptance_criteria | length' "$path")"
    if ((accept_len == 0)); then
      echo "🚫 acceptance criteria가 비어 있습니다." >&2
      return 2
    fi
  fi

  if ((require_done)); then
    done_len="$(jq -r '.done_criteria | length' "$path")"
    if ((done_len == 0)); then
      echo "🚫 done criteria가 비어 있습니다." >&2
      return 2
    fi
  fi

  echo "✅ MMP workflow gate pass: issue#$issue status=$status"
  return 0
}

issue_from_branch() {
  local branch="$1"
  if [[ "$branch" =~ (^|/)issue-([0-9]+)($|[^0-9]) ]]; then
    echo "${BASH_REMATCH[2]}"
    return 0
  fi
  return 1
}

gate_branch() {
  local branch="" min_status="approved" require_acceptance=0 require_done=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --branch) branch="$2"; shift 2 ;;
      --min-status) min_status="$2"; shift 2 ;;
      --require-acceptance) require_acceptance=1; shift ;;
      --require-done) require_done=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) echo "🚫 알 수 없는 옵션: $1" >&2; usage; exit 2 ;;
    esac
  done

  if [[ -z "$branch" ]]; then
    branch="$(git rev-parse --abbrev-ref HEAD)"
  fi

  local issue
  if ! issue="$(issue_from_branch "$branch")"; then
    if [[ -n "${MMP_ISSUE_NUMBER:-}" ]]; then
      issue="${MMP_ISSUE_NUMBER}"
    else
      echo "🚫 branch에서 issue 번호를 추출할 수 없습니다: $branch" >&2
      echo "   예: feat/issue-248-<slug>" >&2
      echo "   예외: --issue 옵션 또는 MMP_ISSUE_NUMBER 지정" >&2
      return 2
    fi
  fi

  if [[ -z "$issue" ]]; then
    return 2
  fi

  local -a gate_args
  gate_args=(--issue "$issue" --min-status "$min_status")
  if ((require_acceptance)); then
    gate_args+=(--require-acceptance)
  fi
  if ((require_done)); then
    gate_args+=(--require-done)
  fi
  gate_issue "${gate_args[@]}"
}

case "${1:-}" in
  issue)
    shift
    gate_issue "$@"
    ;;
  branch)
    shift
    gate_branch "$@"
    ;;
  *)
    usage
    exit 2
    ;;
esac
