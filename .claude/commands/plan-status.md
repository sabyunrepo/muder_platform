---
description: (sabyun) 현재 active plan 상태 빠른 스냅샷 (wave/PR/task + git 상태)
allowed-tools: Bash(jq*) Bash(git*) Bash(cat*) Bash(sed*)
---

# Plan Status

## Active plan
!`~/.claude/skills/plan-autopilot/scripts/plan-status.sh --verbose`

## Recent commits
!`git log --oneline -5`

## Uncommitted changes
!`git status --short`

## Autopilot state (if paused)
!`[ -f .claude/autopilot-state.json ] && cat .claude/autopilot-state.json || echo "(no paused state)"`

---

Based on the above, summarize:
- Current wave + PR + task
- Recent activity context
- Next recommended action:
  - `in_progress` → continue manually or `/plan-autopilot`
  - `paused` → `/plan-resume`
  - `blocker` → list and suggest manual resolution
