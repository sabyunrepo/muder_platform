#!/usr/bin/env bash
# mmp-pilot handoff-from-autopilot — 기존 plan-autopilot 실행 상태를 /plan-go로 인계
# Phase 18.3처럼 autopilot 중인 plan을 안전하게 mmp-pilot으로 넘긴다.
set -euo pipefail

APLAN=".claude/active-plan.json"
LOCK=".claude/run-lock.json"

[[ -f "$APLAN" ]] || { echo "ERR: $APLAN 없음"; exit 1; }
[[ -f "$LOCK" ]] && { echo "ERR: run-lock 이미 점유 중 — 먼저 /plan-go --force-unlock"; exit 2; }

phase=$(jq -r '.active.id' "$APLAN")
wave=$(jq -r '.active.current_wave' "$APLAN")
pr=$(jq -r '.active.current_pr' "$APLAN")
task=$(jq -r '.active.current_task' "$APLAN")
existing_run=$(jq -r '.active.current_run_id // empty' "$APLAN")

if [[ -n "$existing_run" ]]; then
  echo "기존 run_id 존재: $existing_run — 재사용"
  run_id="$existing_run"
else
  run_id="r-handoff-$(date -u +%Y%m%d-%H%M%S)-$(openssl rand -hex 2)"
  echo "신규 run_id: $run_id"
fi

# 1) active-plan.json에 run_id 등록
tmp=$(mktemp)
jq --arg id "$run_id" --arg t "$(date -u +%FT%TZ)" \
   '.active.current_run_id = $id |
    .active.runs = (.active.runs // {}) |
    .active.runs[$id] = {started_at:$t, mode:"handoff", state:"running", source:"plan-autopilot"}' \
   "$APLAN" > "$tmp" && mv "$tmp" "$APLAN"
echo "✓ active-plan.json 갱신"

# 2) runs 디렉토리 준비
mkdir -p ".claude/runs/$run_id/$wave/$pr"
cat > ".claude/runs/$run_id/manifest.json" <<JSON
{
  "run_id": "$run_id",
  "mode": "handoff",
  "source": "plan-autopilot",
  "phase": "$phase",
  "wave": "$wave",
  "pr": "$pr",
  "task": "$task",
  "handoff_at": "$(date -u +%FT%TZ)"
}
JSON
echo "✓ manifest 생성"

# 3) 기존 autopilot worktree 감지 → pilot 브랜치로 참조 기록
mapfile -t wts < <(git worktree list --porcelain | awk '/^worktree / {print $2}' | grep -F ".claude/worktrees/${phase}-" || true)
if (( ${#wts[@]} )); then
  jq --argjson wts "$(printf '%s\n' "${wts[@]}" | jq -Rs 'split("\n")|map(select(.!=""))')" \
     '.worktrees = $wts' ".claude/runs/$run_id/manifest.json" > "$tmp" && mv "$tmp" ".claude/runs/$run_id/manifest.json"
  echo "✓ 기존 autopilot worktree ${#wts[@]}개 인수: ${wts[*]}"
else
  echo "ℹ worktree 없음 — in-place 모드"
fi

# 4) 락 획득
bash .claude/scripts/run-lock.sh acquire "$run_id" "$wave" "$pr" "$task"

echo ""
echo "=== handoff 완료 ==="
echo "이제 /plan-go --resume 으로 이어 실행 가능."
echo "기존 /plan-autopilot 호출은 락 충돌로 차단됨(의도된 동작)."
