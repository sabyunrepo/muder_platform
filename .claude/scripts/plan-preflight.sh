#!/usr/bin/env bash
# plan-preflight.sh — verify .claude/settings.json is valid and all hook commands
# resolve to real executable files.
#
# Called by every plan-* slash command via `!` shell substitution at the top
# of the command file. If anything is broken, prints clear recovery instructions
# so Claude knows to fix settings.json BEFORE proceeding.
#
# All output goes to stdout (so `!` substitution captures it). Exit code is
# always 0 (we want the message to reach Claude, not block the command).

set -u  # -e would abort the script; we want to complete and print a summary

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
SETTINGS="$PROJECT_DIR/.claude/settings.json"
SCRIPTS_DIR="$PROJECT_DIR/.claude/scripts"
SKILL_DIR="$HOME/.claude/skills/plan-autopilot"

print_recovery() {
    cat <<EOF

🔧 RECOVERY STEPS:

1. Verify project-local scripts are present:
   ls -la $SCRIPTS_DIR/

2. If missing, re-copy from skill:
   mkdir -p $SCRIPTS_DIR
   cp $SKILL_DIR/scripts/*.sh $SCRIPTS_DIR/
   chmod +x $SCRIPTS_DIR/*.sh

3. Copy fresh settings template (overwrites .claude/settings.json):
   cp $SKILL_DIR/templates/settings.template.json .claude/settings.json

4. Copy fresh slash commands:
   cp $SKILL_DIR/commands/*.md .claude/commands/

5. Re-copy pipeline if needed:
   cp $SKILL_DIR/templates/post-task-pipeline.template.json .claude/post-task-pipeline.json

6. Verify JSON validity:
   jq . .claude/settings.json
   jq . .claude/post-task-pipeline.json

Then retry the /plan-* command.

EOF
}

# 1. settings.json 존재 + 유효 JSON 검증
if [ ! -f "$SETTINGS" ]; then
    echo "⚠️  PRE-FLIGHT: .claude/settings.json not found"
    echo "   → plan-autopilot hooks are not installed in this project."
    print_recovery
    exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "⚠️  PRE-FLIGHT: jq is not installed (required by plan-autopilot)"
    echo "   → brew install jq   # macOS"
    echo "   → apt-get install jq  # Debian/Ubuntu"
    exit 0
fi

if ! jq . "$SETTINGS" > /dev/null 2>&1; then
    echo "❌ PRE-FLIGHT: .claude/settings.json is not valid JSON"
    print_recovery
    exit 0
fi

# 2. 스킬 디렉토리 존재 검증
if [ ! -d "$SKILL_DIR" ]; then
    echo "❌ PRE-FLIGHT: plan-autopilot skill not found at $SKILL_DIR"
    echo "   → Install the skill first."
    exit 0
fi

# 3. Hook command 추출 + 각 스크립트 경로 검증
# hooks 구조: { "EventName": [ { "matcher": "...", "hooks": [ { "type": "command", "command": "..." } ] } ] }
# 또는 레거시: { "EventName": [ { "command": "..." } ] }
HOOK_COMMANDS=$(jq -r '
    .hooks // {} |
    to_entries[] |
    .value[]? |
    (if .hooks then (.hooks[]?.command // empty) else (.command // empty) end)
' "$SETTINGS" 2>/dev/null)

if [ -z "$HOOK_COMMANDS" ]; then
    echo "⚠️  PRE-FLIGHT: no hook commands found in .claude/settings.json"
    echo "   → settings.json exists but has no plan-autopilot hooks."
    print_recovery
    exit 0
fi

MISSING_COUNT=0
BAD_PERM_COUNT=0
WRONG_PATH_COUNT=0
TOTAL_COUNT=0

while IFS= read -r cmd; do
    [ -z "$cmd" ] && continue
    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    # Extract the first word (script path), strip args like --verbose
    script=$(echo "$cmd" | awk '{print $1}')

    # Expand $HOME, $CLAUDE_PROJECT_DIR (both $X and ${X} forms), and ~
    expanded="$script"
    expanded="${expanded//\$\{HOME\}/$HOME}"
    expanded="${expanded//\$HOME/$HOME}"
    expanded="${expanded//\$\{CLAUDE_PROJECT_DIR\}/$PROJECT_DIR}"
    expanded="${expanded//\$CLAUDE_PROJECT_DIR/$PROJECT_DIR}"
    expanded="${expanded/#\~/$HOME}"

    # Bare relative .claude/scripts/... → resolve from PROJECT_DIR
    if [[ "$expanded" == .claude/scripts/* ]] || [[ "$expanded" == ./.claude/scripts/* ]]; then
        expanded="$PROJECT_DIR/${expanded#./}"
    fi

    if [ ! -e "$expanded" ]; then
        echo "❌ PRE-FLIGHT: hook script not found"
        echo "   command: $cmd"
        echo "   resolved: $expanded"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    elif [ ! -x "$expanded" ]; then
        echo "❌ PRE-FLIGHT: hook script not executable"
        echo "   resolved: $expanded"
        echo "   fix: chmod +x $expanded"
        BAD_PERM_COUNT=$((BAD_PERM_COUNT + 1))
    fi
done <<< "$HOOK_COMMANDS"

TOTAL_BAD=$((MISSING_COUNT + BAD_PERM_COUNT + WRONG_PATH_COUNT))
if [ "$TOTAL_BAD" -gt 0 ]; then
    echo ""
    echo "❌ PRE-FLIGHT FAILED: $TOTAL_BAD / $TOTAL_COUNT hook commands broken"
    echo "   (missing: $MISSING_COUNT, bad perms: $BAD_PERM_COUNT, wrong path: $WRONG_PATH_COUNT)"
    echo ""
    echo "🛑 STOP: Do NOT proceed with the plan-* command until settings.json is fixed."
    print_recovery
    exit 0
fi

# 4. 현재 active plan 상태 확인 (참고용)
ACTIVE_PLAN_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/active-plan.json"
if [ -f "$ACTIVE_PLAN_FILE" ]; then
    if jq .active.name "$ACTIVE_PLAN_FILE" > /dev/null 2>&1; then
        PLAN_NAME=$(jq -r '.active.name // "?"' "$ACTIVE_PLAN_FILE")
        CURRENT_WAVE=$(jq -r '.active.current_wave // "?"' "$ACTIVE_PLAN_FILE")
        CURRENT_PR=$(jq -r '.active.current_pr // "?"' "$ACTIVE_PLAN_FILE")
        echo "✓ PRE-FLIGHT OK: $TOTAL_COUNT/$TOTAL_COUNT hooks verified | active: $PLAN_NAME ($CURRENT_WAVE $CURRENT_PR)"
    else
        echo "⚠️  PRE-FLIGHT: hooks OK but active-plan.json is invalid JSON"
        echo "   fix: jq . .claude/active-plan.json"
    fi
else
    echo "✓ PRE-FLIGHT OK: $TOTAL_COUNT/$TOTAL_COUNT hooks verified | no active plan yet"
fi

exit 0
