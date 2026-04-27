#!/usr/bin/env bash
# dispatch-router.sh 테스트 fixture. PR-10 dogfooding에서 hit-rate 측정용.
# 사용법: test-dispatch.sh [verbose]
# CI에서 실행 가능 (read-only, no side effect).

set -eu

ROUTER="$(dirname "$0")/dispatch-router.sh"
VERBOSE="${1:-}"

PASS=0
FAIL=0

run_test() {
  local description="$1"
  local prompt="$2"
  local expected_stage="$3"  # "none" 또는 plan/work/review/wrap/cycle

  local input
  input=$(jq -n --arg p "$prompt" '{prompt: $p, hook_event_name: "UserPromptSubmit"}')

  local output
  output=$(echo "$input" | bash "$ROUTER" 2>/dev/null || true)

  local actual_stage
  if [ -z "$output" ]; then
    actual_stage="none"
  else
    actual_stage=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext' 2>/dev/null | grep -oE 'stage=[a-z]+' | cut -d= -f2 || echo "parse_error")
  fi

  if [ "$actual_stage" = "$expected_stage" ]; then
    PASS=$((PASS+1))
    if [ "$VERBOSE" = "verbose" ]; then
      echo "PASS: $description"
    fi
  else
    FAIL=$((FAIL+1))
    echo "FAIL: $description"
    echo "  prompt:   $prompt"
    echo "  expected: $expected_stage"
    echo "  actual:   $actual_stage"
  fi
  return 0
}

# === Wrap ===
run_test "wrap 한글 명시" "오늘은 wrap up 하자" "wrap"
run_test "wrap 한글 마무리" "이제 마무리해줘" "wrap"
run_test "wrap 한글 세션 끝" "세션 끝났어" "wrap"
run_test "wrap 영문 session end" "session end" "wrap"
run_test "wrap 영문 handoff" "create handoff note" "wrap"

# === Review ===
run_test "review 한글" "이거 리뷰 해줘" "review"
run_test "review 머지 전" "머지 전 확인" "review"
run_test "review 영문" "review this PR" "review"

# === Plan ===
run_test "plan 한글" "다음 phase 계획 세워" "plan"
run_test "plan brainstorm" "이거 어떻게 만들지 brainstorm" "plan"
run_test "plan 영문" "plan this out" "plan"

# === Work ===
run_test "work 한글" "이거 구현 해" "work"
run_test "work 영문 implement" "implement this" "work"
# wrap > work 우선순위 카논 — "wrap-up" 같은 wrap 신호가 prompt에 있으면 wrap 진입이 의도.
# work 케이스는 wrap 키워드 없는 prompt만.
run_test "work 영문 write code" "write the implementation code" "work"
run_test "work 영문 wrap에 대한 메타" "write code for the wrap-up" "wrap"  # 의도된 우선순위

# === Cycle ===
run_test "cycle 한글" "지금 어디까지 했지?" "cycle"
run_test "cycle 영문" "where am I now" "cycle"

# === None ===
run_test "일반 질문" "Go의 channel은 어떻게 동작해?" "none"
run_test "코드 설명" "이 함수 무슨 의미야?" "none"
run_test "빈 프롬프트" "" "none"

# === 슬래시 명령 (dispatch 스킵) ===
run_test "슬래시 명령" "/compound-wrap" "none"
run_test "OMC 슬래시" "/sc:implement" "none"

# === 부정문 (false positive 방지) ===
run_test "리뷰 말고" "리뷰 말고 그냥 짜줘" "none"
run_test "review skip" "review skip하고 진행" "none"
run_test "wrap 안 해" "오늘은 wrap 안 할래" "none"

# === 슬래시 명령 텍스트 안에 포함 (시작 X) ===
run_test "슬래시 인용" "/compound-wrap 뭐였더라?" "none"

echo
echo "=========================================="
echo "Pass: $PASS, Fail: $FAIL"
TOTAL=$((PASS+FAIL))
if [ "$FAIL" -gt 0 ]; then
  echo "Hit rate: $(( PASS * 100 / TOTAL ))% — review test cases"
  exit 1
else
  echo "Hit rate: 100%"
  exit 0
fi
