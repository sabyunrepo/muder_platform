#!/usr/bin/env bash
# plan-track-reads.sh — PostToolUse hook for Read tool
# Logs file reads to /tmp/claude-plan-read.log for plan-guard.sh to check.
# Self-cleans entries older than 1 hour.

set -euo pipefail

READ_LOG="/tmp/claude-plan-read.log"
command -v jq >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

NOW=$(date +%s)
echo "$NOW $FILE_PATH" >> "$READ_LOG"

# Clean entries older than 1 hour (3600s)
if [ -f "$READ_LOG" ]; then
    CUTOFF=$((NOW - 3600))
    TMP=$(mktemp)
    awk -v cutoff="$CUTOFF" '$1 >= cutoff' "$READ_LOG" > "$TMP" 2>/dev/null || true
    mv "$TMP" "$READ_LOG" 2>/dev/null || true
fi

exit 0
