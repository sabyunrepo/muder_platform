#!/usr/bin/env bash
# compound-review-dry-run.sh 테스트 fixture.
# 카논: refs/post-task-pipeline-bridge.md + refs/sim-case-a.md "한 메시지 4 Task spawn" 검증

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN="${SCRIPT_DIR}/scripts/compound-review-dry-run.sh"

PASS=0
FAIL=0
VERBOSE="${1:-}"

# 임시 design.md (실제 phase 디렉토리에 의존하지 않게 격리)
TMP_DESIGN=$(mktemp)
echo "# fixture design" > "$TMP_DESIGN"
trap 'rm -f "$TMP_DESIGN"' EXIT

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

# === 입력 검증 (화이트리스트) ===
run_test "pr-id 누락 시 거부" \
  "bash '$DRY_RUN'" \
  "2" ""

run_test "pr-id 빈 문자열 거부" \
  "bash '$DRY_RUN' ''" \
  "2" ""

run_test "pr-id 잘못된 형식 거부 (영숫자만)" \
  "bash '$DRY_RUN' 'foo bar'" \
  "2" ""

run_test "pr-id shell injection 시도 거부" \
  "bash '$DRY_RUN' 'PR-1; rm -rf /'" \
  "2" ""

run_test "pr-id 특수문자 거부" \
  "bash '$DRY_RUN' 'PR-1\$(whoami)'" \
  "2" ""

# === 정상 입력 (post-task-pipeline.json 기반) ===
run_test "유효한 pr-id PR-123 → exit 0" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test pr' bash '$DRY_RUN' PR-123" \
  "0" ""

run_test "유효한 pr-id PR-2c → exit 0" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test pr' bash '$DRY_RUN' PR-2c" \
  "0" ""

run_test "sim-case-a 같은 alphabetic id 거부 (정규식 ^PR-N+L?\$)" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' sim-case-a" \
  "2" ""

# === JSON 출력 형식 (sim-case-a C-2 계약) ===
run_test "출력은 JSON array — jq parsable" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'type == \"array\"' >/dev/null"

run_test "출력 array length == 4" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'length == 4' >/dev/null"

run_test "각 element에 subagent_type 필드 존재" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'all(.[]; has(\"subagent_type\"))' >/dev/null"

run_test "각 element에 model 필드 존재" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'all(.[]; has(\"model\"))' >/dev/null"

run_test "각 element에 prompt 필드 존재" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'all(.[]; has(\"prompt\"))' >/dev/null"

# === 4-agent 카논 매핑 (post-task-pipeline-bridge.md) ===
run_test "security-reviewer agent 포함 (opus)" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'any(.[]; .subagent_type == \"oh-my-claudecode:security-reviewer\" and .model == \"opus\")' >/dev/null"

run_test "code-reviewer agent 포함 (sonnet — perf)" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'any(.[]; .subagent_type == \"oh-my-claudecode:code-reviewer\" and .model == \"sonnet\")' >/dev/null"

run_test "critic agent 포함 (opus — arch, NOT architect)" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'any(.[]; .subagent_type == \"oh-my-claudecode:critic\" and .model == \"opus\")' >/dev/null"

run_test "test-engineer agent 포함 (sonnet)" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'any(.[]; .subagent_type == \"oh-my-claudecode:test-engineer\" and .model == \"sonnet\")' >/dev/null"

# === 토큰 치환 (shell injection 차단 검증) ===
run_test "{pr_id} 토큰 치환됨" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-42" \
  "0" "jq -e 'all(.[]; .prompt | contains(\"PR-42\"))' >/dev/null"

run_test "치환된 prompt에 raw {pr_id} placeholder 없음" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-42" \
  "0" "jq -e 'all(.[]; .prompt | test(\"\\\\{pr_id\\\\}\") | not)' >/dev/null"

run_test "PR_TITLE shell injection 시도 — literal 보존, 명령 실행 안됨" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='\$(whoami)' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'any(.[]; .prompt | contains(\"\$(whoami)\"))' >/dev/null"

# HIGH-T1: 이전 case 21 ("whoami output 누설 없음")은 \$LOGNAME 하드코딩으로 CI runner에서 false PASS.
# 위 case 20이 이미 literal preservation 검증 — injection 실행 시 `\$(whoami)` literal이 사라지고 username만 남으므로 case 20 자체가 충분 강한 검증.

# MED-T1: {pr_title}/{design} 토큰 치환도 명시 검증 (이전엔 {pr_id}만 검증 — gsub 라인 삭제 silent)
run_test "{pr_title} 토큰 치환됨" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='unique-title-xyz' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'any(.[]; .prompt | contains(\"unique-title-xyz\"))' >/dev/null"

run_test "치환된 prompt에 raw {pr_title} placeholder 없음" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='unique-title-xyz' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'all(.[]; .prompt | test(\"\\\\{pr_title\\\\}\") | not)' >/dev/null"

run_test "{design} 토큰 치환됨 (TMP_DESIGN 경로 포함)" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'any(.[]; .prompt | contains(\"$TMP_DESIGN\"))' >/dev/null"

run_test "치환된 prompt에 raw {design} placeholder 없음" \
  "DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "0" "jq -e 'all(.[]; .prompt | test(\"\\\\{design\\\\}\") | not)' >/dev/null"

# === 환경 변수 검증 ===
run_test "DESIGN_PATH 미설정 시 거부 (환경 누락)" \
  "PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "3" ""

run_test "DESIGN_PATH 존재하지 않는 파일이면 거부" \
  "DESIGN_PATH='/tmp/does-not-exist-$$.md' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
  "3" ""

# === post-task-pipeline.json 위치 ===
run_test "pipeline.json 부재 시 명확한 에러 (env override)" \
  "PIPELINE_PATH='/tmp/missing-$$.json' DESIGN_PATH='$TMP_DESIGN' PR_TITLE='test' bash '$DRY_RUN' PR-7" \
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
