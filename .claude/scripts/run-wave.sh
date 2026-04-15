#!/usr/bin/env bash
# mmp-pilot run-wave — wave 매니페스트 생성 + worktree 관리 래퍼
# M1 단계: $HOME/.claude/skills/plan-autopilot/scripts/plan-wave.sh 를 재사용하고
#           .claude/runs/{run-id}/ 경로 주입만 담당
set -euo pipefail

APLAN=".claude/active-plan.json"
RUNS_DIR=".claude/runs"
AUTOPILOT_WAVE="$HOME/.claude/skills/plan-autopilot/scripts/plan-wave.sh"

cmd="${1:-help}"; shift || true

gen_run_id() { echo "r-$(date -u +%Y%m%d-%H%M%S)-$(openssl rand -hex 2)"; }

active_phase() { jq -r '.active.id' "$APLAN"; }

wave_prs() {
  local wave="$1"
  jq -r --arg w "$wave" '.active.waves[] | select(.id==$w) | .prs[]' "$APLAN"
}

wave_mode() {
  local wave="$1"
  jq -r --arg w "$wave" '.active.waves[] | select(.id==$w) | .mode // "sequential"' "$APLAN"
}

case "$cmd" in
  new-run)
    id=$(gen_run_id)
    mkdir -p "$RUNS_DIR/$id"
    jq --arg id "$id" '.active.current_run_id=$id | .active.runs[$id]={started_at:(now|todate),mode:"wave",state:"initialized"}' "$APLAN" > "${APLAN}.tmp" && mv "${APLAN}.tmp" "$APLAN"
    echo "$id"
    ;;

  manifest)
    run_id="${1:?run-id}"; shift
    waves_arg="${*:-}"
    out="$RUNS_DIR/$run_id/manifest.json"
    mkdir -p "$RUNS_DIR/$run_id"
    if [[ -z "$waves_arg" ]]; then
      current=$(jq -r '.active.current_wave' "$APLAN")
      waves=$(jq -r --arg c "$current" '.active.waves[] | select(.id>=$c) | .id' "$APLAN" | jq -Rs 'split("\n")|map(select(.!=""))')
    else
      waves=$(echo "$waves_arg" | jq -Rs 'split(" ")|map(select(.!=""))')
    fi
    jq -n --arg run_id "$run_id" --arg t "$(date -u +%FT%TZ)" --argjson waves "$waves" \
      '{run_id:$run_id,started_at:$t,mode:"wave",waves:$waves,tasks_override:null,flags:{}}' > "$out"
    echo "$out"
    ;;

  create-worktrees)
    run_id="${1:?run-id}"; wave="${2:?wave}"
    phase=$(active_phase)
    for pr in $(wave_prs "$wave"); do
      base=".claude/worktrees/${phase}-${wave}-${pr}"
      branch="pilot/${run_id}/${wave}/${pr}"
      [[ -d "$base" ]] && { echo "exists: $base"; continue; }
      git worktree add -b "$branch" "$base" main
      mkdir -p "$RUNS_DIR/$run_id/$wave/$pr"
      echo "worktree: $base  branch: $branch"
    done
    ;;

  validate)
    wave="${1:?wave}"
    mode=$(wave_mode "$wave")
    if [[ "$mode" == "parallel" ]]; then
      # scope 겹침 체크 — 동일 경로가 2개 이상 PR에 할당되면 경고
      dup=$(jq -r --arg w "$wave" '
        .active.waves[] | select(.id==$w) | .prs[]' "$APLAN" | sort | uniq -d)
      [[ -n "$dup" ]] && { echo "ERR: PR 중복 $dup" >&2; exit 2; }
    fi
    echo "validated: $wave ($mode)"
    ;;

  merge)
    run_id="${1:?run-id}"; wave="${2:?wave}"
    phase=$(active_phase)
    for pr in $(wave_prs "$wave"); do
      base=".claude/worktrees/${phase}-${wave}-${pr}"
      branch="pilot/${run_id}/${wave}/${pr}"
      [[ -d "$base" ]] || { echo "skip (no worktree): $pr"; continue; }
      git -C "$base" add -A
      git -C "$base" diff --cached --quiet || git -C "$base" commit -m "pilot(${wave}/${pr}): auto"
      git merge --ff-only "$branch" || { echo "ERR: non-ff merge for $pr"; exit 3; }
      git worktree remove "$base"
      git branch -d "$branch" || true
    done
    echo "merged: $wave"
    ;;

  abort)
    run_id="${1:?run-id}"; wave="${2:?wave}"
    phase=$(active_phase)
    for pr in $(wave_prs "$wave"); do
      base=".claude/worktrees/${phase}-${wave}-${pr}"
      branch="pilot/${run_id}/${wave}/${pr}"
      [[ -d "$base" ]] && git worktree remove --force "$base" || true
      git branch -D "$branch" 2>/dev/null || true
    done
    git worktree prune
    echo "aborted: $wave"
    ;;

  *)
    cat <<EOF
usage: run-wave.sh <cmd> [args]
  new-run                           신규 run_id 생성 + active-plan 등록
  manifest <run-id> [waves...]      manifest.json 생성
  create-worktrees <run-id> <wave>  parallel wave worktree 생성
  validate <wave>                   PR 중복/scope 검증
  merge <run-id> <wave>             ff-only 머지 + worktree 정리
  abort <run-id> <wave>             worktree/브랜치 강제 정리
EOF
    ;;
esac
