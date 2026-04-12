#!/usr/bin/env bash
# run-pipeline.sh — executes stages from post-task-pipeline.json
# Usage:
#   run-pipeline.sh --stage after_task    # run all stages in after_task
#   run-pipeline.sh --stage after_pr      # run after_pr stages (with parallel groups)
#   run-pipeline.sh --stage after_wave
#   run-pipeline.sh --stage after_plan
#   run-pipeline.sh --merge-wave WAVE_ID  # sequential merge of wave's PR branches
#
# Note: stages of type "subagent", "skill", or "internal" are NOT executed by this
# shell script — they require Claude's tool runtime. This script handles type "shell"
# and prints manifests for other types so the autopilot orchestrator can spawn them.

set -euo pipefail

PIPELINE_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/post-task-pipeline.json"
ACTIVE_PLAN_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/active-plan.json"

[ -f "$PIPELINE_FILE" ] || { echo "ERROR: $PIPELINE_FILE not found" >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq required" >&2; exit 1; }

STAGE=""
MERGE_WAVE=""

while [ $# -gt 0 ]; do
    case "$1" in
        --stage) STAGE="$2"; shift 2 ;;
        --merge-wave) MERGE_WAVE="$2"; shift 2 ;;
        *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
done

# --merge-wave: sequential merge of wave's PR branches
if [ -n "$MERGE_WAVE" ]; then
    PLAN_ID=$(jq -r '.active.id // empty' "$ACTIVE_PLAN_FILE")
    echo "=== Merging Wave $MERGE_WAVE PRs sequentially ==="
    PRS=$(jq -r ".active.waves[] | select(.id == \"$MERGE_WAVE\") | .prs[]" "$ACTIVE_PLAN_FILE")
    for pr in $PRS; do
        BRANCH="feat/$PLAN_ID/$pr"
        echo "--- Merging $pr ($BRANCH) ---"
        git fetch origin "$BRANCH" 2>/dev/null || true
        if git merge --no-ff "$BRANCH" -m "merge($PLAN_ID): $pr"; then
            echo "✅ $pr merged"
            # Re-run tests
            if (cd apps/server && go test -race -count=1 ./... 2>&1); then
                echo "✅ tests pass after $pr merge"
            else
                echo "❌ tests fail after $pr merge — abort" >&2
                exit 2
            fi
        else
            echo "❌ merge conflict for $pr — manual resolution required" >&2
            exit 2
        fi
    done
    echo "=== Wave $MERGE_WAVE merge complete ==="
    exit 0
fi

# --stage: execute stages
[ -n "$STAGE" ] || { echo "Usage: $0 --stage <after_task|after_pr|after_wave|after_plan>" >&2; exit 1; }

echo "=== Running pipeline stage: $STAGE ==="

STAGE_COUNT=$(jq -r ".${STAGE} // [] | length" "$PIPELINE_FILE")
if [ "$STAGE_COUNT" -eq 0 ]; then
    echo "No stages defined for $STAGE"
    exit 0
fi

# Process stages sequentially, group parallel_group stages together
for ((i=0; i<STAGE_COUNT; i++)); do
    STAGE_JSON=$(jq -c ".${STAGE}[$i]" "$PIPELINE_FILE")
    NAME=$(echo "$STAGE_JSON" | jq -r '.name')
    TYPE=$(echo "$STAGE_JSON" | jq -r '.type // "shell"')
    BLOCKING=$(echo "$STAGE_JSON" | jq -r '.blocking // true')
    ON_FAIL=$(echo "$STAGE_JSON" | jq -r '.on_fail // "stop"')

    echo ""
    echo "--- [$((i+1))/$STAGE_COUNT] $NAME ($TYPE) ---"

    case "$TYPE" in
        shell)
            CMD=$(echo "$STAGE_JSON" | jq -r '.command')
            if eval "$CMD"; then
                echo "✅ $NAME passed"
            else
                RC=$?
                echo "❌ $NAME failed (rc=$RC)" >&2
                case "$ON_FAIL" in
                    stop) exit 2 ;;
                    fix_loop) echo "FIX_LOOP_TRIGGER: $NAME" >&2; exit 3 ;;
                    continue) echo "Continuing despite failure" >&2 ;;
                    warn) echo "WARN: $NAME failed but proceeding" >&2 ;;
                esac
            fi
            ;;

        subagent|skill|slash|internal)
            # Not executable by shell — emit manifest for orchestrator
            echo "MANIFEST_EMIT: $STAGE_JSON"
            ;;

        *)
            echo "Unknown stage type: $TYPE" >&2
            ;;
    esac
done

echo ""
echo "=== Stage $STAGE complete ==="
exit 0
