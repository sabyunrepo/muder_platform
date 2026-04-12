#!/usr/bin/env bash
# plan-tasks.sh — visual task tree with progress percentages
# Reads active-plan.json + checklist.md to compute per-PR progress.

set -euo pipefail

ACTIVE_PLAN_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/active-plan.json"
[ -f "$ACTIVE_PLAN_FILE" ] || { echo "No active plan."; exit 0; }
command -v jq >/dev/null 2>&1 || { echo "jq required"; exit 1; }

PLAN_NAME=$(jq -r '.active.name // "?"' "$ACTIVE_PLAN_FILE")
PLAN_ID=$(jq -r '.active.id // "?"' "$ACTIVE_PLAN_FILE")
STARTED=$(jq -r '.active.started_at // "?"' "$ACTIVE_PLAN_FILE")
CHECKLIST=$(jq -r '.active.checklist // empty' "$ACTIVE_PLAN_FILE")
CURRENT_WAVE=$(jq -r '.active.current_wave // "?"' "$ACTIVE_PLAN_FILE")

echo "${PLAN_NAME}"
echo "Started: ${STARTED}"

# Parse checklist.md for task counts (if exists)
TOTAL_TASKS=0
DONE_TASKS=0
if [ -n "$CHECKLIST" ] && [ -f "$CHECKLIST" ]; then
    TOTAL_TASKS=$(grep -cE '^\s*- \[[ x]\]' "$CHECKLIST" 2>/dev/null || echo 0)
    DONE_TASKS=$(grep -cE '^\s*- \[x\]' "$CHECKLIST" 2>/dev/null || echo 0)
fi

PR_COUNT=$(jq -r '.active.prs // {} | length' "$ACTIVE_PLAN_FILE")
PR_DONE=$(jq -r '[.active.prs // {} | to_entries[] | select(.value.status == "completed")] | length' "$ACTIVE_PLAN_FILE")

# Overall progress bar
if [ "$TOTAL_TASKS" -gt 0 ]; then
    PCT=$((DONE_TASKS * 100 / TOTAL_TASKS))
else
    PCT=0
fi

# Render progress bar
BAR_LEN=20
FILLED=$((PCT * BAR_LEN / 100))
EMPTY=$((BAR_LEN - FILLED))
BAR=$(printf '█%.0s' $(seq 1 $FILLED 2>/dev/null))$(printf '░%.0s' $(seq 1 $EMPTY 2>/dev/null))

echo "Overall: $DONE_TASKS/$TOTAL_TASKS tasks ($PCT%) | $PR_DONE/$PR_COUNT PRs | Wave $CURRENT_WAVE"
echo "$BAR"
echo ""

# Per-wave breakdown
echo "=== Waves ==="
jq -r '.active.waves[]? | "\(.id)|\(.name)|\(.mode)|\(.prs | join(","))"' "$ACTIVE_PLAN_FILE" | while IFS='|' read -r wid wname wmode wprs; do
    icon="⏸"
    [ "$wid" = "$CURRENT_WAVE" ] && icon="🔄"
    # Check if all PRs in wave are completed
    ALL_DONE=1
    IFS=',' read -ra PR_ARR <<< "$wprs"
    for pr in "${PR_ARR[@]}"; do
        pr_status=$(jq -r ".active.prs[\"$pr\"].status // \"pending\"" "$ACTIVE_PLAN_FILE")
        [ "$pr_status" = "completed" ] || ALL_DONE=0
    done
    [ "$ALL_DONE" -eq 1 ] && icon="✅"
    echo "$icon Wave $wid ($wname, $wmode): $wprs"
done

echo ""
echo "=== Per-PR progress ==="
jq -r '.active.prs // {} | to_entries[]? | "\(.key)|\(.value.title)|\(.value.tasks_total // 0)|\(.value.tasks_done // 0)|\(.value.status // "pending")"' "$ACTIVE_PLAN_FILE" | sort | while IFS='|' read -r pid title total done status; do
    icon="⏸"
    [ "$status" = "in_progress" ] && icon="🔄"
    [ "$status" = "completed" ] && icon="✅"
    if [ "$total" -gt 0 ]; then
        pct=$((done * 100 / total))
    else
        pct=0
    fi
    printf "  %s %-8s %-50s [%d/%d %d%%]\n" "$icon" "$pid" "$title" "$done" "$total" "$pct"
done

echo ""
echo "Use /plan-autopilot to execute, /plan-status for quick view, /plan-resume to reload context."
