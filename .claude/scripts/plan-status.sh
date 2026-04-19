#!/usr/bin/env bash
# plan-status.sh — extract STATUS marker from active plan's checklist
# Modes: --compact (1 line), --verbose (full block + scope + paths)
set -euo pipefail

ACTIVE_PLAN_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/active-plan.json"
MODE="${1:---compact}"

# No active plan → silent exit 0
[ -f "$ACTIVE_PLAN_FILE" ] || exit 0

# Require jq
if ! command -v jq >/dev/null 2>&1; then
    echo "[plan-autopilot] jq not installed — status hook skipped" >&2
    exit 0
fi

PLAN_NAME=$(jq -r '.active.name // empty' "$ACTIVE_PLAN_FILE" 2>/dev/null)
[ -z "$PLAN_NAME" ] && exit 0  # no active plan

PLAN_ID=$(jq -r '.active.id // empty' "$ACTIVE_PLAN_FILE")
CHECKLIST=$(jq -r '.active.checklist // empty' "$ACTIVE_PLAN_FILE")
DESIGN=$(jq -r '.active.design // empty' "$ACTIVE_PLAN_FILE")
PROGRESS_MEM=$(jq -r '.active.progress_memory // empty' "$ACTIVE_PLAN_FILE")
CURRENT_WAVE=$(jq -r '.active.current_wave // "?"' "$ACTIVE_PLAN_FILE")
CURRENT_PR=$(jq -r '.active.current_pr // "?"' "$ACTIVE_PLAN_FILE")
CURRENT_TASK=$(jq -r '.active.current_task // "?"' "$ACTIVE_PLAN_FILE")
STATUS=$(jq -r '.active.status // "?"' "$ACTIVE_PLAN_FILE")
SCOPE=$(jq -r '.active.scope // [] | join(", ")' "$ACTIVE_PLAN_FILE")
STARTED=$(jq -r '.active.started_at // "?"' "$ACTIVE_PLAN_FILE")

case "$MODE" in
    --compact)
        # Single line for UserPromptSubmit — ~25 tokens.
        # Silent when plan fields are unset — emit only when real work is in progress.
        if [ "$CURRENT_TASK" = "?" ] && [ "$STATUS" = "?" ]; then
            exit 0
        fi
        echo "[ACTIVE PLAN: $PLAN_ID | $CURRENT_WAVE $CURRENT_PR | task: $CURRENT_TASK | $STATUS]"
        ;;

    --verbose)
        # ~30 lines for SessionStart
        echo "=== ACTIVE PLAN ==="
        echo "Phase: $PLAN_NAME"
        echo "Started: $STARTED"
        echo ""
        echo "Current Wave: $CURRENT_WAVE"
        echo "Current PR: $CURRENT_PR"
        echo "Current Task: $CURRENT_TASK"
        echo "Status: $STATUS"
        echo ""

        # STATUS marker from checklist (if exists)
        if [ -n "$CHECKLIST" ] && [ -f "$CHECKLIST" ]; then
            if grep -q "<!-- STATUS-START -->" "$CHECKLIST" 2>/dev/null; then
                echo "=== STATUS MARKER ==="
                sed -n '/<!-- STATUS-START -->/,/<!-- STATUS-END -->/p' "$CHECKLIST"
                echo ""
            fi
        fi

        echo "=== FILES (read these before editing scope) ==="
        [ -n "$DESIGN" ] && echo "  Design: $DESIGN"
        [ -n "$CHECKLIST" ] && echo "  Checklist: $CHECKLIST"
        [ -n "$PROGRESS_MEM" ] && echo "  Progress: $PROGRESS_MEM"
        echo ""

        echo "=== SCOPE (edit triggers plan guard) ==="
        jq -r '.active.scope[]?' "$ACTIVE_PLAN_FILE" | sed 's/^/  - /'
        echo ""

        BLOCKERS=$(jq -r '.active.blockers // [] | if length == 0 then "none" else join(", ") end' "$ACTIVE_PLAN_FILE")
        echo "Blockers: $BLOCKERS"
        echo ""
        echo "Commands: /plan-status /plan-tasks /plan-autopilot /plan-resume"
        ;;

    *)
        echo "Usage: $0 [--compact|--verbose]" >&2
        exit 1
        ;;
esac

exit 0
