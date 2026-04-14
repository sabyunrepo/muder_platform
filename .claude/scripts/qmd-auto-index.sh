#!/usr/bin/env bash
# qmd-auto-index.sh — PostToolUse hook: re-index QMD when docs/plans/, memory/, or docs/superpowers/ files change
#
# Receives Claude Code PostToolUse hook input via stdin as JSON.
# Extracts file_path, matches against known collection paths, triggers `qmd update` in background.

QMD="/Users/sabyun/.bun/bin/qmd"

# Read stdin JSON (PostToolUse hook passes tool input on stdin)
INPUT="$(cat)"

# Extract file_path from JSON — handles both "file_path" and nested "input.file_path"
FILE_PATH="$(printf '%s' "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
# PostToolUse: tool_input is the top-level object for Write/Edit tools
fp = data.get('file_path') or data.get('input', {}).get('file_path', '')
print(fp)
" 2>/dev/null)"

# Nothing to do if we couldn't extract a path
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Determine which collection matches (first match wins)
COLLECTION=""
if [[ "$FILE_PATH" == *"docs/plans/"* ]]; then
  COLLECTION="mmp-plans"
elif [[ "$FILE_PATH" == *"/memory/"* ]]; then
  COLLECTION="mmp-memory"
elif [[ "$FILE_PATH" == *"docs/superpowers/"* ]]; then
  COLLECTION="mmp-specs"
fi

# No match — exit silently
if [ -z "$COLLECTION" ]; then
  exit 0
fi

# Fire-and-forget: re-index + embed in background, suppress all output
("$QMD" update && "$QMD" embed) > /dev/null 2>&1 &
disown $!

echo "🔄 QMD 재인덱싱 트리거: $COLLECTION (${FILE_PATH##*/})"
