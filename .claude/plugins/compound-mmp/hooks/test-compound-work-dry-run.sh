#!/usr/bin/env bash
# compound-work-dry-run.sh 테스트 fixture.
# 카논: plan § /compound-work 사양 + plan § TDD 강제 + memory/feedback_sonnet_46_default.md
#
# 단계 시퀀스 출력 검증:
#   {worktree, tdd_skill, executor, post_test, mandatory_slots}

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN="${SCRIPT_DIR}/scripts/compound-work-dry-run.sh"

PASS=0
FAIL=0
VERBOSE="${1:-}"

# 임시 phase 디렉토리 (fixture 격리)
TMP_PHASE=$(mktemp -d)
mkdir -p "$TMP_PHASE/refs"
echo "# fixture phase" > "$TMP_PHASE/checklist.md"
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

ENV_OK="ACTIVE_PHASE='$TMP_PHASE' SCOPE='go' BASE_BRANCH='main'"

# === 입력 검증 (pr-id 화이트리스트 ^PR-[0-9]+[a-z]?$) ===
run_test "pr-id 누락 시 거부" \
  "$ENV_OK bash '$DRY_RUN'" \
  "2" ""

run_test "pr-id 빈 문자열 거부" \
  "$ENV_OK bash '$DRY_RUN' ''" \
  "2" ""

run_test "pr-id 잘못된 형식 거부 (소문자만)" \
  "$ENV_OK bash '$DRY_RUN' 'pr-1'" \
  "2" ""

run_test "pr-id shell injection 거부" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1; rm -rf /'" \
  "2" ""

run_test "pr-id command sub 거부" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1\$(whoami)'" \
  "2" ""

run_test "pr-id 너무 긴 숫자 (정상 범위 내)" \
  "$ENV_OK bash '$DRY_RUN' 'PR-99999'" \
  "0" ""

# === 정상 입력 ===
run_test "유효 pr-id PR-1 → exit 0" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" ""

run_test "유효 pr-id PR-2c (alphabetic suffix) → exit 0" \
  "$ENV_OK bash '$DRY_RUN' 'PR-2c'" \
  "0" ""

# === JSON contract ===
run_test "출력은 JSON object — jq parsable" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e 'type == \"object\"' >/dev/null"

run_test "출력에 .pr_id 필드 보존" \
  "$ENV_OK bash '$DRY_RUN' 'PR-42'" \
  "0" "jq -e '.pr_id == \"PR-42\"' >/dev/null"

run_test "출력에 .worktree 필드" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.worktree | type == \"object\"' >/dev/null"

run_test "출력에 .tdd_skill 필드" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e 'has(\"tdd_skill\")' >/dev/null"

run_test "출력에 .executor 필드" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.executor | type == \"object\"' >/dev/null"

run_test "출력에 .post_test 필드" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e 'has(\"post_test\")' >/dev/null"

# === worktree step (superpowers:using-git-worktrees) ===
run_test "worktree.skill = superpowers:using-git-worktrees" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.worktree.skill == \"superpowers:using-git-worktrees\"' >/dev/null"

run_test "worktree.base = BASE_BRANCH (env)" \
  "ACTIVE_PHASE='$TMP_PHASE' SCOPE='go' BASE_BRANCH='develop' bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.worktree.base == \"develop\"' >/dev/null"

run_test "worktree.branch에 pr-id 포함" \
  "$ENV_OK bash '$DRY_RUN' 'PR-7'" \
  "0" "jq -e '.worktree.branch | contains(\"PR-7\")' >/dev/null"

# === TDD skill 매핑 (file-type 감지) ===
run_test "SCOPE=go → tdd-mmp-go" \
  "ACTIVE_PHASE='$TMP_PHASE' SCOPE='go' BASE_BRANCH='main' bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.tdd_skill == \"compound-mmp:tdd-mmp-go\"' >/dev/null"

run_test "SCOPE=react → tdd-mmp-react" \
  "ACTIVE_PHASE='$TMP_PHASE' SCOPE='react' BASE_BRANCH='main' bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.tdd_skill == \"compound-mmp:tdd-mmp-react\"' >/dev/null"

run_test "SCOPE 잘못된 값 거부 (화이트리스트 외)" \
  "ACTIVE_PHASE='$TMP_PHASE' SCOPE='ruby' BASE_BRANCH='main' bash '$DRY_RUN' 'PR-1'" \
  "2" ""

# === executor (Sonnet 4.6 카논) ===
run_test "executor.subagent_type = oh-my-claudecode:executor" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.executor.subagent_type == \"oh-my-claudecode:executor\"' >/dev/null"

run_test "executor.model = claude-sonnet-4-6 (4.5 차단 카논)" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.executor.model == \"claude-sonnet-4-6\"' >/dev/null"

run_test "executor.model에 sonnet-4-5 포함 X (PreToolUse hook과 정합)" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '[.executor.model | test(\"sonnet-4[-.]5\"; \"i\")] | any | not' >/dev/null"

# === post_test (자동 테스트 명령) ===
run_test "SCOPE=go → post_test 'go test -race'" \
  "ACTIVE_PHASE='$TMP_PHASE' SCOPE='go' BASE_BRANCH='main' bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.post_test | contains(\"go test -race\")' >/dev/null"

run_test "SCOPE=react → post_test 'pnpm --filter web test'" \
  "ACTIVE_PHASE='$TMP_PHASE' SCOPE='react' BASE_BRANCH='main' bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.post_test | contains(\"pnpm --filter web test\")' >/dev/null"

# === 자동 머지 금지 카논 ===
run_test "출력에 admin-merge/auto-merge 토큰 없음 (자동 머지 X)" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '[.. | strings | test(\"admin-merge|auto-merge|gh pr merge\"; \"i\")] | any | not' >/dev/null"

# === mandatory_slots 메타 (M-N1: sister 카논 어휘 통일) ===
run_test ".mandatory_slots 필드 존재" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.mandatory_slots | type == \"array\"' >/dev/null"

run_test "mandatory_slots에 tdd-test-first 포함 (TDD soft ask anchor)" \
  "$ENV_OK bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.mandatory_slots | contains([\"tdd-test-first\"])' >/dev/null"

# === 환경 변수 검증 ===
run_test "ACTIVE_PHASE 미설정 시 거부" \
  "SCOPE='go' BASE_BRANCH='main' bash '$DRY_RUN' 'PR-1'" \
  "3" ""

run_test "ACTIVE_PHASE 디렉토리 부재 시 거부" \
  "ACTIVE_PHASE='/tmp/missing-$$' SCOPE='go' BASE_BRANCH='main' bash '$DRY_RUN' 'PR-1'" \
  "3" ""

run_test "BASE_BRANCH 미설정 시 default 'main'" \
  "ACTIVE_PHASE='$TMP_PHASE' SCOPE='go' bash '$DRY_RUN' 'PR-1'" \
  "0" "jq -e '.worktree.base == \"main\"' >/dev/null"

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
