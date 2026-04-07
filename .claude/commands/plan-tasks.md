---
description: (sabyun) Task 트리 + 진행률 % 시각화 (wave/PR별 상태 아이콘)
allowed-tools: Bash(jq*) Bash(grep*) Bash(wc*) Bash(find*)
---

# Plan Tasks

!`~/.claude/skills/plan-autopilot/scripts/plan-tasks.sh`

---

Based on the tree above, highlight:
- Current wave + PR (🔄 icon)
- Next uncompleted task with file path suggestion
- Blockers in any wave
- Estimated remaining work

Suggest next action:
- `/plan-autopilot` — start/resume automated execution
- `/plan-status` — quick state check
- `/plan-resume` — full context restore after /clear
