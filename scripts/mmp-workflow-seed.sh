#!/usr/bin/env bash
# Deep-interview seed/state helper for MMP workflow.
#
# - One issue = one seed record stored in git common dir (worktree 공유 상태).
# - Start/PR scripts can gate on required seed status before proceeding.

set -euo pipefail

usage() {
  cat <<'MSG'
Usage:
  scripts/mmp-workflow-seed.sh init --issue <번호> [options]
  scripts/mmp-workflow-seed.sh set-status --issue <번호> --status <draft|approved|completed|blocked>
  scripts/mmp-workflow-seed.sh show --issue <번호>
  scripts/mmp-workflow-seed.sh validate --issue <번호>

Commands:
  init       seed 파일 생성 (요건/제약/검증 항목 포함)
  set-status 상태값 갱신 (approved/completed/blocked/draft)
  show       seed 상태 출력
  validate   seed 무결성/요건 완료 조건 검사

Options:
  --issue <번호>            Issue 번호 (필수)
  --title <문자열>         Issue 제목 또는 요구사항 제목
  --source <이름>           인터뷰 출처 (기본: deep-interview)
  --objective <문자열>      문제 정의
  --scope-in <문자열>       범위(In)
  --scope-out <문자열>      범위(Out)
  --constraints <문자열>    제약 조건
  --acceptance "<항목>"     acceptance criteria (반복 지정 가능)
  --done-criteria "<항목>"   완료 조건 (반복 지정 가능)
  --risk "<항목>"           리스크 (반복 지정 가능)
  --status <draft|approved|completed|blocked>  set-status에서 사용
  --reason <문자열>         blocked/exception 사유
  --force                   기존 seed가 있어도 덮어쓰기

Examples:
  scripts/mmp-workflow-seed.sh init --issue 248 --title "Phase 24 보강" \\
    --objective "심층 인터뷰 기반 작업 계획" --scope-in "editor + flow" --scope-out "infra" \\
    --acceptance "요구사항 누락 위험이 없음" --done-criteria "실행 체크리스트 통과"
  scripts/mmp-workflow-seed.sh set-status --issue 248 --status approved
  scripts/mmp-workflow-seed.sh validate --issue 248
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

seed_dir() {
  echo "$(workflow_root)/seeds"
}

seed_file() {
  local issue="$1"
  mkdir -p "$(seed_dir)"
  echo "$(seed_dir)/issue-${issue}.json"
}

event_file() {
  echo "$(workflow_root)/events.jsonl"
}

now_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

join_args_to_array() {
  local -n arr_ref=$1
  local out="[]"
  if (( ${#arr_ref[@]} == 0 )); then
    printf '%s\n' "$out"
    return
  fi
  printf '%s\n' "${arr_ref[@]}" | jq -R . | jq -s .
}

log_event() {
  local issue="$1"
  local event="$2"
  local note="$3"
  local seed_path="$4"
  local ts
  ts="$(now_utc)"
  mkdir -p "$(workflow_root)"
  jq -n \
    --arg ts "$ts" \
    --arg event "$event" \
    --arg issue "$issue" \
    --arg note "$note" \
    --arg path "$seed_path" \
    '{ts:$ts, event:$event, issue:($issue|tonumber), note:$note, seed:$path}' \
    >>"$(event_file)"
  printf '\n' >>"$(event_file)"
}

validate_issue() {
  local issue="$1"
  if ! [[ "$issue" =~ ^[0-9]+$ ]]; then
    echo "🚫 issue 번호는 숫자여야 합니다: $issue" >&2
    exit 2
  fi
}

require_seed_file() {
  local issue="$1"
  local path
  path="$(seed_file "$issue")"
  if [[ ! -f "$path" ]]; then
    echo "🚫 Seed 파일이 없습니다: $path" >&2
    echo "   scripts/mmp-workflow-seed.sh init --issue $issue ... 으로 먼저 생성하세요." >&2
    return 1
  fi
}

read_status() {
  local file="$1"
  jq -r '.status // ""' "$file"
}

status_rank() {
  case "$1" in
    draft) echo 0 ;;
    approved) echo 1 ;;
    completed) echo 2 ;;
    blocked) echo -1 ;;
    *) echo 9 ;;
  esac
}

require_valid_status() {
  local status
  status="$1"
  case "$status" in
    draft|approved|completed|blocked) return 0 ;;
    *) return 1 ;;
  esac
}

init_seed() {
  local issue="" title="" source="deep-interview" objective="" scope_in="" scope_out="" constraints=""
  local -a acceptance=()
  local -a done_criteria=()
  local -a risks=()
  local force=0
  local branch=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue) issue="$2"; shift 2 ;;
      --title) title="$2"; shift 2 ;;
      --source) source="$2"; shift 2 ;;
      --objective) objective="$2"; shift 2 ;;
      --scope-in) scope_in="$2"; shift 2 ;;
      --scope-out) scope_out="$2"; shift 2 ;;
      --constraints) constraints="$2"; shift 2 ;;
      --acceptance|--acceptance-criteria) acceptance+=("$2"); shift 2 ;;
      --done-criteria|--completion-criteria) done_criteria+=("$2"); shift 2 ;;
      --risk) risks+=("$2"); shift 2 ;;
      --force) force=1; shift ;;
      --branch) branch="$2"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "🚫 알 수 없는 옵션: $1" >&2; usage; exit 2 ;;
    esac
  done

  validate_issue "$issue"
  if [[ -z "$title" ]]; then
    title="$(git config user.name 2>/dev/null || true)"
  fi

  local path status acceptance_json done_json risks_json ts owner
  path="$(seed_file "$issue")"
  if [[ -f "$path" && "$force" -ne 1 ]]; then
    echo "🚫 Seed가 이미 존재합니다: $path (덮어쓰려면 --force)" >&2
    exit 2
  fi

  acceptance_json="$(join_args_to_array acceptance)"
  done_json="$(join_args_to_array done_criteria)"
  risks_json="$(join_args_to_array risks)"
  owner="$(git config user.name 2>/dev/null || true)"
  ts="$(now_utc)"
  status="draft"

  if [[ -z "$title" ]]; then
    title="issue-$issue"
  fi

  jq -n \
    --arg issue "$issue" \
    --arg title "$title" \
    --arg source "$source" \
    --arg objective "$objective" \
    --arg scope_in "$scope_in" \
    --arg scope_out "$scope_out" \
    --arg constraints "$constraints" \
    --arg branch "${branch:-$(git branch --show-current 2>/dev/null || true)}" \
    --arg owner "$owner" \
    --argjson acceptance "$acceptance_json" \
    --argjson done_criteria "$done_json" \
    --argjson risks "$risks_json" \
    --arg ts "$ts" \
    '{issue: ($issue|tonumber), title: $title, status: "draft", source: $source, objective: $objective, scope_in: $scope_in, scope_out: $scope_out, constraints: $constraints, acceptance_criteria: $acceptance, done_criteria: $done_criteria, risks: $risks, created_at: $ts, updated_at: $ts, owner: $owner, branch_hint: $branch, follow_up: []}' \
    >"$path"

  log_event "$issue" "seed.init" "초기 Seed 생성" "$path"
  echo "✅ Seed initialized: $path"
}

set_status() {
  local issue="" status="" reason=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue) issue="$2"; shift 2 ;;
      --status) status="$2"; shift 2 ;;
      --reason) reason="$2"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "🚫 알 수 없는 옵션: $1" >&2; usage; exit 2 ;;
    esac
  done

  validate_issue "$issue"
  if [[ -z "$status" ]]; then
    echo "🚫 --status 가 필요합니다." >&2
    exit 2
  fi
  if ! require_valid_status "$status"; then
    echo "🚫 지원하지 않는 status 입니다: $status" >&2
    exit 2
  fi

  local path updated
  path="$(seed_file "$issue")"
  require_seed_file "$issue"

  if [[ -z "$reason" ]]; then
    reason="status=$status"
  fi

  updated="$(now_utc)"
  local tmp
  tmp="$(mktemp)"
  jq --arg status "$status" --arg reason "$reason" --arg updated "$updated" \
    '(.status = $status) | (.updated_at = $updated) | (.block_reason = (if $status == "blocked" then $reason else null end)) | (if $status=="completed" then .completed_at=$updated else . end)' \
    "$path" >"$tmp"
  mv "$tmp" "$path"

  log_event "$issue" "seed.status" "status=$status" "$path"
  echo "✅ Seed status updated: issue-$issue => $status"
}

show_seed() {
  local issue=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue) issue="$2"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) echo "🚫 알 수 없는 옵션: $1" >&2; usage; exit 2 ;;
    esac
  done

  validate_issue "$issue"
  local path
  path="$(seed_file "$issue")"
  require_seed_file "$issue"
  jq -r --arg path "$path" '
    "Issue #\(.issue)\nTitle: \(.title)\nStatus: \(.status)\nScope-in: \(.scope_in)\nScope-out: \(.scope_out)\nObjective: \(.objective)\nConstraints: \(.constraints)\nAcceptances: \(if (.acceptance_criteria|length)==0 then "(none)" else (.acceptance_criteria|join(", ")) end)\nDone criteria: \(if (.done_criteria|length)==0 then "(none)" else (.done_criteria|join(", ")) end)\nUpdated: \(.updated_at)\nSeed file: \($path)\n"
  ' "$path"
}

validate_seed() {
  local issue=""
  local require_done_criteria=0
  local require_acceptance=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue) issue="$2"; shift 2 ;;
      --require-done-criteria) require_done_criteria=1; shift ;;
      --require-acceptance) require_acceptance=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) echo "🚫 알 수 없는 옵션: $1" >&2; usage; exit 2 ;;
    esac
  done

  validate_issue "$issue"
  local path
  path="$(seed_file "$issue")"
  require_seed_file "$issue"

  local status issue_title
  status="$(read_status "$path")"
  if ! require_valid_status "$status"; then
    echo "🚫 Seed status가 유효하지 않습니다: $status" >&2
    exit 2
  fi

  issue_title="$(jq -r '.title // ""' "$path")"
  if [[ -z "$issue_title" || "$issue_title" == "null" ]]; then
    echo "🚫 title 누락" >&2
    exit 2
  fi

  if ((require_acceptance)); then
    local accept_len
    accept_len="$(jq -r '.acceptance_criteria | length' "$path")"
    if ((accept_len == 0)); then
      echo "🚫 acceptance criteria가 비어 있습니다." >&2
      exit 2
    fi
  fi

  if ((require_done_criteria)); then
    local done_len
    done_len="$(jq -r '.done_criteria | length' "$path")"
    if ((done_len == 0)); then
      echo "🚫 done criteria가 비어 있습니다." >&2
      exit 2
    fi
  fi

  local blocked_reason
  blocked_reason="$(jq -r '.block_reason // empty' "$path")"
  if [[ "$status" == "blocked" ]]; then
    if [[ -z "$blocked_reason" ]]; then
      echo "🚫 blocked 상태인데 block_reason이 없습니다." >&2
      exit 2
    fi
  fi

  echo "✅ Seed validation pass: $path"
}

command="${1:-}"
if [[ -z "$command" ]]; then
  usage
  exit 2
fi
shift

case "$command" in
  init)
    init_seed "$@"
    ;;
  set-status)
    set_status "$@"
    ;;
  show)
    show_seed "$@"
    ;;
  validate)
    validate_seed "$@"
    ;;
  *)
    usage
    exit 2
    ;;
esac
