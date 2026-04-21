---
description: (sabyun) Task 트리 + 진행률 % 시각화 (wave/PR별 상태 아이콘)
allowed-tools: Bash(jq*) Bash(grep*) Bash(wc*) Bash(find*) Bash(*/plan-preflight.sh) Bash(*/plan-tasks.sh)
---

# Plan Tasks

## Pre-flight
!`$CLAUDE_PROJECT_DIR/.claude/scripts/plan-preflight.sh`

**If pre-flight shows ❌, stop and fix settings.json first.**

## Task tree
!`$CLAUDE_PROJECT_DIR/.claude/scripts/plan-tasks.sh`

---

Based on the tree above, highlight:
- Current wave + PR (🔄 icon)
- Next uncompleted task with file path suggestion
- Blockers in any wave
- Estimated remaining work

Suggest next action:
- `/plan-go` — start/resume automated execution
- `/plan-status` — quick state check
- `/plan-resume` — full context restore after /clear
