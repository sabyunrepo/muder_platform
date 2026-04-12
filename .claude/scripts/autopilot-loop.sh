#!/usr/bin/env bash
# autopilot-loop.sh — diagnostic + state helper for /plan-autopilot
# The actual wave execution is orchestrated by Claude Code's Agent tool (see refs/execution.md).
# This script:
#   - Reports current wave/PR/task
#   - Computes next wave to run
#   - Saves/loads autopilot-state.json for cross-session resume

set -euo pipefail

ACTIVE_PLAN_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/active-plan.json"
STATE_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/autopilot-state.json"

[ -f "$ACTIVE_PLAN_FILE" ] || { echo "No active plan. Run /plan-start first." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq required" >&2; exit 1; }

CMD="${1:-info}"

case "$CMD" in
    info)
        echo "=== Autopilot State ==="
        PLAN_NAME=$(jq -r '.active.name' "$ACTIVE_PLAN_FILE")
        CURRENT_WAVE=$(jq -r '.active.current_wave // "?"' "$ACTIVE_PLAN_FILE")
        CURRENT_PR=$(jq -r '.active.current_pr // "?"' "$ACTIVE_PLAN_FILE")
        echo "Plan: $PLAN_NAME"
        echo "Current wave: $CURRENT_WAVE"
        echo "Current PR: $CURRENT_PR"
        if [ -f "$STATE_FILE" ]; then
            echo ""
            echo "Autopilot paused state:"
            jq . "$STATE_FILE"
        fi
        ;;

    next-wave)
        # Print the next wave's JSON (for orchestrator consumption)
        CURRENT=$(jq -r '.active.current_wave // ""' "$ACTIVE_PLAN_FILE")
        if [ -z "$CURRENT" ]; then
            jq '.active.waves[0]' "$ACTIVE_PLAN_FILE"
        else
            # Find wave after current
            jq --arg cur "$CURRENT" '
                .active.waves as $waves
                | [range(0; $waves|length) as $i | select($waves[$i].id == $cur) | $i] as $idxs
                | if ($idxs|length) > 0 and ($idxs[0] + 1) < ($waves|length)
                  then $waves[$idxs[0] + 1]
                  else null end
            ' "$ACTIVE_PLAN_FILE"
        fi
        ;;

    pause)
        CURRENT_WAVE=$(jq -r '.active.current_wave // ""' "$ACTIVE_PLAN_FILE")
        CURRENT_PR=$(jq -r '.active.current_pr // ""' "$ACTIVE_PLAN_FILE")
        cat > "$STATE_FILE" <<EOF
{
  "plan_id": "$(jq -r '.active.id' "$ACTIVE_PLAN_FILE")",
  "current_wave": "$CURRENT_WAVE",
  "current_pr": "$CURRENT_PR",
  "paused_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "paused_reason": "${2:-user_request}",
  "fix_loop_iteration": 0
}
EOF
        echo "Paused at $CURRENT_WAVE/$CURRENT_PR. State: $STATE_FILE"
        ;;

    resume)
        if [ ! -f "$STATE_FILE" ]; then
            echo "No paused state. Nothing to resume." >&2
            exit 1
        fi
        echo "Resuming from:"
        jq . "$STATE_FILE"
        rm "$STATE_FILE"
        echo "State file cleared. Continue with /plan-autopilot."
        ;;

    advance-pr)
        # Called when a PR completes. Updates active-plan.json current_pr → next PR in wave.
        NEXT_PR="$2"
        TMP=$(mktemp)
        jq --arg pr "$NEXT_PR" '.active.current_pr = $pr' "$ACTIVE_PLAN_FILE" > "$TMP"
        mv "$TMP" "$ACTIVE_PLAN_FILE"
        echo "Advanced to $NEXT_PR"
        ;;

    advance-wave)
        # Called when a wave completes. Updates active-plan.json current_wave → next wave.
        NEXT_WAVE="$2"
        TMP=$(mktemp)
        jq --arg w "$NEXT_WAVE" '.active.current_wave = $w' "$ACTIVE_PLAN_FILE" > "$TMP"
        mv "$TMP" "$ACTIVE_PLAN_FILE"
        echo "Advanced to wave $NEXT_WAVE"
        ;;

    mark-pr-complete)
        PR="$2"
        COMMIT="${3:-}"
        TMP=$(mktemp)
        jq --arg pr "$PR" --arg commit "$COMMIT" \
            '.active.prs[$pr].status = "completed" | .active.prs[$pr].commit = $commit' \
            "$ACTIVE_PLAN_FILE" > "$TMP"
        mv "$TMP" "$ACTIVE_PLAN_FILE"
        echo "Marked $PR completed (commit: $COMMIT)"
        ;;

    *)
        cat >&2 <<EOF
Usage: $0 <command> [args]

Commands:
  info              Show current autopilot state
  next-wave         Print next wave JSON
  pause [reason]    Pause autopilot, save state
  resume            Load paused state
  advance-pr PR     Update current_pr
  advance-wave W    Update current_wave
  mark-pr-complete PR [COMMIT]
EOF
        exit 1
        ;;
esac
