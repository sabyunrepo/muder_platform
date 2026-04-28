#!/usr/bin/env bash
# compound-plan-dry-run.sh 테스트 fixture.
# 카논: plan § /compound-plan 사양 + Appendix A.7 (qmd-recall) + templates/plan-draft-template.md

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN="${SCRIPT_DIR}/scripts/compound-plan-dry-run.sh"
TEMPLATE="${SCRIPT_DIR}/templates/plan-draft-template.md"

PASS=0
FAIL=0
VERBOSE="${1:-}"

# 임시 template (실제 templates/plan-draft-template.md 부재 시 fixture 격리)
TMP_TEMPLATE=$(mktemp)
echo "# fixture template — {topic} {date}" > "$TMP_TEMPLATE"
TMP_OUTPUT_BASE=$(mktemp -d)
trap 'rm -f "$TMP_TEMPLATE"; rm -rf "$TMP_OUTPUT_BASE"' EXIT

run_test() {
  local description="$1"
  local cmd="$2"
  local expected_exit="$3"
  local stdout_predicate="$4"

  local actual_stdout actual_exit
  actual_stdout=$(eval "$cmd" 2>/dev/null) && actual_exit=0 || actual_exit=$?

  local pass=1
  if [ "$actual_exit" != "$expected_exit" ]; then pass=0; fi
  if [ -n "$stdout_predicate" ] && ! eval "$stdout_predicate" <<<"$actual_stdout" >/dev/null 2>&1; then
    pass=0
  fi

  if [ $pass -eq 1 ]; then
    PASS=$((PASS+1))
    [ "$VERBOSE" = "verbose" ] && echo "PASS: $description"
  else
    FAIL=$((FAIL+1))
    echo "FAIL: $description"
    echo "  cmd:       $cmd"
    echo "  exp exit:  $expected_exit, actual: $actual_exit"
    echo "  predicate: $stdout_predicate"
    echo "  stdout:    $actual_stdout"
  fi
  return 0
}

ENV_OK="TEMPLATE_PATH='$TMP_TEMPLATE' OUTPUT_BASE='$TMP_OUTPUT_BASE' DATE='2026-04-28'"

# === 입력 검증 (화이트리스트 ^[a-z0-9-]{1,64}$) ===
run_test "topic 누락 시 거부" \
  "$ENV_OK bash '$DRY_RUN'" \
  "2" ""

run_test "topic 빈 문자열 거부" \
  "$ENV_OK bash '$DRY_RUN' ''" \
  "2" ""

run_test "topic 공백 포함 거부" \
  "$ENV_OK bash '$DRY_RUN' 'foo bar'" \
  "2" ""

run_test "topic 대문자 거부 (소문자 슬러그만)" \
  "$ENV_OK bash '$DRY_RUN' 'FooBar'" \
  "2" ""

run_test "topic shell injection 거부 (세미콜론)" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20; rm -rf /'" \
  "2" ""

run_test "topic command substitution 거부 (\$())" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20\$(whoami)'" \
  "2" ""

run_test "topic 길이 초과 거부 (>64 chars)" \
  "$ENV_OK bash '$DRY_RUN' '$(printf 'a%.0s' {1..65})'" \
  "2" ""

run_test "--from 잘못된 형식 거부 (대문자)" \
  "$ENV_OK bash '$DRY_RUN' 'phase-21' '--from' 'Phase-20'" \
  "2" ""

# === 정상 입력 ===
run_test "유효 topic phase-20-clue-editor → exit 0" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20-clue-editor'" \
  "0" ""

run_test "유효 topic 단일 단어 → exit 0" \
  "$ENV_OK bash '$DRY_RUN' 'auth'" \
  "0" ""

run_test "유효 topic 64자 경계 → exit 0" \
  "$ENV_OK bash '$DRY_RUN' '$(printf 'a%.0s' {1..64})'" \
  "0" ""

run_test "--from 유효 phase 지정 → exit 0" \
  "$ENV_OK bash '$DRY_RUN' 'phase-21' '--from' 'phase-20-clue-editor'" \
  "0" ""

# === JSON contract ===
run_test "출력은 JSON object — jq parsable" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e 'type == \"object\"' >/dev/null"

run_test "출력에 .topic 필드 존재" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e 'has(\"topic\")' >/dev/null"

run_test "출력 .topic 값이 입력과 일치" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20-test'" \
  "0" "jq -e '.topic == \"phase-20-test\"' >/dev/null"

run_test "출력에 .steps array 존재" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps | type == \"array\"' >/dev/null"

run_test ".steps length == 4 (qmd-recall→brainstorm→write-plans→write_file)" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps | length == 4' >/dev/null"

# === 단계 매핑 (plan § /compound-plan 사양) ===
run_test "step 1 = compound-mmp:qmd-recall" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps[0].skill == \"compound-mmp:qmd-recall\"' >/dev/null"

run_test "step 1 args.collection == mmp-plans" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps[0].args.collection == \"mmp-plans\"' >/dev/null"

run_test "step 1 args.k == 5 (Plan § 사양 \"유사 phase 5건\")" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps[0].args.k == 5' >/dev/null"

run_test "step 2 = superpowers:brainstorming" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps[1].skill == \"superpowers:brainstorming\"' >/dev/null"

run_test "step 3 = superpowers:writing-plans" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps[2].skill == \"superpowers:writing-plans\"' >/dev/null"

run_test "step 4 = write_file action (자동 PR X 카논)" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps[3].action == \"write_file\"' >/dev/null"

# === 토큰 치환 (path = docs/plans/{date}-{topic}/checklist.md) ===
run_test "{topic} 토큰 치환됨 (path에 topic 포함)" \
  "$ENV_OK bash '$DRY_RUN' 'unique-topic-xyz'" \
  "0" "jq -e '.steps[3].path | contains(\"unique-topic-xyz\")' >/dev/null"

run_test "{date} 토큰 치환됨 (path에 YYYY-MM-DD)" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps[3].path | contains(\"2026-04-28\")' >/dev/null"

run_test "치환된 path에 raw {topic} placeholder 없음" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps[3].path | test(\"\\\\{topic\\\\}\") | not' >/dev/null"

run_test "치환된 path에 raw {date} placeholder 없음" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps[3].path | test(\"\\\\{date\\\\}\") | not' >/dev/null"

run_test "path 가 docs/plans/ prefix (default OUTPUT_BASE)" \
  "TEMPLATE_PATH='$TMP_TEMPLATE' DATE='2026-04-28' bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps[3].path | startswith(\"docs/plans/\")' >/dev/null"

run_test "path 가 /checklist.md suffix" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '.steps[3].path | endswith(\"/checklist.md\")' >/dev/null"

# === --from 옵션 ===
run_test "--from 미지정 시 .from_previous_phase == null" \
  "$ENV_OK bash '$DRY_RUN' 'phase-21'" \
  "0" "jq -e '.from_previous_phase == null' >/dev/null"

run_test "--from 지정 시 .from_previous_phase 보존" \
  "$ENV_OK bash '$DRY_RUN' 'phase-21' '--from' 'phase-20-test'" \
  "0" "jq -e '.from_previous_phase == \"phase-20-test\"' >/dev/null"

# === 자동 PR 금지 카논 (anti-pattern 검증) ===
run_test "출력에 git/PR 관련 step 없음 (자동 진행 X)" \
  "$ENV_OK bash '$DRY_RUN' 'phase-20'" \
  "0" "jq -e '[.steps[] | (.action // .skill // \"\") | test(\"git|gh|pr-create|merge\"; \"i\")] | any | not' >/dev/null"

# === 환경 변수 검증 ===
run_test "TEMPLATE_PATH 미설정 시 거부" \
  "OUTPUT_BASE='$TMP_OUTPUT_BASE' DATE='2026-04-28' bash '$DRY_RUN' 'phase-20'" \
  "3" ""

run_test "TEMPLATE_PATH 존재하지 않는 파일이면 거부" \
  "TEMPLATE_PATH='/tmp/missing-$$.md' OUTPUT_BASE='$TMP_OUTPUT_BASE' DATE='2026-04-28' bash '$DRY_RUN' 'phase-20'" \
  "4" ""

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
