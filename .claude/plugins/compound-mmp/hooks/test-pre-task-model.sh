#!/usr/bin/env bash
# pre-task-model-guard.sh 테스트 fixture.
# 카논: memory/feedback_sonnet_46_default.md (Sonnet 4.6 기본, 4.5 차단)
#       refs/sim-case-c.md (검증 시뮬레이션 Case C)
#
# 시나리오:
#   A. tool_name 게이트 (Task 만 검사, 나머지 silent)
#   B. JSON 비정상 비차단 보장
#   C. prompt sonnet-4-5 매칭 deny (변형 포함)
#   D. tool_input.model 매칭 deny
#   E. False positive 회피 (haiku-4-5, sonnet-4-6, "version 4.5" 등)
#   F. COMPOUND_MMP_MODEL_GUARD_DISABLE=1 환경 토글

set -eu

HOOK="$(dirname "$0")/pre-task-model-guard.sh"
VERBOSE="${1:-}"
PASS=0
FAIL=0

assert_silent() {
  local description="$1"
  local input="$2"
  local output
  output=$(printf '%s' "$input" | bash "$HOOK" 2>/dev/null || true)
  if [ -z "$output" ]; then
    PASS=$((PASS+1))
    if [ "$VERBOSE" = "verbose" ]; then
      echo "PASS: $description"
    fi
  else
    FAIL=$((FAIL+1))
    echo "FAIL: $description"
    echo "  expected: silent"
    echo "  actual:   $output"
  fi
}

assert_decision() {
  local description="$1"
  local input="$2"
  local expected="$3"
  local output
  output=$(printf '%s' "$input" | bash "$HOOK" 2>/dev/null || true)
  if [ -z "$output" ]; then
    FAIL=$((FAIL+1))
    echo "FAIL: $description"
    echo "  expected: $expected"
    echo "  actual:   silent"
    return 0
  fi
  local actual
  actual=$(printf '%s' "$output" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null || echo "parse_error")
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS+1))
    if [ "$VERBOSE" = "verbose" ]; then
      echo "PASS: $description"
    fi
  else
    FAIL=$((FAIL+1))
    echo "FAIL: $description"
    echo "  expected: $expected"
    echo "  actual:   $actual"
    echo "  output:   $output"
  fi
}

# === A. tool_name 게이트 (Task 만 검사) ===
assert_silent "tool_name=Read는 통과 (sonnet-4-5 prompt 무관)" \
  '{"tool_name": "Read", "tool_input": {"file_path": "/tmp/x.go", "prompt": "use sonnet-4-5"}}'

assert_silent "tool_name=Edit는 통과" \
  '{"tool_name": "Edit", "tool_input": {"new_string": "claude-sonnet-4-5"}}'

assert_silent "tool_name=Bash는 통과" \
  '{"tool_name": "Bash", "tool_input": {"command": "echo claude-sonnet-4-5"}}'

assert_silent "tool_name=Task + 깨끗한 prompt는 통과" \
  '{"tool_name": "Task", "tool_input": {"prompt": "explore the repo and report findings"}}'

# === B. JSON 비정상 비차단 보장 ===
assert_silent "빈 stdin은 비차단" ""
assert_silent "tool_name 누락" '{"tool_input": {"prompt": "sonnet-4-5"}}'
assert_silent "tool_input 누락 (Task)" '{"tool_name": "Task"}'
assert_silent "tool_input.prompt 누락 (Task)" '{"tool_name": "Task", "tool_input": {"subagent_type": "general-purpose"}}'

# === C. prompt sonnet-4-5 매칭 deny ===
assert_decision "prompt 'claude-sonnet-4-5' deny" \
  '{"tool_name":"Task","tool_input":{"prompt":"please use claude-sonnet-4-5 model"}}' \
  "deny"

assert_decision "prompt 'sonnet-4-5' deny" \
  '{"tool_name":"Task","tool_input":{"prompt":"spawn agent with sonnet-4-5"}}' \
  "deny"

assert_decision "prompt 'Sonnet-4-5' (case 변형) deny" \
  '{"tool_name":"Task","tool_input":{"prompt":"Sonnet-4-5 should be used"}}' \
  "deny"

assert_decision "prompt 'SONNET-4-5' (전 대문자) deny" \
  '{"tool_name":"Task","tool_input":{"prompt":"USE SONNET-4-5 NOW"}}' \
  "deny"

assert_decision "prompt 'claude-sonnet-4-5-20250929' (full date ID) deny" \
  '{"tool_name":"Task","tool_input":{"prompt":"model: claude-sonnet-4-5-20250929"}}' \
  "deny"

assert_decision "prompt 'sonnet-4.5' (dot 표기) deny" \
  '{"tool_name":"Task","tool_input":{"prompt":"upgrade to sonnet-4.5"}}' \
  "deny"

# === D. tool_input.model 매칭 deny ===
assert_decision "model='claude-sonnet-4-5' deny" \
  '{"tool_name":"Task","tool_input":{"prompt":"clean prompt","model":"claude-sonnet-4-5"}}' \
  "deny"

assert_decision "model='claude-sonnet-4-5-20250929' deny" \
  '{"tool_name":"Task","tool_input":{"prompt":"clean prompt","model":"claude-sonnet-4-5-20250929"}}' \
  "deny"

# === E. False positive 회피 ===
assert_silent "prompt 'haiku-4-5' 통과 (Haiku 4.5 검색 카논)" \
  '{"tool_name":"Task","tool_input":{"prompt":"use haiku-4-5 for quick search"}}'

assert_silent "prompt 'sonnet-4-6' 통과 (4.6 카논)" \
  '{"tool_name":"Task","tool_input":{"prompt":"please spawn claude-sonnet-4-6"}}'

assert_silent "prompt 'opus-4-7' 통과 (Opus 4.7)" \
  '{"tool_name":"Task","tool_input":{"prompt":"use claude-opus-4-7 for security"}}'

assert_silent "prompt 'version 4.5 of unrelated thing' 통과 (sonnet 미언급)" \
  '{"tool_name":"Task","tool_input":{"prompt":"version 4.5 of postgres has new features"}}'

assert_silent "prompt 단순 'sonnet' 통과 (버전 명시 없음)" \
  '{"tool_name":"Task","tool_input":{"prompt":"use sonnet model"}}'

assert_silent "model='claude-haiku-4-5' 통과" \
  '{"tool_name":"Task","tool_input":{"prompt":"clean","model":"claude-haiku-4-5"}}'

assert_silent "model='claude-sonnet-4-6' 통과" \
  '{"tool_name":"Task","tool_input":{"prompt":"clean","model":"claude-sonnet-4-6"}}'

# === F. ENV 환경 토글 (긴급 비활성) ===
violation_input='{"tool_name":"Task","tool_input":{"prompt":"use claude-sonnet-4-5"}}'
disable_output=$(printf '%s' "$violation_input" | COMPOUND_MMP_MODEL_GUARD_DISABLE=1 bash "$HOOK" 2>/dev/null || true)
if [ -z "$disable_output" ]; then
  PASS=$((PASS+1))
  if [ "$VERBOSE" = "verbose" ]; then
    echo "PASS: COMPOUND_MMP_MODEL_GUARD_DISABLE=1 비활성화"
  fi
else
  FAIL=$((FAIL+1))
  echo "FAIL: COMPOUND_MMP_MODEL_GUARD_DISABLE=1 비활성화"
  echo "  expected: silent"
  echo "  actual:   $disable_output"
fi

# === G. deny reason 메시지 검증 (4.6 안내 + 우회 토글 명시) ===
deny_input='{"tool_name":"Task","tool_input":{"prompt":"use claude-sonnet-4-5"}}'
deny_output=$(printf '%s' "$deny_input" | bash "$HOOK" 2>/dev/null || true)
deny_reason=$(printf '%s' "$deny_output" | jq -r '.hookSpecificOutput.permissionDecisionReason // empty' 2>/dev/null || echo "")
if printf '%s' "$deny_reason" | grep -q "4.6\|4-6" && printf '%s' "$deny_reason" | grep -q "COMPOUND_MMP_MODEL_GUARD_DISABLE"; then
  PASS=$((PASS+1))
  if [ "$VERBOSE" = "verbose" ]; then
    echo "PASS: deny reason 메시지 형식"
  fi
else
  FAIL=$((FAIL+1))
  echo "FAIL: deny reason 메시지 형식 (4.6 안내 + 우회 토글 누락)"
  echo "  reason: $deny_reason"
fi

# === Summary ===
echo
echo "=========================================="
TOTAL=$((PASS+FAIL))
if [ "$FAIL" -gt 0 ]; then
  RATE=$((PASS*100/TOTAL))
  echo "Pass: $PASS, Fail: $FAIL (${RATE}% fixture pass rate) — review failing cases"
  exit 1
else
  echo "Pass: $PASS, Fail: $FAIL (100% fixture pass rate, $PASS/$TOTAL cases)"
  exit 0
fi
