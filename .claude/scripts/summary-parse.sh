#!/usr/bin/env bash
# mmp-pilot summary-parse — SUMMARY.md frontmatter를 파싱해
# checklist.md 체크 + progress.md 갱신 + metrics.jsonl append
set -euo pipefail

APLAN=".claude/active-plan.json"
RUNS_DIR=".claude/runs"
METRICS="memory/mmp-pilot-metrics.jsonl"

run_id="${1:?run-id}"; wave="${2:?wave}"

CHECKLIST=$(jq -r '.active.checklist' "$APLAN")
PROGRESS=$(jq -r '.active.progress_memory' "$APLAN")
mkdir -p "$(dirname "$METRICS")"
touch "$METRICS"

extract_frontmatter() {
  awk 'BEGIN{p=0} /^---$/{p++;next} p==1{print}' "$1"
}

yq_get() {
  local file="$1" key="$2"
  extract_frontmatter "$file" | awk -v k="$key:" '$1==k {sub(/^[^:]+:[[:space:]]*/,""); print; exit}'
}

for summary in "$RUNS_DIR/$run_id/$wave"/*/*/SUMMARY.md; do
  [[ -f "$summary" ]] || continue
  pr=$(basename "$(dirname "$(dirname "$summary")")")
  task_dir=$(basename "$(dirname "$summary")")
  task=$(yq_get "$summary" "task" | tr -d '"')
  status=$(yq_get "$summary" "status")
  duration=$(yq_get "$summary" "duration_sec")
  tests_failed=$(extract_frontmatter "$summary" | awk '/^tests:/{f=1;next} f && /^[^ ]/{f=0} f && /failed:/{sub(/.*failed:[[:space:]]*/,"");print;exit}')
  cov=$(extract_frontmatter "$summary" | awk '/^tests:/{f=1;next} f && /^[^ ]/{f=0} f && /coverage_delta:/{sub(/.*coverage_delta:[[:space:]]*/,"");gsub(/"/,"");print;exit}')
  blockers=$(extract_frontmatter "$summary" | awk '/^security:/{f=1;next} f && /^[^ ]/{f=0} f && /blockers:/{sub(/.*blockers:[[:space:]]*/,"");print;exit}')

  echo "parsed: $wave/$pr/$task_dir status=$status"

  # checklist 체크 (status=completed 일 때만)
  if [[ "$status" == "completed" && -f "$CHECKLIST" ]]; then
    esc=$(echo "$task" | sed 's/[][\/.*]/\\&/g')
    sed -i.bak "s/- \[ \] $esc/- [x] $esc/" "$CHECKLIST" && rm -f "${CHECKLIST}.bak" || true
  fi

  # progress append
  {
    echo ""
    echo "## $wave / $pr / $task_dir — $status ($(date -u +%FT%TZ))"
    echo "- task: $task"
    echo "- duration: ${duration}s · tests_failed: ${tests_failed:-0} · coverage_delta: ${cov:-0}"
    [[ "$blockers" != "[]" && -n "$blockers" ]] && echo "- ⚠️ blockers: $blockers"
  } >> "$PROGRESS"

  # metrics jsonl append
  jq -n --arg run_id "$run_id" --arg wave "$wave" --arg pr "$pr" --arg task "$task" \
        --arg status "$status" --arg t "$(date -u +%FT%TZ)" \
        --argjson duration "${duration:-0}" --arg cov "${cov:-0}" \
        '{ts:$t,run_id:$run_id,mode:"wave",wave:$wave,pr:$pr,task:$task,status:$status,duration_sec:$duration,coverage_delta:$cov}' >> "$METRICS"
done

echo "done: $wave"
