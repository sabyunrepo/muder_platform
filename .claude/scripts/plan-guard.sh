#!/usr/bin/env bash
# plan-guard.sh — PreToolUse hook for Edit/Write
# Blocks edits in active plan scope until design + checklist were read recently.
# Exit 2 = block with stderr message shown to Claude.

set -euo pipefail

ACTIVE_PLAN_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/active-plan.json"
READ_LOG="/tmp/claude-plan-read.log"
RECENT_MIN=30  # minutes

# No active plan → pass
[ -f "$ACTIVE_PLAN_FILE" ] || exit 0

# Require jq
command -v jq >/dev/null 2>&1 || exit 0

# Parse hook input (JSON on stdin)
HOOK_INPUT=$(cat)
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

# Get active plan info
PLAN_NAME=$(jq -r '.active.name // empty' "$ACTIVE_PLAN_FILE")
[ -z "$PLAN_NAME" ] && exit 0

DESIGN=$(jq -r '.active.design // empty' "$ACTIVE_PLAN_FILE")
CHECKLIST=$(jq -r '.active.checklist // empty' "$ACTIVE_PLAN_FILE")

# Check if file_path matches any scope glob
MATCHED=0
while IFS= read -r glob; do
    [ -z "$glob" ] && continue
    # Use bash glob matching
    if [[ "$FILE_PATH" == $glob ]]; then
        MATCHED=1
        break
    fi
    # Normalize absolute path and retry (hook may give absolute, scope may be relative)
    REL_FILE="${FILE_PATH#${CLAUDE_PROJECT_DIR:-.}/}"
    if [[ "$REL_FILE" == $glob ]]; then
        MATCHED=1
        break
    fi
done < <(jq -r '.active.scope[]?' "$ACTIVE_PLAN_FILE")

# Not in scope → pass
[ "$MATCHED" -eq 0 ] && exit 0

# In scope: check if design + checklist were read recently
check_recent() {
    local target="$1"
    [ -z "$target" ] && return 0  # no file to check
    [ -f "$READ_LOG" ] || return 1

    # Look for target in log, filter by timestamp (last $RECENT_MIN minutes)
    local now cutoff
    now=$(date +%s)
    cutoff=$((now - RECENT_MIN * 60))

    while IFS=' ' read -r ts path; do
        [ -z "$ts" ] && continue
        [ "$ts" -lt "$cutoff" ] && continue
        if [ "$path" = "$target" ] || [[ "$path" == *"$target" ]]; then
            return 0
        fi
    done < "$READ_LOG"
    return 1
}

DESIGN_OK=0
CHECKLIST_OK=0
check_recent "$DESIGN" && DESIGN_OK=1 || true
check_recent "$CHECKLIST" && CHECKLIST_OK=1 || true

if [ "$DESIGN_OK" -eq 1 ] && [ "$CHECKLIST_OK" -eq 1 ]; then
    exit 0  # pass
fi

# Block with helpful message
{
    echo ""
    echo "🛑 PLAN GUARD: Active plan requires reading these before editing:"
    echo "   File: $FILE_PATH"
    [ "$DESIGN_OK" -eq 0 ] && echo "   ⚠️  Not read recently: $DESIGN"
    [ "$CHECKLIST_OK" -eq 0 ] && echo "   ⚠️  Not read recently: $CHECKLIST"
    echo ""
    echo "   Active plan: $PLAN_NAME"
    echo ""
    echo "   Action required:"
    [ "$DESIGN_OK" -eq 0 ] && echo "   1. Read $DESIGN"
    [ "$CHECKLIST_OK" -eq 0 ] && echo "   2. Read $CHECKLIST"
    echo "   Then retry your edit."
    echo ""
    echo "   (If this is a false positive, use /plan-stop to pause the plan)"
} >&2

exit 2
