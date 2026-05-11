#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR_NAME=".local/state/mmp-workflow"
REPO_SEED_DIR="$ROOT_DIR/.git/mmp-workflow/seeds"

run_router_case() {
  local label="$1"
  local input="$2"
  local expect="$3"
  local unexpected="${4:-}"
  local out

  out="$(printf '%s' "$input" | python3 .codex/scripts/mmp-keyword-router.py)"

  if [[ "$out" != *"$expect"* ]]; then
    echo "FAIL: $label - expected: $expect" >&2
    echo "actual: $out" >&2
    return 1
  fi

  if [[ -n "$unexpected" && "$out" == *"$unexpected"* ]]; then
    echo "FAIL: $label - unexpected hit: $unexpected" >&2
    echo "actual: $out" >&2
    return 1
  fi

  echo "PASS: $label"
}

run_posttool_case() {
  local label="$1"
  local issue="$2"
  local status_json="$3"
  local expectations=("${@:4}")
  local out

  mkdir -p "$REPO_SEED_DIR"
  printf '%s' "$status_json" > "$REPO_SEED_DIR/issue-${issue}.json"

  out="$(
    MMP_WORKFLOW_HOOKS_ENABLED=1 \
    MMP_WORKFLOW_HOOKS_SKIP=0 \
    MMP_WORKFLOW_INTERVIEW_STRICT=1 \
    MMP_ISSUE_NUMBER="$issue" \
    HOME="$TMP_HOME" \
    python3 .codex/scripts/mmp-posttool-hook.py 2>&1
  )"

  for expected in "${expectations[@]}"; do
    if [[ "$out" != *"$expected"* ]]; then
      echo "FAIL: $label - expected: $expected" >&2
      echo "actual: $out" >&2
      return 1
    fi
  done

  echo "PASS: $label"
}

run_posttool_empty_case() {
  local label="$1"
  local out

  out="$(
    MMP_WORKFLOW_HOOKS_ENABLED=1 \
    MMP_WORKFLOW_HOOKS_SKIP=1 \
    MMP_WORKFLOW_INTERVIEW_STRICT=1 \
    MMP_ISSUE_NUMBER=900 \
    HOME="$TMP_HOME" \
    python3 .codex/scripts/mmp-posttool-hook.py 2>&1
  )"

  if [[ -n "$out" ]]; then
    echo "FAIL: $label - expected no output when skip=1" >&2
    echo "actual: $out" >&2
    return 1
  fi

  echo "PASS: $label"
}

run_session_case() {
  local label="$1"
  local out

  out="$(
    MMP_WORKFLOW_HOOKS_ENABLED=1 \
    MMP_WORKFLOW_INTERVIEW_STRICT=1 \
    HOME="$TMP_HOME" \
    python3 .codex/scripts/mmp-session-start-hook.py 2>&1
  )"

  if [[ "$out" != *"MMP 작업 가이드"* ]]; then
    echo "FAIL: $label - session start hook did not render guide" >&2
    echo "actual: $out" >&2
    return 1
  fi

  echo "PASS: $label"
}

TMP_HOME="$(mktemp -d)"
export TMP_HOME
trap 'rm -rf "$TMP_HOME"' EXIT

mkdir -p "$TMP_HOME/$STATE_DIR_NAME"
rm -f "$TMP_HOME/$STATE_DIR_NAME/codex-hook-session.json"
rm -f "$TMP_HOME/$STATE_DIR_NAME/codex-posttool.json"

run_router_case "keyword bootstrap with particle" "이슈 42로 mmp bootstrap 해줘" "--issue 42"
run_router_case "keyword commit ambiguous number" "mmp commit 5 things" "--issue <번호>" " --issue 5 "
run_router_case "keyword issue token" "mmp commit issue-123 now" "--issue 123"

run_posttool_case "posttool strict draft state" 701 \
  '{"status":"draft","acceptance_criteria":[],"done_criteria":[]}' \
  "seed가 없거나 draft 상태입니다."

run_posttool_case "posttool approved empty criteria" 702 \
  '{"status":"approved","acceptance_criteria":[],"done_criteria":[]}' \
  "acceptance_criteria가 비어 있습니다." \
  "done_criteria가 비어 있습니다."

run_posttool_empty_case "posttool skip=1 suppresses output"
run_session_case "session start prints guidance"

rm -f "$REPO_SEED_DIR/issue-701.json"
rm -f "$REPO_SEED_DIR/issue-702.json"
