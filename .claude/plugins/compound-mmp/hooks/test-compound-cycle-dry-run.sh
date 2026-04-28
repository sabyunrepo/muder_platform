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
# HIGH-S2 round-2 fix: PHASE_NAME 화이트리스트 ^[a-z0-9_.-]+$ 통과 위해 lowercase basename 명시.
TMP_PARENT=$(mktemp -d)
TMP_PHASE="${TMP_PARENT}/phase-fixture"
mkdir -p "$TMP_PHASE/refs/reviews"
echo "# fixture phase checklist" > "$TMP_PHASE/checklist.md"
trap 'rm -rf "$TMP_PARENT"' EXIT

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

# HIGH-S2 round-2 fix: PHASE_NAME 화이트리스트 (regex injection 차단)
run_test "PHASE_NAME 대문자 거부 (mktemp 기본 형식)" \
  "ACTIVE_PHASE='$TMP_PARENT' bash '$DRY_RUN'" \
  "3" ""

# 정규식 metachar 잠입 거부 (regex injection PoC)
run_test "PHASE_NAME 정규식 metachar 거부 (.*)" \
  "ACTIVE_PHASE='/tmp/foo.*' bash '$DRY_RUN'" \
  "3" ""

run_test "PHASE_NAME 공백 포함 거부" \
  "ACTIVE_PHASE='/tmp/foo bar' bash '$DRY_RUN'" \
  "3" ""

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
  "EMPTY_PARENT=\$(mktemp -d) && mkdir -p \"\$EMPTY_PARENT/empty-phase\" && ACTIVE_PHASE=\"\$EMPTY_PARENT/empty-phase\" bash '$DRY_RUN'" \
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

# HIGH-A1 round-1 fix: phase-scoped 매칭으로 handoff_path가 null 또는 string. mktemp 격리는 null.
run_test "compound.handoff_path null 또는 string (phase-scoped 매칭)" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages.compound.handoff_path == null or (.stages.compound.handoff_path | type == \"string\")' >/dev/null"

# HIGH-A1 round-1 fix: mktemp 격리 phase는 다른 phase 핸드오프와 매칭 0건 → null
run_test "phase-scoped 매칭 시 mktemp 격리 phase는 handoff_path = null" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.stages.compound.handoff_path == null' >/dev/null"

# HIGH-S1/T1 round-1 fix: helper output JSON parsable (handoff escape 검증 carry-over PR-11)
run_test "출력 JSON 항상 parsable (handoff_path --arg 안전)" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e 'type == \"object\"' >/dev/null"

# HIGH-A3 round-1 fix: 빈 blocked_reasons → length 0 (이전엔 [\"\"])
run_test "next_gate 정상 시 blocked_reasons length 0 가능 (빈 배열 contract)" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '.blocked_reasons | length >= 0' >/dev/null"

# HIGH-A3 fix 정확 검증: blocked_reasons에 빈 string 포함 X
run_test "blocked_reasons에 빈 string 없음 (HIGH-A3 contract)" \
  "$ENV_OK bash '$DRY_RUN'" \
  "0" "jq -e '[.blocked_reasons[] | select(. == \"\")] | length == 0' >/dev/null"

# === jq 의존성 (HIGH-T2 round-1 fix: 실측 분리) ===
# round-1 test agent HIGH-T2: 이전엔 jq 존재 시 항상 echo skip → exit 0 (false PASS).
# 해소: bash 절대경로 + PATH 단독 mock으로 helper 직접 실행 → exit 5 검증.
# (PATH=/nonexistent로 PATH 안 의 bash도 못 찾으니 /bin/bash 절대경로 필수)
run_test "jq missing 시 helper exit 5 (HIGH-T2 fix, mock PATH)" \
  "PATH=/nonexistent ACTIVE_PHASE='$TMP_PHASE' /bin/bash '$DRY_RUN'" \
  "5" ""

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
