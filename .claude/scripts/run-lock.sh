#!/usr/bin/env bash
# mmp-pilot run-lock — 동시 실행 제어 + heartbeat + stale 복구
set -euo pipefail

LOCK=".claude/run-lock.json"
STALE_MIN=${STALE_MIN:-60}

cmd="${1:-check}"; shift || true

now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
epoch() { date -u +%s; }

case "$cmd" in
  check)
    [[ -f "$LOCK" ]] || { echo "idle"; exit 0; }
    last=$(jq -r '.last_heartbeat // .acquired_at' "$LOCK")
    age=$(( $(epoch) - $(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$last" +%s 2>/dev/null || date -u -d "$last" +%s) ))
    if (( age > STALE_MIN * 60 )); then echo "stale"; else echo "locked"; fi
    ;;
  acquire)
    run_id="${1:?run_id}"; wave="${2:-}"; pr="${3:-}"; task="${4:-}"
    state=$("$0" check)
    [[ "$state" == "locked" ]] && { echo "ERR: locked by $(jq -r .run_id "$LOCK")" >&2; exit 2; }
    jq -n --arg run_id "$run_id" --arg t "$(now)" --argjson pid "$$" \
          --arg wave "$wave" --arg pr "$pr" --arg task "$task" \
          '{owner_pid:$pid,run_id:$run_id,acquired_at:$t,last_heartbeat:$t,wave:$wave,pr:$pr,task:$task,worktree:null,ab_experiment:null}' > "$LOCK"
    echo "acquired: $run_id"
    ;;
  heartbeat)
    [[ -f "$LOCK" ]] || exit 0
    tmp=$(mktemp); jq --arg t "$(now)" '.last_heartbeat=$t' "$LOCK" > "$tmp" && mv "$tmp" "$LOCK"
    ;;
  release)
    rm -f "$LOCK"; echo "released"
    ;;
  force-unlock)
    [[ -f "$LOCK" ]] && { cp "$LOCK" "${LOCK}.stale.$(epoch)"; rm -f "$LOCK"; echo "forced (backup saved)"; } || echo "no lock"
    ;;
  info)
    [[ -f "$LOCK" ]] && cat "$LOCK" || echo "{}"
    ;;
  *)
    echo "usage: run-lock.sh {check|acquire <run-id> [wave] [pr] [task]|heartbeat|release|force-unlock|info}" >&2
    exit 1 ;;
esac
