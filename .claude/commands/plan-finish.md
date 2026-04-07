---
description: (sabyun) 현재 active plan을 완료 처리하고 archive
allowed-tools: Read Write Bash(jq*) Bash(git*) Bash(mv*) Bash(mkdir*) Bash(rm*)
---

Archive current active plan as completed.

## Steps

1. Read `.claude/active-plan.json`. If absent: report "No active plan" and exit.
2. Read active checklist.md. Count completed vs total tasks:
   - If NOT all completed: warn user with count, ask "Force finish anyway? [y/n]"
   - Note force-finished status if applicable
3. Enrich plan data with completion metadata:
   ```json
   {
     "id": "<plan.id>",
     "name": "<plan.name>",
     "started_at": "<plan.started_at>",
     "finished_at": "<today>",
     "final_commit": "<git rev-parse --short HEAD>",
     "tasks_done": N,
     "tasks_total": M,
     "force_finished": false
   }
   ```
4. Move to archive:
   ```bash
   mkdir -p .claude/archived_plans
   mv .claude/active-plan.json .claude/archived_plans/<plan.id>.json
   ```
5. Update root phase checklist — mark phase ✅.
6. Update memory files:
   - `memory/project_phases.md`: move to completed
   - `memory/project_phaseNN_progress.md`: final state
   - `memory/MEMORY.md`: remove active pointer
7. Suggest commit:
   ```
   Ready to commit:
     git add .claude/archived_plans/<plan.id>.json memory/ docs/plans/*/checklist.md
     git commit -m "chore: archive <plan.id> as completed"

   Hooks now inactive (active-plan.json absent). Normal workflow restored.
   Suggested next: /plan-new <topic> for follow-up phase
   ```
