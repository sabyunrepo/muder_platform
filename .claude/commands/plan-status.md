---
description: (sabyun) 현재 active plan 상태 빠른 스냅샷 (wave/PR/task + git 상태)
allowed-tools: Bash(jq*) Bash(git*) Bash(cat*) Bash(sed*) Bash(*/plan-preflight.sh) Bash(*/plan-status.sh*)
---

# Plan Status

## Pre-flight
!`$HOME/.claude/skills/plan-go/scripts/plan-preflight.sh`

**If pre-flight shows ❌, stop and fix settings.json using the recovery steps above.**

## Active plan
!`$HOME/.claude/skills/plan-go/scripts/plan-status.sh --verbose`

## Recent commits
!`git log --oneline -5`

## Uncommitted changes
!`git status --short`

---

Based on the above, summarize:
- Current wave + PR + task
- Recent activity context
- Next recommended action:
  - `in_progress` → continue manually or `/plan-go`
  - `paused` → `/plan-resume`
  - `blocker` → list and suggest manual resolution
