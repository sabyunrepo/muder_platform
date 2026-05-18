#!/usr/bin/env bash
# Summarize the current MMP workflow state before starting or handing off work.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/mmp-workflow-preflight.sh [--issue <number>] [--json]

Checks:
  - branch and main freshness
  - dirty worktree summary
  - issue number from option, env, or branch
  - issue seed status
  - latest local-ci marker
  - common local server health endpoints

This script is read-only. It does not fetch, checkout, start servers, or edit files.
USAGE
}

json=0
issue="${MMP_ISSUE_NUMBER:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue)
      if [[ -z "${2:-}" ]]; then
        echo "--issue requires a number" >&2
        exit 2
      fi
      issue="${2:-}"
      shift 2
      ;;
    --json)
      json=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing command: $1" >&2
    exit 127
  }
}

require_cmd git

root="$(git rev-parse --show-toplevel)"
cd "$root"

branch="$(git rev-parse --abbrev-ref HEAD)"
head_sha="$(git rev-parse --short HEAD)"
upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
dirty_count="$(git status --porcelain | wc -l | tr -d ' ')"
dirty_sample="$(git status --short | sed -n '1,12p')"

if [[ -z "$issue" && "$branch" =~ (^|/)issue-([0-9]+)($|[^0-9]) ]]; then
  issue="${BASH_REMATCH[2]}"
fi

ahead="unknown"
behind="unknown"
if [[ -n "$upstream" ]]; then
  counts="$(git rev-list --left-right --count "$upstream"...HEAD 2>/dev/null || true)"
  if [[ -n "$counts" ]]; then
    behind="$(printf '%s' "$counts" | awk '{print $1}')"
    ahead="$(printf '%s' "$counts" | awk '{print $2}')"
  fi
fi

git_common_dir="$(git rev-parse --git-common-dir)"
seed_status="not-detected"
seed_path=""
if [[ -n "$issue" ]]; then
  seed_path="$git_common_dir/mmp-workflow/seeds/issue-${issue}.json"
  if [[ -f "$seed_path" ]] && command -v jq >/dev/null 2>&1; then
    seed_status="$(jq -r '.status // "unknown"' "$seed_path")"
  elif [[ -f "$seed_path" ]]; then
    seed_status="exists"
  else
    seed_status="missing"
  fi
fi

local_ci_marker="$git_common_dir/mmp-local-ci/last-run.json"
local_ci_summary="missing"
if [[ -f "$local_ci_marker" ]] && command -v jq >/dev/null 2>&1; then
  local_ci_summary="$(jq -r '"\(.mode // "unknown")/\(.status // "unknown") head=\(.head // "unknown") at=\(.finished_at // "unknown")"' "$local_ci_marker")"
elif [[ -f "$local_ci_marker" ]]; then
  local_ci_summary="exists"
fi

check_url() {
  local url="$1"
  if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 1 "$url" >/dev/null 2>&1; then
    printf 'up'
  else
    printf 'down'
  fi
}

backend_health="$(check_url http://localhost:8080/health)"
web_health="$(check_url http://localhost:3000)"

if (( json == 1 )); then
  if command -v jq >/dev/null 2>&1; then
    jq -n \
      --arg root "$root" \
      --arg branch "$branch" \
      --arg head "$head_sha" \
      --arg upstream "$upstream" \
      --arg ahead "$ahead" \
      --arg behind "$behind" \
      --arg dirty "$dirty_count" \
      --arg issue "$issue" \
      --arg seed_status "$seed_status" \
      --arg seed_path "$seed_path" \
      --arg local_ci "$local_ci_summary" \
      --arg backend "$backend_health" \
      --arg web "$web_health" \
      '{
        root:$root,
        branch:$branch,
        head:$head,
        upstream:$upstream,
        ahead:($ahead|tonumber? // $ahead),
        behind:($behind|tonumber? // $behind),
        dirty_count:($dirty|tonumber),
        issue:($issue|tonumber? // $issue),
        seed:{status:$seed_status,path:$seed_path},
        local_ci:$local_ci,
        health:{backend:$backend,web:$web}
      }'
    exit 0
  fi
  echo "--json requires jq" >&2
  exit 127
fi

cat <<EOF
# MMP Workflow Preflight

- root: $root
- branch: $branch ($head_sha)
- upstream: ${upstream:-none}
- ahead/behind: $ahead/$behind
- dirty files: $dirty_count
- issue: ${issue:-not detected}
- seed: $seed_status${seed_path:+ ($seed_path)}
- local-ci: $local_ci_summary
- backend health: $backend_health (http://localhost:8080/health)
- web health: $web_health (http://localhost:3000)
EOF

if [[ "$dirty_count" != "0" ]]; then
  cat <<EOF

Dirty sample:
$dirty_sample
EOF
fi
