#!/usr/bin/env bash
# plan-remind.sh — PostToolUse hook for Edit/Write
# Non-blocking. Reminds user to update checklist + progress marker after edits in scope.

set -euo pipefail

ACTIVE_PLAN_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/active-plan.json"
[ -f "$ACTIVE_PLAN_FILE" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

PLAN_NAME=$(jq -r '.active.name // empty' "$ACTIVE_PLAN_FILE")
[ -z "$PLAN_NAME" ] && exit 0

# Match scope
MATCHED=0
while IFS= read -r glob; do
    [ -z "$glob" ] && continue
    if [[ "$FILE_PATH" == $glob ]]; then
        MATCHED=1
        break
    fi
    REL_FILE="${FILE_PATH#${CLAUDE_PROJECT_DIR:-.}/}"
    if [[ "$REL_FILE" == $glob ]]; then
        MATCHED=1
        break
    fi
done < <(jq -r '.active.scope[]?' "$ACTIVE_PLAN_FILE")

[ "$MATCHED" -eq 0 ] && exit 0

CHECKLIST=$(jq -r '.active.checklist // empty' "$ACTIVE_PLAN_FILE")
PROGRESS=$(jq -r '.active.progress_memory // empty' "$ACTIVE_PLAN_FILE")
CURRENT_PR=$(jq -r '.active.current_pr // "?"' "$ACTIVE_PLAN_FILE")

{
    echo ""
    echo "📝 PLAN REMINDER: $FILE_PATH is in active plan scope ($CURRENT_PR)."
    echo "   After this work segment, update:"
    [ -n "$CHECKLIST" ] && echo "   - $CHECKLIST (mark task ✅)"
    [ -n "$PROGRESS" ] && echo "   - $PROGRESS (STATUS marker)"
    echo "   Also: ensure all modified .md files are <200 lines (split into refs/ if larger)."
} >&2

exit 0
