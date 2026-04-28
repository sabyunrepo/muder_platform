#!/usr/bin/env bash
# pre-edit-size-check.sh 테스트 fixture.
# 카논: refs/tdd-enforcement.md + memory/feedback_file_size_limit.md

set -eu

HOOK="$(dirname "$0")/pre-edit-size-check.sh"
VERBOSE="${1:-}"
PASS=0
FAIL=0
FIXTURE_DIR=""

# CLAUDE_PROJECT_DIR을 가짜 root로 설정 (CLAUDE.md scope test).
# hook은 file_path가 "$CLAUDE_PROJECT_DIR/CLAUDE.md"인 경우만 200 적용.
export CLAUDE_PROJECT_DIR="/repo"

cleanup() {
  if [ -n "$FIXTURE_DIR" ] && [ -d "$FIXTURE_DIR" ]; then
    rm -rf "$FIXTURE_DIR"
  fi
  return 0
}
trap cleanup EXIT

FIXTURE_DIR=$(mktemp -d)

# 줄수 N으로 content 생성 (각 라인 = "line $i\n")
make_content() {
  local n="$1"
  local i=0
  local out=""
  while [ "$i" -lt "$n" ]; do
    out="${out}line ${i}"$'\n'
    i=$((i+1))
  done
  printf '%s' "$out"
}

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

# === A. 무관한 tool ===
assert_silent "tool_name=Read는 통과" \
  '{"tool_name": "Read", "tool_input": {"file_path": "/tmp/x.go"}}'
assert_silent "tool_name=Bash는 통과" \
  '{"tool_name": "Bash", "tool_input": {}}'

# === B. JSON 비정상 (비차단 보장) ===
assert_silent "빈 stdin은 비차단" ""
assert_silent "tool_input 누락" '{"tool_name": "Write"}'
assert_silent "file_path 누락" '{"tool_name": "Write", "tool_input": {"content": "x"}}'

# === C. 자동 통과 예외 패턴 (size 검사 자체 스킵) ===
big_content=$(make_content 600)

assert_silent "_test.go 자체 신규는 통과" \
  "$(jq -nc --arg c "$big_content" --arg fp "/repo/foo_test.go" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

assert_silent "_mock.go 자동 생성 통과" \
  "$(jq -nc --arg c "$big_content" --arg fp "/repo/bar_mock.go" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

assert_silent "_gen.go 자동 생성 통과" \
  "$(jq -nc --arg c "$big_content" --arg fp "/repo/baz_gen.go" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

assert_silent "*sqlc.go 자동 생성 통과 (review test P1)" \
  "$(jq -nc --arg c "$big_content" --arg fp "/repo/internal/db/queriessqlc.go" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

assert_silent "*.pb.go 자동 생성 통과" \
  "$(jq -nc --arg c "$big_content" --arg fp "/repo/proto/api.pb.go" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

assert_silent "apps/server/cmd entrypoint 통과" \
  "$(jq -nc --arg c "$big_content" --arg fp "/repo/apps/server/cmd/server/main.go" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

assert_silent "apps/web/src/types 통과" \
  "$(jq -nc --arg c "$big_content" --arg fp "/repo/apps/web/src/types/index.ts" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

assert_silent "apps/web/src/constants 통과" \
  "$(jq -nc --arg c "$big_content" --arg fp "/repo/apps/web/src/constants/foo.ts" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

assert_silent "migrations 통과" \
  "$(jq -nc --arg c "$big_content" --arg fp "/repo/migrations/0001_init.sql" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

assert_silent "*.sql 통과" \
  "$(jq -nc --arg c "$big_content" --arg fp "/repo/queries/users.sql" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

# === D. 사이즈 deny (Write 신규) ===
go_510=$(make_content 510)
assert_decision "Go 510줄은 deny" \
  "$(jq -nc --arg c "$go_510" --arg fp "/repo/foo.go" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')" \
  "deny"

# Go 499줄 + 같은 디렉토리에 _test.go 미리 둠 → size·TDD 모두 통과
test_dir_499="${FIXTURE_DIR}/dir499"
mkdir -p "$test_dir_499"
touch "${test_dir_499}/sibling_test.go"
go_499=$(make_content 499)
assert_silent "Go 499줄 + _test.go 존재 → 통과" \
  "$(jq -nc --arg c "$go_499" --arg fp "${test_dir_499}/foo499.go" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

tsx_410=$(make_content 410)
assert_decision "TSX 410줄은 deny" \
  "$(jq -nc --arg c "$tsx_410" --arg fp "/repo/apps/web/src/components/Foo.tsx" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')" \
  "deny"

ts_410=$(make_content 410)
assert_decision "TS 410줄은 deny" \
  "$(jq -nc --arg c "$ts_410" --arg fp "/repo/apps/web/src/utils/foo.ts" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')" \
  "deny"

# .ts ≤ 400은 explicit silent — review test P2 #1
ts_399_dir="${FIXTURE_DIR}/ts399"
mkdir -p "$ts_399_dir"
touch "${ts_399_dir}/foo.test.ts"   # test fallback 자동 통과 패턴은 *.test.ts
ts_399=$(make_content 399)
assert_silent "TS 399줄 (한도 이하) → 통과" \
  "$(jq -nc --arg c "$ts_399" --arg fp "/repo/apps/web/src/utils/safe.ts" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

md_510=$(make_content 510)
assert_decision "MD 510줄은 deny" \
  "$(jq -nc --arg c "$md_510" --arg fp "/repo/docs/plans/foo.md" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')" \
  "deny"

md_499=$(make_content 499)
assert_silent "MD 499줄은 통과" \
  "$(jq -nc --arg c "$md_499" --arg fp "/repo/docs/plans/foo.md" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

# === D-2. CLAUDE.md scope (review critic P1 #1) ===
# repo root CLAUDE.md만 200 한도, nested CLAUDE.md는 .md 500 fallthrough.
claude_md_210=$(make_content 210)
assert_decision "root CLAUDE.md 210줄은 deny (CLAUDE_PROJECT_DIR root)" \
  "$(jq -nc --arg c "$claude_md_210" --arg fp "/repo/CLAUDE.md" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')" \
  "deny"

claude_md_199=$(make_content 199)
assert_silent "root CLAUDE.md 199줄은 통과" \
  "$(jq -nc --arg c "$claude_md_199" --arg fp "/repo/CLAUDE.md" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

# nested CLAUDE.md (apps/server/CLAUDE.md 등): 200 한도 미적용, .md 500 적용
nested_claude_210=$(make_content 210)
assert_silent "nested apps/server/CLAUDE.md 210줄은 통과 (.md 500 fallthrough)" \
  "$(jq -nc --arg c "$nested_claude_210" --arg fp "/repo/apps/server/CLAUDE.md" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

nested_claude_510=$(make_content 510)
assert_decision "nested apps/server/CLAUDE.md 510줄은 deny (.md 500)" \
  "$(jq -nc --arg c "$nested_claude_510" --arg fp "/repo/apps/web/CLAUDE.md" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')" \
  "deny"

# === E. 사이즈 deny (Edit) — 실 fixture 파일 ===
existing_go="${FIXTURE_DIR}/existing.go"
make_content 200 > "$existing_go"
new_chunk=$(make_content 350)
old_chunk=$(make_content 40)
# 200 + 350 - 40 = 510 → deny
assert_decision "Edit 후 510줄 → deny" \
  "$(jq -nc --arg ns "$new_chunk" --arg os "$old_chunk" --arg fp "$existing_go" '{tool_name:"Edit",tool_input:{file_path:$fp,new_string:$ns,old_string:$os}}')" \
  "deny"

new_chunk_small=$(make_content 90)
old_chunk_small=$(make_content 40)
# 200 + 90 - 40 = 250 → silent (Edit이므로 TDD ask 미발동)
assert_silent "Edit 후 250줄 → 통과 (TDD ask 미발동)" \
  "$(jq -nc --arg ns "$new_chunk_small" --arg os "$old_chunk_small" --arg fp "$existing_go" '{tool_name:"Edit",tool_input:{file_path:$fp,new_string:$ns,old_string:$os}}')"

# === E-2. replace_all 가드 (review critic P1 #2) ===
# replace_all=true && new_lines > old_lines → 보수적 deny
ns_long=$(make_content 50)
os_short=$(make_content 1)
assert_decision "Edit replace_all=true & new>old → deny (다중 occurrence 우회 차단)" \
  "$(jq -nc --arg ns "$ns_long" --arg os "$os_short" --arg fp "$existing_go" '{tool_name:"Edit",tool_input:{file_path:$fp,new_string:$ns,old_string:$os,replace_all:true}}')" \
  "deny"

# replace_all=true && new <= old → 정상 size 검사 (감소이므로 통과)
ns_short=$(make_content 5)
os_long=$(make_content 30)
assert_silent "Edit replace_all=true & new<=old → 정상 (size 감소)" \
  "$(jq -nc --arg ns "$ns_short" --arg os "$os_long" --arg fp "$existing_go" '{tool_name:"Edit",tool_input:{file_path:$fp,new_string:$ns,old_string:$os,replace_all:true}}')"

# replace_all=false (기본) + new>old → 정상 size 검사 (한도 내라서 silent)
assert_silent "Edit replace_all=false & new>old & 한도 내 → 통과 (정상 추정)" \
  "$(jq -nc --arg ns "$ns_long" --arg os "$os_short" --arg fp "$existing_go" '{tool_name:"Edit",tool_input:{file_path:$fp,new_string:$ns,old_string:$os,replace_all:false}}')"

# === F. TDD soft ask (Write 신규 파일 + .go/.tsx만) ===
# F1: 신규 .go (동일 디렉토리 _test.go 부재) → ask
no_test_dir="${FIXTURE_DIR}/no_test"
mkdir -p "$no_test_dir"
small_go=$(make_content 100)
assert_decision "신규 Go (test 부재) → ask" \
  "$(jq -nc --arg c "$small_go" --arg fp "${no_test_dir}/handler.go" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')" \
  "ask"

# F2: 신규 .go (동일 디렉토리 다른 *_test.go 존재) → 통과
has_test_dir="${FIXTURE_DIR}/has_test"
mkdir -p "$has_test_dir"
touch "${has_test_dir}/other_test.go"
assert_silent "신규 Go (sibling _test.go 존재) → 통과" \
  "$(jq -nc --arg c "$small_go" --arg fp "${has_test_dir}/handler.go" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

# F3: 신규 .tsx (test 부재) → ask
no_tsx_test_dir="${FIXTURE_DIR}/no_tsx"
mkdir -p "$no_tsx_test_dir"
small_tsx=$(make_content 100)
assert_decision "신규 TSX (test 부재) → ask" \
  "$(jq -nc --arg c "$small_tsx" --arg fp "${no_tsx_test_dir}/Button.tsx" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')" \
  "ask"

# F4: 신규 .tsx (동일 디렉토리 Button.test.tsx 존재) → 통과
has_tsx_test_dir="${FIXTURE_DIR}/has_tsx_test"
mkdir -p "$has_tsx_test_dir"
touch "${has_tsx_test_dir}/Button.test.tsx"
assert_silent "신규 TSX (Button.test.tsx 존재) → 통과" \
  "$(jq -nc --arg c "$small_tsx" --arg fp "${has_tsx_test_dir}/Button.tsx" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

# F5: 신규 .tsx (__tests__/Card.test.tsx 존재 — 동일 디렉토리 하위) → 통과
under_tests_dir="${FIXTURE_DIR}/under_tests"
mkdir -p "$under_tests_dir/__tests__"
touch "${under_tests_dir}/__tests__/Card.test.tsx"
assert_silent "신규 TSX (__tests__/Card.test.tsx 존재) → 통과" \
  "$(jq -nc --arg c "$small_tsx" --arg fp "${under_tests_dir}/Card.tsx" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

# F6: 신규 .tsx (parent __tests__/Widget.test.tsx 존재 — review test P1) → 통과
parent_tests_dir="${FIXTURE_DIR}/parent_tests"
mkdir -p "${parent_tests_dir}/__tests__"
mkdir -p "${parent_tests_dir}/Widget"
touch "${parent_tests_dir}/__tests__/Widget.test.tsx"
assert_silent "신규 TSX (parent __tests__/Widget.test.tsx 존재 — legacy) → 통과" \
  "$(jq -nc --arg c "$small_tsx" --arg fp "${parent_tests_dir}/Widget/Widget.tsx" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')"

# === G. ENV var 환경 토글 (긴급 비활성) ===
big_go=$(make_content 600)
disable_input=$(jq -nc --arg c "$big_go" --arg fp "/repo/forced.go" '{tool_name:"Write",tool_input:{file_path:$fp,content:$c}}')
disable_output=$(printf '%s' "$disable_input" | COMPOUND_MMP_SIZE_HOOK_DISABLE=1 bash "$HOOK" 2>/dev/null || true)
if [ -z "$disable_output" ]; then
  PASS=$((PASS+1))
  if [ "$VERBOSE" = "verbose" ]; then
    echo "PASS: COMPOUND_MMP_SIZE_HOOK_DISABLE=1 비활성화"
  fi
else
  FAIL=$((FAIL+1))
  echo "FAIL: COMPOUND_MMP_SIZE_HOOK_DISABLE=1 비활성화"
  echo "  expected: silent"
  echo "  actual:   $disable_output"
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
