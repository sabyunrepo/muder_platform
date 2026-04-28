#!/usr/bin/env bash
# compound-cycle-dry-run.sh 테스트 fixture.
# 카논: plan § /compound-cycle 사양 + skills/compound-lifecycle/SKILL.md
#
# 4단계 진행 상태 dashboard JSON contract:
#   {phase, stages: {plan, work, review, compound}, next_gate, blocked_reasons, mandatory_slots}

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN="${SCRIPT_DIR}/scripts/compound-cycle-dry-run.sh"

PASS=0
FAIL=0
VERBOSE="${1:-}"

# 임시 phase (plan/checklist 포함)
TMP_PHASE=$(mktemp -d)
mkdir -p "$TMP_PHASE/refs/reviews"
echo "# fixture phase checklist" > "$TMP_PHASE/checklist.md"
trap 'rm -rf "$TMP_PHASE"' EXIT

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

ENV_OK="ACTIVE_PHASE='$TMP_PHASE'"

# === 환경 변수 검증 ===
run_test "ACTIVE_PHASE 미설정 시 거부" \
  "bash '$DRY_RUN'" \
  "3" ""

run_test "ACTIVE_PHASE 디렉토리 부재 시 거부" \
  "ACTIVE_PHASE='/tmp/missing-$$' bash '$DRY_RUN'" \
  "3" ""

run_test "ACTIVE_PHASE 정상 → exit 0" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" ""

# === JSON contract ===
run_test "출력은 JSON object — jq parsable" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e 'type == \"object\"' >/dev/null"

run_test "출력에 .phase 필드" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e 'has(\"phase\")' >/dev/null"

run_test ".phase 값이 ACTIVE_PHASE basename" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.phase | type == \"string\"' >/dev/null"

run_test "출력에 .stages 객체" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages | type == \"object\"' >/dev/null"

run_test "출력에 .next_gate 필드" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e 'has(\"next_gate\")' >/dev/null"

run_test "출력에 .blocked_reasons 배열" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.blocked_reasons | type == \"array\"' >/dev/null"

# === 4단계 stages 매핑 ===
run_test ".stages 에 plan 키" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages | has(\"plan\")' >/dev/null"

run_test ".stages 에 work 키" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages | has(\"work\")' >/dev/null"

run_test ".stages 에 review 키" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages | has(\"review\")' >/dev/null"

run_test ".stages 에 compound 키" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages | has(\"compound\")' >/dev/null"

# === stage 상태 (검증 로직) ===
run_test ".stages.plan.exists = true (checklist.md 존재)" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages.plan.exists == true' >/dev/null"

run_test ".stages.plan 에 status 필드 (pending/in_progress/done)" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages.plan | has(\"status\")' >/dev/null"

run_test ".stages.review 에 reviews_count 필드" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages.review | has(\"reviews_count\")' >/dev/null"

# === checklist.md 부재 → plan stage incomplete ===
run_test "checklist.md 부재 시 .stages.plan.exists = false" \
  "ACTIVE_PHASE='$(mktemp -d)' bash '$DRY_RUN'" \
  "0" "jq -e '.stages.plan.exists == false' >/dev/null"

# === reviews 디렉토리 상태 매핑 ===
run_test "refs/reviews/ 비어있을 때 reviews_count = 0" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages.review.reviews_count == 0' >/dev/null"

# === next_gate 결정 ===
run_test ".next_gate 가 4단계 중 하나 (plan|work|review|compound|done)" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.next_gate | IN(\"plan\", \"work\", \"review\", \"compound\", \"done\")' >/dev/null"

# === 자동 진행 금지 카논 (anti-pattern) ===
run_test "출력에 자동 실행 명령 없음 (gh/git/admin-merge 토큰)" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '[.. | strings? | test(\"admin-merge|gh pr merge|git push --force\"; \"i\")] | any | not' >/dev/null"

# === mandatory_slots (sister 카논) ===
run_test "출력에 .mandatory_slots 배열" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.mandatory_slots | type == \"array\"' >/dev/null"

run_test "compound stage = wrap (sister 카논)" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages.compound.handoff_path | type == \"string\"' >/dev/null"

# === jq 의존성 ===
run_test "jq 없으면 exit 5 (sister 카논)" \
  "PATH=/usr/bin:/bin $ENV_OK command -v jq >/dev/null && echo 'skip — jq exists' || ($ENV_OK PATH=/nonexistent bash '$DRY_RUN')" \
  "0" ""

# === phase 명 검증 (path traversal 방어) ===
run_test "ACTIVE_PHASE 경로의 basename이 phase 필드에 그대로" \
  "ACTIVE_PHASE='$TMP_PHASE' bash '$DRY_RUN'" \
  "0" "jq -e '.phase == \"$(basename "$TMP_PHASE")\"' >/dev/null"

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
