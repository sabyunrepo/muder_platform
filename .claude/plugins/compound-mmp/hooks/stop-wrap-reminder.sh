#!/usr/bin/env bash
# Stop hook — 세션 종료 시점에 변경량이 크고 /compound-wrap 미실행이면 한 줄 리마인드.
# 비차단 hook. additionalContext만 반환.
#
# 트리거 조건:
#   1. git diff --stat HEAD..HEAD~10 의 changed lines >= 50
#   2. 세션 내 /compound-wrap 실행 흔적 없음 (휴리스틱: memory/sessions/<today>-*.md 부재)
#
# 출력: stdout JSON (hookSpecificOutput.additionalContext) 또는 빈 응답

set -eu

# 변경량 측정 (안전 fallback)
DIFF_LINES=$(git diff --shortstat 2>/dev/null | awk -F',' '{
  ins=0; del=0
  for (i=1; i<=NF; i++) {
    if ($i ~ /insertion/) { gsub(/[^0-9]/,"",$i); ins=$i }
    if ($i ~ /deletion/)  { gsub(/[^0-9]/,"",$i); del=$i }
  }
  print ins+del
}')
DIFF_LINES="${DIFF_LINES:-0}"

# 임계값 미만이면 silent
if [ "$DIFF_LINES" -lt 50 ]; then
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
