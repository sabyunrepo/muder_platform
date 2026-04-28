#!/usr/bin/env bash
# dispatch-router.sh 테스트 fixture. PR-10 dogfooding hit-rate 측정용.

set -eu

ROUTER="$(dirname "$0")/dispatch-router.sh"
VERBOSE="${1:-}"

PASS=0
FAIL=0

run_test() {
  local description="$1"
  local prompt="$2"
  local expected_stage="$3"

  local input
  input=$(jq -n --arg p "$prompt" '{prompt: $p, hook_event_name: "UserPromptSubmit"}')

  local output
  output=$(echo "$input" | bash "$ROUTER" 2>/dev/null || true)

  local actual_stage
  if [ -z "$output" ]; then
    actual_stage="none"
  else
    actual_stage=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext' 2>/dev/null | grep -oE 'stage=[a-z]+' | cut -d= -f2 || echo "parse_error")
    [ -z "$actual_stage" ] && actual_stage="none"
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

# === Wrap (한글/영문 동사 변형 강화) ===
run_test "wrap 한글 명시" "오늘은 wrap up 하자" "wrap"
run_test "wrap 한글 마무리" "이제 마무리해줘" "wrap"
run_test "wrap 한글 세션 끝" "세션 끝났어" "wrap"
run_test "wrap 영문 session end" "session end" "wrap"
run_test "wrap 영문 handoff" "create handoff note" "wrap"
run_test "wrap 동사 변형 하자" "wrap 하자" "wrap"
run_test "wrap 동사 변형 할게" "wrap 할게" "wrap"

# === Review (영문+한국식 부탁/요청 보강) ===
run_test "review 한글" "이거 리뷰 해줘" "review"
run_test "review 머지 전" "머지 전 확인" "review"
run_test "review 영문" "review this PR" "review"
run_test "review 영문 부탁" "PR review 부탁해" "review"
run_test "review 영문 한국식 동사" "이 코드 review해줘" "review"
run_test "review 한글 검토" "이거 검토 좀" "review"

# === HIGH-A3 카논: /compound-review 슬래시 본문 명시 phrase doc-vs-behavior align ===
# 본문 (commands/compound-review.md "디스패처 트리거" 섹션) 명시 6 phrase 모두 매칭 검증.
# 본문 변경 시 이 fixture 동기화 필수.
run_test "review 본문 phrase 1 — 리뷰 해줘"     "리뷰 해줘" "review"
run_test "review 본문 phrase 2 — 코드 리뷰"     "코드 리뷰" "review"
run_test "review 본문 phrase 3 — 머지 전 확인"  "머지 전 확인" "review"
run_test "review 본문 phrase 4 — 병합 전 체크"  "병합 전 체크" "review"
run_test "review 본문 phrase 5 — review this PR"  "review this PR" "review"
run_test "review 본문 phrase 6 — pre-merge review" "pre-merge review" "review"

# === Plan (동사 변형) ===
run_test "plan 한글" "다음 phase 계획 세워" "plan"
run_test "plan brainstorm" "이거 어떻게 만들지 brainstorm" "plan"
run_test "plan 영문" "plan this out" "plan"
run_test "plan 한글 짜다" "plan 짜고 시작하자" "plan"

# === Work ===
run_test "work 한글" "이거 구현 해" "work"
run_test "work 영문 implement" "implement this" "work"
run_test "work 영문 write code" "write the implementation code" "work"

# === Cycle ===
run_test "cycle 한글" "지금 어디까지 했지?" "cycle"
run_test "cycle 영문" "where am I now" "cycle"

# === None (일반 질문, 빈 프롬프트) ===
run_test "일반 질문" "Go의 channel은 어떻게 동작해?" "none"
run_test "코드 설명" "이 함수 무슨 의미야?" "none"
run_test "빈 프롬프트" "" "none"

# === 슬래시 명령 (dispatch 스킵, 대소문자 무관) ===
run_test "슬래시 명령 소문자" "/compound-wrap" "none"
run_test "슬래시 명령 대문자" "/Compound-wrap" "none"
run_test "OMC 슬래시 소문자" "/sc:implement" "none"
run_test "OMC 슬래시 대문자" "/SC:implement" "none"

# === OMC magic keyword (anti-pattern #8 충돌 회피) ===
run_test "OMC autopilot 명시" "autopilot 진입" "none"
run_test "OMC ralplan" "ralplan 진입" "none"
run_test "OMC ulw" "ulw mode" "none"
run_test "ralph 인물명 false positive 방어" "ralphael 좋아하는 캐릭터" "none"
run_test "ulw 어절 false positive 방어" "wfulw 어쩌고" "none"
run_test "plan 부정 안 + 양성 work" "plan 안 잡고 implement 해" "work"

# === 부정문 + 양성 시그널 재시도 ===
run_test "부정 + 양성 plan" "review 빼고 plan 세워줘" "plan"
run_test "wrap 부정" "오늘은 wrap 안 할래" "none"
run_test "코드리뷰 빼고" "코드리뷰 빼고 그냥 짜줘" "work"
run_test "코드 리뷰 빼고 plan" "코드 리뷰 빼고 plan 세워" "plan"

# === 슬래시 명령 텍스트 안에 포함 (시작 X) ===
run_test "슬래시 인용" "/compound-wrap 뭐였더라?" "none"

# === 우선순위 카논 (wrap > work) ===
run_test "wrap 우선순위 메타" "write code for the wrap-up" "wrap"

echo
echo "=========================================="
echo "Pass: $PASS, Fail: $FAIL"
TOTAL=$((PASS+FAIL))
if [ "$FAIL" -gt 0 ]; then
  echo "Hit rate: $(( PASS * 100 / TOTAL ))% — review test cases"
  exit 1
else
  echo "Hit rate: 100% ($PASS/$TOTAL cases)"
  exit 0
fi
