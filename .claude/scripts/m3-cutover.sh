#!/usr/bin/env bash
# mmp-pilot M3 cutover — Phase 18.3 종료 후 실행.
# autopilot.md 삭제, _workspace/ 참조 제거, 4 내장 리뷰어 정의 제거.
# 실행 전 조건: active-plan.json 의 status != in_progress (또는 사용자 확인)
set -euo pipefail

APLAN=".claude/active-plan.json"

echo "=== M3 Cutover pre-check ==="
status=$(jq -r '.active.status // "none"' "$APLAN")
phase=$(jq -r '.active.id // "none"' "$APLAN")
echo "active phase: $phase  status: $status"

if [[ "$status" == "in_progress" ]]; then
  echo ""
  echo "⚠️  현재 plan이 in_progress 상태입니다."
  echo "   M3 cutover는 Phase 종료(plan-finish) 후에 실행하세요."
  read -rp "계속 진행하려면 'FORCE' 입력: " ans
  [[ "$ans" == "FORCE" ]] || { echo "abort"; exit 1; }
fi

echo ""
echo "=== 실행 항목 ==="
echo "1. /plan-autopilot.md 삭제"
echo "2. .claude/post-task-pipeline.json 의 autopilot 4 내장 리뷰어 정의 제거"
echo "3. _workspace/ 경로 참조를 .claude/runs/ 로 치환"
echo "4. plan-* 커맨드의 autopilot 참조 → plan-go 로 치환"
echo "5. CLAUDE.md 하네스 섹션에 M3 완료 기록"
read -rp "진행하시겠습니까? [y/N]: " ok
[[ "$ok" == "y" || "$ok" == "Y" ]] || { echo "abort"; exit 0; }

backup=".claude/m3-backup-$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$backup"

# 1) autopilot.md 백업 후 삭제
if [[ -f .claude/commands/plan-autopilot.md ]]; then
  cp .claude/commands/plan-autopilot.md "$backup/"
  rm .claude/commands/plan-autopilot.md
  echo "✓ plan-autopilot.md 삭제 (백업: $backup/)"
fi

# 2) post-task-pipeline autopilot 리뷰어 제거
if [[ -f .claude/post-task-pipeline.json ]]; then
  cp .claude/post-task-pipeline.json "$backup/"
  tmp=$(mktemp)
  jq 'del(.reviewers.autopilot_builtins // empty)' .claude/post-task-pipeline.json > "$tmp" && mv "$tmp" .claude/post-task-pipeline.json
  echo "✓ autopilot 4 내장 리뷰어 정의 제거"
fi

# 3) _workspace/ 참조 치환 (설계 문서 외)
grep -rl --include='*.md' '_workspace/' .claude/ 2>/dev/null | while read -r f; do
  [[ "$f" == *"/designs/"* ]] && continue
  sed -i.bak 's|_workspace/|.claude/runs/{run-id}/|g' "$f" && rm -f "${f}.bak"
  echo "✓ 치환: $f"
done

# 4) plan-* 커맨드의 autopilot 참조
for f in .claude/commands/plan-*.md; do
  [[ "$f" == *"plan-go.md" ]] && continue
  sed -i.bak 's|/plan-autopilot|/plan-go|g; s|plan-autopilot 실행|plan-go 실행|g' "$f" && rm -f "${f}.bak" 2>/dev/null || true
done
echo "✓ plan-* 커맨드 참조 갱신"

# 5) CLAUDE.md 변경 이력
{
  echo ""
  echo "| $(date +%Y-%m-%d) | M3 cutover 완료 | autopilot 제거 + runs/ 전환 | mmp-pilot 단일 체계 확립 |"
} >> CLAUDE.md
echo "✓ CLAUDE.md 변경 이력 append"

echo ""
echo "=== M3 cutover 완료 ==="
echo "백업: $backup"
echo "다음: M4 A/B + 자기개선 루프 활성화 (docs/mmp-pilot/m4-plan.md 참조)"
