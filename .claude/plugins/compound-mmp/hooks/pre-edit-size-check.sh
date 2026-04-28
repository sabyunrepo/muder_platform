#!/usr/bin/env bash
# pre-edit-size-check.sh
# PreToolUse(Edit|Write) hook — 파일 사이즈 한도 + TDD soft ask 통합.
#
# 카논:
#   - 파일 한도: memory/feedback_file_size_limit.md (Go 500 / TS·TSX 400 / MD 500 · CLAUDE.md 200)
#   - TDD 정책: refs/tdd-enforcement.md (Soft ask, N 응답 진행 허용)
#   - anti-patterns #1: 자동 fix-loop 폐기 → 검사만 하고 진행 결정은 사용자에게
#
# 입력 (stdin JSON):
#   {tool_name: "Edit"|"Write",
#    tool_input: {file_path, content (Write), new_string·old_string·replace_all (Edit)}}
#
# 출력 (stdout):
#   - silent (size·TDD 모두 통과 또는 무관): exit 0, 빈 출력
#   - deny (size 한도 초과 또는 unsafe replace_all): {hookSpecificOutput: {permissionDecision: "deny", ...}}
#   - ask (TDD 부재, Write 신규 .go/.tsx만): {hookSpecificOutput: {permissionDecision: "ask", ...}}
#
# 비차단 보장: jq 부재 / 비정상 stdin은 silent exit 0 (PreToolUse를 break 시키지 않음).
# 긴급 비활성: COMPOUND_MMP_SIZE_HOOK_DISABLE=1 환경변수.
#
# 성능: jq fork 호출을 5→2회로 압축 (review code-perf P1). 메타 1회 + content 1회 (분기시).

set -eu

# 긴급 비활성 토글
if [ "${COMPOUND_MMP_SIZE_HOOK_DISABLE:-}" = "1" ]; then
  exit 0
fi

# jq 부재 시 silent (비차단)
command -v jq >/dev/null 2>&1 || exit 0

input=$(cat)
[ -z "$input" ] && exit 0

# === 메타 추출 (jq 1회) ===
# tool_name, file_path, replace_all 동시 추출 (TSV로 묶어 단일 jq 호출)
meta=$(printf '%s' "$input" | jq -r '[.tool_name // "", .tool_input.file_path // "", (.tool_input.replace_all // false | tostring)] | @tsv' 2>/dev/null || printf '\t\tfalse')
tool_name=""
file_path=""
replace_all="false"
IFS=$'\t' read -r tool_name file_path replace_all <<EOF
$meta
EOF

case "$tool_name" in
  Edit|Write) ;;
  *) exit 0 ;;
esac

[ -z "$file_path" ] && exit 0

basename_file=$(basename "$file_path")

# === 자동 통과 예외 (size + TDD 모두 스킵) ===
case "$file_path" in
  *_test.go|*.test.tsx|*.test.ts) exit 0 ;;
  *_mock.go|*_gen.go|*sqlc.go|*.pb.go) exit 0 ;;
  */apps/server/cmd/*) exit 0 ;;
  */apps/web/src/types/*|*/apps/web/src/constants/*) exit 0 ;;
  */migrations/*) exit 0 ;;
  *.sql) exit 0 ;;
esac

# === 사이즈 한도 결정 ===
# CLAUDE.md 200 한도는 카논 "CLAUDE.md만 200"의 자동 로딩 토큰 비용 근거를
# repo root CLAUDE.md에만 적용 (review critic P1 #1).
# 서브디렉토리 CLAUDE.md (apps/server/CLAUDE.md 등)는 자동 로딩 X → .md 500 적용.
limit=0
if [ "$basename_file" = "CLAUDE.md" ]; then
  proj="${CLAUDE_PROJECT_DIR:-}"
  if [ -n "$proj" ] && [ "$file_path" = "$proj/CLAUDE.md" ]; then
    limit=200
  elif [ -z "$proj" ]; then
    # CLAUDE_PROJECT_DIR 부재 (CI/test 환경): git toplevel fallback
    root=$(git -C "$(dirname "$file_path")" rev-parse --show-toplevel 2>/dev/null || echo "")
    if [ -n "$root" ] && [ "$file_path" = "$root/CLAUDE.md" ]; then
      limit=200
    fi
  fi
  # nested CLAUDE.md 또는 root 미확인: 일반 .md 500 fallthrough
fi
if [ "$limit" -eq 0 ]; then
  case "$file_path" in
    *.go) limit=500 ;;
    *.ts|*.tsx) limit=400 ;;
    *.md) limit=500 ;;
  esac
fi

# === 사이즈 검사 (limit > 0) ===
if [ "$limit" -gt 0 ]; then
  proposed_lines=0
  if [ "$tool_name" = "Write" ]; then
    content=$(printf '%s' "$input" | jq -r '.tool_input.content // empty' 2>/dev/null || echo "")
    if [ -n "$content" ]; then
      proposed_lines=$(printf '%s' "$content" | awk 'END{print NR}')
    fi
  else
    # Edit — multi-line content가 @tsv에서 \n으로 escape되어 line 카운트가 깨지는 이슈로
    # new_string/old_string은 분리 호출 유지 (정확도 우선). 메타 1회 + Edit 2회 = 총 3회 jq.
    new_string=$(printf '%s' "$input" | jq -r '.tool_input.new_string // empty' 2>/dev/null || echo "")
    old_string=$(printf '%s' "$input" | jq -r '.tool_input.old_string // empty' 2>/dev/null || echo "")
    current_lines=0
    if [ -f "$file_path" ]; then
      current_lines=$(awk 'END{print NR}' "$file_path" 2>/dev/null || echo 0)
    fi
    new_lines=0
    old_lines=0
    [ -n "$new_string" ] && new_lines=$(printf '%s' "$new_string" | awk 'END{print NR}')
    [ -n "$old_string" ] && old_lines=$(printf '%s' "$old_string" | awk 'END{print NR}')

    # replace_all=true 가드 (review critic P1 #2):
    # multiple-occurrence 시 정확한 line projection 불가 (false negative 위험).
    # 보수적 deny: new_lines가 old_lines를 초과하면 차단 + multiple Edit calls 안내.
    if [ "$replace_all" = "true" ] && [ "$new_lines" -gt "$old_lines" ]; then
      jq -nc \
        --arg fp "$file_path" \
        '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: ("Edit replace_all=true 이고 new_string이 old_string보다 길어 size 한도 우회 가능 (다중 occurrence 정확 추정 불가). 개별 Edit call 여러 번으로 분리하거나 replace_all=false 후 명시적 위치별로 수정. 파일: " + $fp + ". 카논: refs/tdd-enforcement.md.")}}'
      exit 0
    fi

    proposed_lines=$((current_lines + new_lines - old_lines))
  fi

  if [ "$proposed_lines" -gt "$limit" ]; then
    jq -nc \
      --arg fp "$file_path" \
      --arg lim "$limit" \
      --arg act "$proposed_lines" \
      '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: ("파일 크기 한도 초과: " + $fp + " 예상 " + $act + "줄 (한도 " + $lim + "줄). 분할 패턴은 memory/feedback_file_size_limit.md 참조 — Go: handler/service/factory/reactor 분리, React: 서브컴포넌트 추출, MD: index + refs/<topic>.md 분할. 긴급 우회는 COMPOUND_MMP_SIZE_HOOK_DISABLE=1.")}}'
    exit 0
  fi
fi

# === TDD soft ask (Write 신규 파일 + .go/.tsx만) ===
if [ "$tool_name" = "Write" ] && [ ! -f "$file_path" ]; then
  dir=$(dirname "$file_path")
  case "$file_path" in
    *.go)
      base="${basename_file%.go}"
      if [ -d "$dir" ]; then
        if [ -f "${dir}/${base}_test.go" ]; then
          exit 0
        fi
        # bash 3.2 호환: ls glob exit code로 매치 검사
        if ls "$dir"/*_test.go >/dev/null 2>&1; then
          exit 0
        fi
      fi
      jq -nc \
        --arg fp "$file_path" \
        --arg base "$base" \
        '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: ("TDD soft ask: " + $fp + " 의 " + $base + "_test.go (또는 동일 디렉토리 *_test.go) 가 없습니다. 테스트를 먼저 만드시겠습니까? (Y/n) — 도메인 모델·마이그레이션은 N 응답 가능. 카논: refs/tdd-enforcement.md.")}}'
      exit 0
      ;;
    *.tsx)
      base="${basename_file%.tsx}"
      if [ -d "$dir" ]; then
        if [ -f "${dir}/${base}.test.tsx" ]; then
          exit 0
        fi
        if [ -f "${dir}/__tests__/${base}.test.tsx" ]; then
          exit 0
        fi
        # 부모의 __tests__ (apps/web/src/<module>/__tests__/<name>.test.tsx legacy)
        parent=$(dirname "$dir")
        if [ -f "${parent}/__tests__/${base}.test.tsx" ]; then
          exit 0
        fi
      fi
      jq -nc \
        --arg fp "$file_path" \
        --arg base "$base" \
        '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: ("TDD soft ask: " + $fp + " 의 " + $base + ".test.tsx 가 없습니다. Vitest+RTL+MSW 패턴으로 테스트를 먼저 만드시겠습니까? (Y/n) — 카논: apps/web/CLAUDE.md.")}}'
      exit 0
      ;;
  esac
fi

exit 0
