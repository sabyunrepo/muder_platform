#!/usr/bin/env bash
# Agent-oriented workflow orchestrator for MMP issue execution.
#
# 목표:
# - deep-interview 기반 Seed 상태를 확인/생성/승인하고
# - issue worktree 분기 생성까지 한 번에 처리
# - PR 생성 가드 진입을 위한 issue 번호 추적을 자동화

set -euo pipefail

usage() {
  cat <<'MSG'
Usage:
  scripts/mmp-workflow-agent.sh bootstrap --issue <번호> [options]
  scripts/mmp-workflow-agent.sh pr [gh pr create options]
  scripts/mmp-workflow-agent.sh commit --issue <번호> [options] [-- gh 커밋/PR 옵션]
  scripts/mmp-workflow-agent.sh complete [--issue <번호>]
  scripts/mmp-workflow-agent.sh status [--issue <번호>]

Modes:
  bootstrap  기존 mmp-start-issue-work flow를 자동으로 준비/실행
  pr         pr-create-guard 를 issue 컨텍스트 기반으로 실행
  commit     git add/commit을 에이전트가 수행하고 선택 시 PR까지 즉시 진행
  complete   Seed 상태를 completed 로 전환
  status     Seed 상태 빠른 조회

bootstrap options:
  --issue <번호>                Issue 번호 (필수)
  --slug <문자열>               브랜치 slug (옵션)
  --source <문자열>             Seed source (기본: deep-interview)
  --objective <문자열>          인터뷰에서 정의한 목적
  --scope-in <문자열>           범위(In)
  --scope-out <문자열>          범위(Out)
  --constraints <문자열>        제약
  --acceptance "..."             acceptance criteria (반복 가능)
  --done-criteria "..."          done criteria (반복 가능)
  --no-body-extract               이슈 본문 자동 추출 비활성화
  --auto-approve                 Seed가 draft일 때 즉시 approved 처리
  --skip-start                    worktree 생성 없이 준비만 수행

pr options:
  --issue <번호>                 issue 번호를 명시(브랜치 패턴 미검출 시 사용)

commit options:
  --issue <번호>                 Issue 번호 (기본: 환경변수/브랜치 추출)
  --message "<커밋 메시지>"         기본: feat: issue-<번호> 작업
  --slug <문자열>                브랜치 slug (기본: 이슈 제목 slug)
  --no-stage                     git add -A 생략(이미 스테이징한 경우 사용)
  --skip-gate                    Seed 가드(approved/done/acceptance) 생략
  --auto-bootstrap               seed 없거나 미승인 시 issue 기준으로 bootstrap 후 진행
  --ensure-branch                PR용 브랜치명 규칙 미충족 시 자동 생성/이동 (기본 on)
  --no-ensure-branch             PR용 브랜치명 규칙 미충족 시 생성/이동 생략
  --run-local-ci                 커밋 전 scripts/mmp-local-ci.sh quick 실행
  --auto-complete                커밋 성공 후 seed 상태를 completed로 전환
  --create-pr                     즉시 PR 생성 (pr 서브커맨드 옵션은 `--` 이후 전달)
  -- [gh pr create options]       create-pr 사용 시 gh pr create 옵션 전달

Examples:
  scripts/mmp-workflow-agent.sh bootstrap --issue 248 --slug ui-flow-compact \
    --acceptance "요구사항 누락이 없음" --done-criteria "작업 완료 후 테스트 통과" \
    --auto-approve
  scripts/mmp-workflow-agent.sh pr --title "feat: issue-248 flow"
  scripts/mmp-workflow-agent.sh commit --issue 248 --message "feat: issue-248 workflow" --create-pr -- \
    --title "feat: issue-248 workflow" --body "요약: Ouroboros 스타일 인터뷰 기준 반영"
  scripts/mmp-workflow-agent.sh complete --issue 248
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
require_cmd gh

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
  printf '%s/seeds/issue-%s.json' "$(workflow_root)" "$issue"
}

issue_from_branch() {
  local branch="$1"
  if [[ "$branch" =~ (^|/)issue-([0-9]+)($|[^0-9]) ]]; then
    echo "${BASH_REMATCH[2]}"
    return 0
  fi
  return 1
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c 1-64
}

resolve_issue_context() {
  local explicit_issue="${1:-}"
  local issue="${explicit_issue}"
  if [[ -z "$issue" ]]; then
    issue="${MMP_ISSUE_NUMBER:-}"
  fi
  if [[ -z "$issue" ]]; then
    local branch
    branch="$(git rev-parse --abbrev-ref HEAD)"
    issue="$(issue_from_branch "$branch" || true)"
  fi

  if [[ -z "$issue" ]]; then
    echo ""
    return 1
  fi
  if ! [[ "$issue" =~ ^[0-9]+$ ]]; then
    echo "🚫 issue 번호는 숫자여야 합니다: $issue" >&2
    return 2
  fi
  printf '%s' "$issue"
}

build_issue_branch_name() {
  local issue="$1"
  local slug="$2"
  local prefix="${BRANCH_PREFIX:-feat}"
  printf '%s/issue-%s-%s' "$prefix" "$issue" "$slug"
}

ensure_issue_branch() {
  local issue="$1"
  local slug="$2"
  local mode="${3:-strict}"
  local branch current existing_branch_name fallback

  if [[ -z "$slug" ]]; then
    slug="$(slugify "$(seed_issue_title "$issue")")"
  fi
  if [[ -z "$slug" ]]; then
    fallback="$(date -u +"%Y%m%d%H%M%S")"
    slug="agent-${fallback}"
  fi
  branch="$(build_issue_branch_name "$issue" "$slug")"
  existing_branch_name="$(git rev-parse --abbrev-ref HEAD)"

  if issue_from_branch "$existing_branch_name" >/dev/null; then
    local current_issue
    current_issue="$(issue_from_branch "$existing_branch_name")"
    if [[ "$current_issue" == "$issue" ]]; then
      return 0
    fi
    echo "🚫 현재 브랜치($existing_branch_name)는 다른 issue(issue-$current_issue)와 연결되어 있습니다." >&2
    echo "   동일 작업이라면 먼저 분기 이름을 issue-$issue로 변경해 주세요." >&2
    return 2
  fi

  if git rev-parse --verify "$branch" >/dev/null 2>&1 || git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
    if [[ "$mode" == "strict" ]]; then
      echo "🚫 PR용 브랜치명이 이미 존재합니다: $branch" >&2
      echo "   다음 단계로 진행하려면 브랜치/slug 충돌 해결이 필요합니다." >&2
      return 2
    fi
    if [[ "$slug" != *"-retry" ]]; then
      branch="${branch}-retry"
    fi
    local idx=1
    while git rev-parse --verify "$branch" >/dev/null 2>&1 || git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; do
      idx=$((idx + 1))
      branch="${branch}-${idx}"
    done
  fi

  echo "📌 PR 브랜치로 이동/생성: $branch" >&2
  git checkout -b "$branch"
}

seed_exists() {
  local issue="$1"
  [[ -f "$(seed_file "$issue")" ]]
}

seed_status() {
  local issue="$1"
  local file
  file="$(seed_file "$issue")"
  jq -r '.status // ""' "$file"
}

seed_issue_title() {
  local issue="$1"
  gh issue view "$issue" --json title --jq '.title'
}

seed_issue_body() {
  local issue="$1"
  gh issue view "$issue" --json body --jq '.body // ""'
}

first_nonempty_line() {
  local text="$1"
  printf '%s' "$text" | awk 'NF{print; exit}'
}

extract_section_items() {
  local body="$1"
  local heading_re="$2"
  local -a items=()
  local section_active=0
  local line
  local heading_text

  while IFS= read -r line; do
    line="${line//$'\r'/}"

    if [[ "$line" =~ ^[[:space:]]*#{1,6}[[:space:]]+(.+)$ ]]; then
      heading_text="${BASH_REMATCH[1],,}"
      heading_text="$(printf '%s' "$heading_text" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
      if [[ "$heading_text" =~ $heading_re ]]; then
        section_active=1
      else
        section_active=0
      fi
      continue
    fi

    if (( section_active == 1 )); then
      local inline_heading
      if [[ "$line" =~ ^[[:space:]]*([^:]{1,80})[[:space:]]*:[[:space:]]*(.*)$ ]]; then
        inline_heading="${BASH_REMATCH[1],,}"
        inline_heading="$(printf '%s' "$inline_heading" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
        if [[ "$inline_heading" =~ $heading_re ]]; then
          if [[ -n "${BASH_REMATCH[2]}" && -n "${BASH_REMATCH[2]//[[:space:]]/}" ]]; then
            items+=("${BASH_REMATCH[2]}")
          fi
          continue
        fi
      fi

      if [[ "$line" =~ ^[[:space:]]*[-*+][[:space:]]+\[[[:space:]]*[xX][[:space:]]*\][[:space:]]*(.+)$ ]]; then
        line="${BASH_REMATCH[1]}"
      elif [[ "$line" =~ ^[[:space:]]*[-*+][[:space:]]+(.+)$ ]]; then
        line="${BASH_REMATCH[1]}"
      elif [[ "$line" =~ ^[[:space:]]*[0-9]+\.[[:space:]]+(.+)$ ]]; then
        line="${BASH_REMATCH[1]}"
      else
        line="$(printf '%s' "$line" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
      fi
      if [[ -z "$line" ]]; then
        continue
      fi
      if [[ "$line" == "---" || "$line" == "----" ]]; then
        continue
      fi
      if [[ "$line" == '```'* || "$line" == '> '* ]]; then
        continue
      fi
      items+=("$line")
    fi
  done <<< "$body"

  if (( ${#items[@]} == 0 )); then
    return 1
  fi
  printf '%s\n' "${items[@]}"
}

extract_first_section_value() {
  local body="$1"
  local heading_re="$2"
  local first
  if ! first="$(extract_section_items "$body" "$heading_re" | head -n 1)"; then
    return 1
  fi
  printf '%s' "$first"
}

bootstrap_issue() {
  local issue=""
  local slug=""
  local source="deep-interview"
  local title=""
  local objective=""
  local scope_in=""
  local scope_out=""
  local constraints=""
  local auto_approve=0
  local skip_start=0
  local use_issue_body=1
  local -a acceptance=()
  local -a done_criteria=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue) issue="$2"; shift 2 ;;
      --slug) slug="$2"; shift 2 ;;
      --source) source="$2"; shift 2 ;;
      --objective) objective="$2"; shift 2 ;;
      --scope-in) scope_in="$2"; shift 2 ;;
      --scope-out) scope_out="$2"; shift 2 ;;
      --constraints) constraints="$2"; shift 2 ;;
      --acceptance|--acceptance-criteria) acceptance+=("$2"); shift 2 ;;
      --done-criteria|--completion-criteria) done_criteria+=("$2"); shift 2 ;;
      --no-body-extract) use_issue_body=0; shift ;;
      --auto-approve) auto_approve=1; shift ;;
      --skip-start) skip_start=1; shift ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "🚫 알 수 없는 bootstrap 옵션: $1" >&2
        usage
        exit 2
        ;;
    esac
  done

  if [[ -z "$issue" ]]; then
    echo "🚫 --issue 는 필수입니다." >&2
    usage
    exit 2
  fi

  if ! [[ "$issue" =~ ^[0-9]+$ ]]; then
    echo "🚫 issue 번호는 숫자여야 합니다: $issue" >&2
    exit 2
  fi

  if [[ -z "$title" ]]; then
    title="$(seed_issue_title "$issue")"
  fi

  local issue_body=""
  if (( use_issue_body == 1 )); then
    issue_body="$(seed_issue_body "$issue")"
  fi

  if [[ -z "$objective" ]]; then
    local body_objective
    if (( use_issue_body == 1 )); then
    if body_objective="$(extract_first_section_value "$issue_body" "목표|objectives?|objective|goal")"; then
        :
      else
        body_objective=""
      fi
      if [[ -z "$body_objective" ]]; then
        objective="$(first_nonempty_line "$issue_body")"
      else
        objective="$body_objective"
      fi
    else
      objective="$title"
    fi
  fi

  if [[ "$use_issue_body" == "1" ]]; then
    if [[ -z "$scope_in" ]]; then
      if ! scope_in="$(extract_first_section_value "$issue_body" "범위\\(In\\)|범위.*\\(in\\)|in[[:space:]]*scope|scope[[:space:]]*in|scope[[:space:]]*-?[[:space:]]*in|scope-in|scope[[:space:]]+in|scope[[:space:]]*\\(in\\)|포함 범위|in[[:space:]]*scope")"; then
        scope_in=""
      fi
    fi
    if [[ -z "$scope_out" ]]; then
      if ! scope_out="$(extract_first_section_value "$issue_body" "범위\\(Out\\)|범위.*\\(out\\)|out[[:space:]]*scope|scope[[:space:]]*out|scope[[:space:]]*-?[[:space:]]*out|scope-out|scope[[:space:]]+out|scope[[:space:]]*\\(out\\)|제외|제외 범위")"; then
        scope_out=""
      fi
    fi
    if [[ -z "$constraints" ]]; then
      if ! constraints="$(extract_first_section_value "$issue_body" "제약|constraints?|제약 조건|제약사항|제한|조건|constraints?|constraint")"; then
        constraints=""
      fi
    fi
  fi

  if ! seed_exists "$issue"; then
    if [[ -z "$scope_in" ]]; then
      scope_in="(unfilled)"
    fi
    if [[ -z "$scope_out" ]]; then
      scope_out="(unfilled)"
    fi
    if [[ -z "$constraints" ]]; then
      constraints="(none)"
    fi

    local -a init_args=(
      --issue "$issue"
      --title "$title"
      --source "$source"
      --objective "$objective"
      --scope-in "$scope_in"
      --scope-out "$scope_out"
      --constraints "$constraints"
    )

    if (( ${#acceptance[@]} == 0 && use_issue_body == 1 )); then
      while IFS= read -r item; do
        acceptance+=("$item")
      done < <(extract_section_items "$issue_body" "acceptance|수락|acceptance criteria|acceptance criterion|acceptance condition|검수 기준|수용|ac")
    fi
    if (( ${#acceptance[@]} == 0 )); then
      acceptance+=("요구사항 누락이 없도록 인터뷰 항목 보강 필요")
    fi
    for a in "${acceptance[@]}"; do
      init_args+=(--acceptance "$a")
    done

    if (( ${#done_criteria[@]} == 0 && use_issue_body == 1 )); then
      while IFS= read -r item; do
        done_criteria+=("$item")
      done < <(extract_section_items "$issue_body" "완료[[:space:]]*(조건|기준)|done[[:space:]]*(criteria|criterion|condition|conditions)|완수[[:space:]]*기준|마감[[:space:]]*조건|완료 항목|완수[[:space:]]*항목|완료[[:space:]]*목록")
    fi
    if (( ${#done_criteria[@]} == 0 )); then
      done_criteria+=("작업 완료 후 테스트 근거 확인")
    fi
    for d in "${done_criteria[@]}"; do
      init_args+=(--done-criteria "$d")
    done

    scripts/mmp-workflow-seed.sh init "${init_args[@]}"

    # 새로 생성한 seed는 기본 draft로 시작
    if (( auto_approve == 1 )); then
      scripts/mmp-workflow-seed.sh set-status --issue "$issue" --status approved
    fi
  else
    echo "ℹ️ Seed already exists: $(seed_file "$issue")"

    if (( auto_approve == 1 )); then
      local current_status
      current_status="$(seed_status "$issue")"
      if [[ "$current_status" != "approved" && "$current_status" != "completed" ]]; then
        scripts/mmp-workflow-seed.sh set-status --issue "$issue" --status approved
      fi
    fi
  fi

  local status
  status="$(seed_status "$issue")"
  if [[ "$status" != "approved" && "$status" != "completed" ]]; then
    echo "🚫 issue#$issue seed가 approved/completed가 아닙니다 (현재: $status)." >&2
    if (( auto_approve == 1 )); then
      echo "   set-status로 진행되지 않았습니다. 상태 반영 값을 확인하세요." >&2
    else
      echo "   다음 명령으로 승인하세요:" >&2
      echo "   scripts/mmp-workflow-seed.sh set-status --issue $issue --status approved" >&2
      echo "   또는 --auto-approve 로 다시 실행" >&2
    fi
    exit 3
  fi

  if (( skip_start == 1 )); then
    echo "✅ bootstrap complete. Start is skipped by --skip-start." >&2
    return 0
  fi

  if [[ -n "${MMP_WORKFLOW_INTERVIEW_STRICT:-1}" && "${MMP_WORKFLOW_INTERVIEW_STRICT:-1}" == "1" ]]; then
    if ! scripts/mmp-workflow-gate.sh issue --issue "$issue" --min-status approved --require-acceptance --require-done; then
      echo "🚫 bootstrap 실패: issue #$issue gate가 통과되지 않았습니다." >&2
      exit 3
    fi
  fi

  if [[ -n "$slug" ]]; then
    scripts/mmp-start-issue-work.sh "$issue" "$slug"
  else
    scripts/mmp-start-issue-work.sh "$issue"
  fi
}

commit_issue_work() {
  local issue=""
  local message=""
  local slug=""
  local stage_all=1
  local skip_gate=0
  local ensure_branch=1
  local run_local_ci=0
  local auto_bootstrap=0
  local auto_complete=0
  local create_pr=0
  local -a args=()
  local -a pr_args=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue)
        issue="$2"
        shift 2
        ;;
      --message|--msg)
        message="$2"
        shift 2
        ;;
      --slug)
        slug="$2"
        shift 2
        ;;
      --no-stage)
        stage_all=0
        shift
        ;;
      --skip-gate)
        skip_gate=1
        shift
        ;;
      --auto-bootstrap)
        auto_bootstrap=1
        shift
        ;;
      --ensure-branch)
        ensure_branch=1
        shift
        ;;
      --no-ensure-branch)
        ensure_branch=0
        shift
        ;;
      --run-local-ci)
        run_local_ci=1
        shift
        ;;
      --auto-complete)
        auto_complete=1
        shift
        ;;
      --create-pr)
        create_pr=1
        shift
        ;;
      --)
        shift
        pr_args=("$@")
        break
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        args+=("$1")
        shift
        ;;
    esac
  done

  if [[ ${#args[@]} -ne 0 ]]; then
    echo "🚫 알 수 없는 commit 옵션: ${args[*]}" >&2
    usage
    exit 2
  fi

  issue="$(resolve_issue_context "$issue")" || {
    echo "🚫 --issue를 지정하거나 브랜치명/환경변수에서 issue 번호를 찾으세요." >&2
    echo "   예: scripts/mmp-workflow-agent.sh commit --issue <번호> ..." >&2
    exit 3
  }

  if (( auto_bootstrap == 1 )); then
    bootstrap_issue --issue "$issue" --auto-approve --skip-start
  fi

  if (( skip_gate == 0 )); then
    if ! scripts/mmp-workflow-gate.sh issue --issue "$issue" --min-status approved --require-acceptance --require-done; then
      echo "🚫 commit 블록: issue #$issue 가드가 통과되지 않았습니다." >&2
      echo "   먼저 seed 승인/완료 기준을 채워 주세요." >&2
      exit 3
    fi
  fi

  if (( ensure_branch == 1 )); then
    ensure_issue_branch "$issue" "$slug" strict
  fi

  if (( run_local_ci == 1 )); then
    scripts/mmp-local-ci.sh quick
  fi

  if (( stage_all == 1 )); then
    git add -A
  fi
  if git diff --cached --quiet; then
    echo "🚫 staged 변경사항이 없습니다." >&2
    echo "   변경 후 git add -A 후 다시 실행하거나 --no-stage를 사용하세요." >&2
    exit 3
  fi

  if [[ -z "$message" ]]; then
    message="feat: issue-${issue} 작업"
  fi
  git commit -m "$message"
  echo "✅ commit 완료: $(git rev-parse --short HEAD)"

  if (( create_pr == 1 )); then
    if [[ ${#pr_args[@]} -gt 0 ]]; then
      MMP_ISSUE_NUMBER="$issue" scripts/pr-create-guard.sh "${pr_args[@]}"
    else
      MMP_ISSUE_NUMBER="$issue" scripts/pr-create-guard.sh --title "feat: issue-${issue} 작업"
    fi
  fi

  if (( auto_complete == 1 )); then
    scripts/mmp-workflow-seed.sh set-status --issue "$issue" --status completed
    echo "✅ issue-$issue seed completed 반영"
  fi
}

execute_pr_guard() {
  local explicit_issue=""
  local issue=""
  local -a args=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue)
        explicit_issue="$2"
        shift 2
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        args+=("$1")
        shift
        ;;
    esac
  done

  if [[ -n "$explicit_issue" ]]; then
    issue="$(resolve_issue_context "$explicit_issue")"
  else
    issue="$(resolve_issue_context "")" || {
      echo "🚫 현재 브랜치/환경에서 issue 번호를 찾지 못했습니다." >&2
      echo "   옵션: scripts/mmp-workflow-agent.sh pr --issue <번호> -- ..." >&2
      exit 3
    }
  fi

  MMP_ISSUE_NUMBER="$issue" scripts/pr-create-guard.sh "${args[@]}"
}

mark_complete() {
  local issue="${MMP_ISSUE_NUMBER:-}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue)
        issue="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "🚫 알 수 없는 complete 옵션: $1" >&2
        usage
        exit 2
        ;;
    esac
  done

  if [[ -z "$issue" ]]; then
    issue="$(resolve_issue_context "" )" || {
      echo "🚫 --issue를 지정하거나 issue 패턴 브랜치에서 실행하세요." >&2
      exit 2
    }
  fi

  scripts/mmp-workflow-seed.sh set-status --issue "$issue" --status completed
}

show_status() {
  local issue="${MMP_ISSUE_NUMBER:-}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --issue)
        issue="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "🚫 알 수 없는 status 옵션: $1" >&2
        usage
        exit 2
        ;;
    esac
  done

  if [[ -z "$issue" ]]; then
    issue="$(resolve_issue_context "" )" || {
      echo "🚫 --issue를 지정하거나 issue 브랜치에서 실행하세요." >&2
      exit 2
    }
  fi

  scripts/mmp-workflow-status.sh issue "$issue"
}

cmd="${1:-}"
case "$cmd" in
  bootstrap)
    shift
    bootstrap_issue "$@"
    ;;
  pr)
    shift
    execute_pr_guard "$@"
    ;;
  commit)
    shift
    commit_issue_work "$@"
    ;;
  complete)
    shift
    mark_complete "$@"
    ;;
  status)
    shift
    show_status "$@"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 2
    ;;
esac
