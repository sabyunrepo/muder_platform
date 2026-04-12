#!/usr/bin/env bash
# plan-wave.sh — wave orchestration helper
# Emits the parallel-agent-spawn manifest for a given wave,
# which the Claude orchestrator consumes to spawn sub-agents with isolation:worktree.
#
# Usage:
#   plan-wave.sh manifest WAVE_ID    # print JSON manifest for spawning agents
#   plan-wave.sh validate WAVE_ID    # check scope overlap (parallel wave safety)
#   plan-wave.sh check-deps WAVE_ID  # verify depends_on prior waves completed

set -euo pipefail

ACTIVE_PLAN_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/active-plan.json"
[ -f "$ACTIVE_PLAN_FILE" ] || { echo "No active plan" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq required" >&2; exit 1; }

CMD="${1:-}"
WAVE_ID="${2:-}"

[ -z "$CMD" ] && { echo "Usage: $0 <manifest|validate|check-deps> WAVE_ID" >&2; exit 1; }
[ -z "$WAVE_ID" ] && { echo "WAVE_ID required" >&2; exit 1; }

WAVE_JSON=$(jq --arg w "$WAVE_ID" '.active.waves[] | select(.id == $w)' "$ACTIVE_PLAN_FILE")
[ -z "$WAVE_JSON" ] && { echo "Wave $WAVE_ID not found" >&2; exit 1; }

PLAN_ID=$(jq -r '.active.id' "$ACTIVE_PLAN_FILE")
PLAN_DIR=$(jq -r '.active.dir' "$ACTIVE_PLAN_FILE")
DESIGN=$(jq -r '.active.design' "$ACTIVE_PLAN_FILE")
CHECKLIST=$(jq -r '.active.checklist' "$ACTIVE_PLAN_FILE")

MODE=$(echo "$WAVE_JSON" | jq -r '.mode')
PRS=$(echo "$WAVE_JSON" | jq -r '.prs[]')

case "$CMD" in
    manifest)
        echo "{"
        echo "  \"wave_id\": \"$WAVE_ID\","
        echo "  \"mode\": \"$MODE\","
        echo "  \"plan_id\": \"$PLAN_ID\","
        echo "  \"plan_dir\": \"$PLAN_DIR\","
        echo "  \"design\": \"$DESIGN\","
        echo "  \"checklist\": \"$CHECKLIST\","
        echo "  \"agents\": ["
        FIRST=1
        for pr in $PRS; do
            PR_DATA=$(jq --arg pr "$pr" '.active.prs[$pr]' "$ACTIVE_PLAN_FILE")
            PR_TITLE=$(echo "$PR_DATA" | jq -r '.title')
            PR_SCOPE=$(echo "$PR_DATA" | jq -c '.scope')
            [ $FIRST -eq 0 ] && echo ","
            FIRST=0
            cat <<EOF
    {
      "pr_id": "$pr",
      "title": "$PR_TITLE",
      "scope": $PR_SCOPE,
      "branch": "feat/$PLAN_ID/$pr",
      "subagent_type": "oh-my-claudecode:executor",
      "isolation": "worktree",
      "prompt": "You are executing $pr of plan $PLAN_ID (wave $WAVE_ID, mode $MODE). Read $DESIGN and $CHECKLIST (PR $pr section). Implement all tasks from checklist.md PR $pr section in order. For each task: implement + atomic commit + mark ✅ in checklist. Run after_task pipeline (format + scope test). After all tasks: run after_pr pipeline (full test + lint + 4 parallel reviewers + fix-loop max 3 + commit + push + create PR). Return: {pr_id, branch, commit_hash, status, findings_summary}."
    }
EOF
        done
        echo ""
        echo "  ]"
        echo "}"
        ;;

    validate)
        # Check scope globs don't overlap (parallel mode safety)
        if [ "$MODE" != "parallel" ]; then
            echo "Wave $WAVE_ID is sequential, validation not needed"
            exit 0
        fi
        echo "Checking scope overlaps for parallel wave $WAVE_ID..."
        declare -a ALL_SCOPES
        for pr in $PRS; do
            SCOPES=$(jq -r --arg pr "$pr" '.active.prs[$pr].scope[]?' "$ACTIVE_PLAN_FILE")
            for s in $SCOPES; do
                ALL_SCOPES+=("$pr:$s")
            done
        done

        CONFLICT=0
        for ((i=0; i<${#ALL_SCOPES[@]}; i++)); do
            for ((j=i+1; j<${#ALL_SCOPES[@]}; j++)); do
                A="${ALL_SCOPES[$i]}"
                B="${ALL_SCOPES[$j]}"
                PR_A=$(echo "$A" | cut -d: -f1)
                PR_B=$(echo "$B" | cut -d: -f1)
                SCOPE_A=$(echo "$A" | cut -d: -f2-)
                SCOPE_B=$(echo "$B" | cut -d: -f2-)
                [ "$PR_A" = "$PR_B" ] && continue
                if [ "$SCOPE_A" = "$SCOPE_B" ]; then
                    echo "⚠️  CONFLICT: $PR_A and $PR_B both claim $SCOPE_A" >&2
                    CONFLICT=1
                fi
            done
        done

        if [ $CONFLICT -eq 0 ]; then
            echo "✅ No scope conflicts in wave $WAVE_ID"
        else
            echo "❌ Conflicts found — fix plan or change wave to sequential" >&2
            exit 2
        fi
        ;;

    check-deps)
        # Verify all prior waves are completed
        echo "Checking dependencies for wave $WAVE_ID..."
        PRIOR_WAVES=$(jq --arg w "$WAVE_ID" -r '
            .active.waves as $waves
            | [range(0; $waves|length) as $i | select($waves[$i].id == $w) | $i] as $idxs
            | if ($idxs|length) > 0 then $waves[0:$idxs[0]] else [] end
            | .[] | .id
        ' "$ACTIVE_PLAN_FILE")

        for pw in $PRIOR_WAVES; do
            PWPRS=$(jq -r --arg w "$pw" '.active.waves[] | select(.id == $w) | .prs[]' "$ACTIVE_PLAN_FILE")
            for pr in $PWPRS; do
                STATUS=$(jq -r --arg pr "$pr" '.active.prs[$pr].status // "pending"' "$ACTIVE_PLAN_FILE")
                if [ "$STATUS" != "completed" ]; then
                    echo "❌ Wave $pw PR $pr not completed ($STATUS) — cannot start wave $WAVE_ID" >&2
                    exit 2
                fi
            done
        done
        echo "✅ All prior waves completed, wave $WAVE_ID ready"
        ;;

    *)
        echo "Unknown command: $CMD" >&2
        exit 1
        ;;
esac
