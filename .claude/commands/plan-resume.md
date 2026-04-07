---
description: (sabyun) /clear 후 전체 컨텍스트 복원 — design + plan + checklist + progress + git 한번에 로드
allowed-tools: Read Bash(jq*) Bash(git*)
---

Full context restore — read all plan files and summarize current state.

## Preload live data

### Active plan pointer
!`cat .claude/active-plan.json 2>/dev/null || echo "(no active plan)"`

### Git state
!`git log --oneline -10`
!`git status --short`
!`git branch --show-current`

### Autopilot state (if paused)
!`[ -f .claude/autopilot-state.json ] && cat .claude/autopilot-state.json || echo "(no paused state)"`

---

## Steps

1. Read these files (all — this is the source of truth restore):
   - `<plan.design>` (from active-plan.json)
   - `<plan.plan>`
   - `<plan.checklist>`
   - `<plan.progress_memory>`
   - `.claude/post-task-pipeline.json`
2. Also load current PR's detailed file if it exists:
   - `<plan.dir>/refs/pr-<current_pr>-*.md`
3. Summarize:

```
═══════════════════════════════════════════
 Plan Context Restored
═══════════════════════════════════════════

Phase: <name>
Started: <date> (<commit>)

--- Current Position ---
Wave: <current>/<total>
PR: <current_pr> — <title>
Task: <current_task>
Status: <status>
Branch: <git current branch>

--- Completed ---
<list of ✅ tasks in current PR>
<list of completed PRs>

--- Next ---
<next uncompleted task with file paths>
<next PR in wave if any>
<next wave if current complete>

--- Blockers ---
<list from active-plan.json>

--- Recent Commits ---
<from git log above>

--- Uncommitted ---
<from git status above>

--- Files Reminder ---
Design: <plan.design>
Plan: <plan.plan>
Checklist: <plan.checklist>
Progress: <plan.progress_memory>

--- Scope ---
<list of scope globs>

--- Next Actions ---
1. Continue current task manually
2. /plan-autopilot — resume automated execution
3. /plan-tasks — visual progress
4. /plan-status — quick check
```

**Note**: The act of reading design + checklist above **satisfies the PreToolUse guard** for the next 30 minutes — edits in scope will proceed immediately.
