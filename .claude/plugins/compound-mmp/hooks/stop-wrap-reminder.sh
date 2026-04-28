#!/usr/bin/env bash
# Stop hook — 세션 종료 시점에 변경량이 크고 /compound-wrap 미실행이면 한 줄 리마인드.
# 비차단 hook. additionalContext만 반환.
#
# 트리거 조건:
#   1. 최근 10 commit + 미커밋 working tree 변경의 changed lines >= COMPOUND_WRAP_MIN_LINES (기본 50)
#   2. 세션 내 /compound-wrap 실행 흔적 없음 (휴리스틱: memory/sessions/<today>-*.md 부재)
#
# 환경 변수 (PR-5 카논화):
#   COMPOUND_WRAP_MIN_LINES   임계 줄수 (기본 50, PR-10 dogfooding 후 calibration)
#   COMPOUND_WRAP_REMINDER_DISABLE=1   리마인드 전체 비활성
#
# 출력: stdout JSON (hookSpecificOutput.additionalContext) 또는 빈 응답

set -euo pipefail

# 긴급 비활성 토글
if [ "${COMPOUND_WRAP_REMINDER_DISABLE:-}" = "1" ]; then
  exit 0
fi

THRESHOLD="${COMPOUND_WRAP_MIN_LINES:-50}"
case "$THRESHOLD" in
  ''|*[!0-9]*) THRESHOLD=50 ;;  # 비숫자 입력 fallback
esac

# 변경량 측정 — 커밋 이력(HEAD~10..HEAD) + 미커밋 변경(HEAD vs working tree) 합산
sum_shortstat() {
  awk -F',' '{
    ins=0; del=0
    for (i=1; i<=NF; i++) {
      if ($i ~ /insertion/) { gsub(/[^0-9]/,"",$i); ins=$i }
      if ($i ~ /deletion/)  { gsub(/[^0-9]/,"",$i); del=$i }
    }
    print ins+del
  }'
}

COMMIT_LINES=$(git diff --shortstat HEAD~10..HEAD 2>/dev/null | sum_shortstat || echo 0)
UNCOMMITTED_LINES=$(git diff --shortstat HEAD 2>/dev/null | sum_shortstat || echo 0)
COMMIT_LINES="${COMMIT_LINES:-0}"
UNCOMMITTED_LINES="${UNCOMMITTED_LINES:-0}"
DIFF_LINES=$((COMMIT_LINES + UNCOMMITTED_LINES))

# 임계값 미만이면 silent
if [ "$DIFF_LINES" -lt "$THRESHOLD" ]; then
  exit 0
fi

# 오늘 세션 wrap 흔적 검사 (memory/sessions/YYYY-MM-DD-*.md)
TODAY=$(date +%Y-%m-%d)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
if ls "$REPO_ROOT/memory/sessions/${TODAY}-"*.md >/dev/null 2>&1; then
  # 이미 wrap 실행됨
  exit 0
fi

# 리마인드 출력 (raw prompt echo X — anti-pattern security MEDIUM-1 준수)
cat <<EOF
{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"[compound-mmp] 세션 변경 ${DIFF_LINES}줄. \`/compound-wrap\` 으로 7단계 wrap-up 시퀀스 실행 권장 (handoff 노트 + MEMORY.md 갱신)."}}
EOF
