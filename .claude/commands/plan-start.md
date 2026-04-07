---
description: (sabyun) 플랜 디렉터리를 현재 active plan으로 활성화
argument-hint: <plan-directory>
allowed-tools: Read Write Bash(git*) Bash(jq*) Bash(mv*) Bash(mkdir*)
---

Activate plan at `$ARGUMENTS` as the current active plan.

## Steps

1. Verify `$ARGUMENTS/design.md` exists. If not, error out.
2. Read `$ARGUMENTS/design.md` to extract:
   - Phase name (from `# <title>` line)
   - Phase id (derive from directory basename: e.g., `phase-8.0-engine-integration`)
   - Scope globs (from refs/scope-and-decisions.md or design.md "Scope" section)
   - Wave structure (from refs/execution-model.md)
3. Read `$ARGUMENTS/plan.md` for PR list.
4. Read `$ARGUMENTS/checklist.md` — verify STATUS marker present. Warn if missing.
5. Check for existing `.claude/active-plan.json`:
   - If exists: offer to archive (`mv to .claude/archived_plans/<old-id>.json`) or abort.
6. Generate `.claude/active-plan.json` from template `~/.claude/skills/plan-autopilot/templates/active-plan.template.json`:
   - `id`, `name`, `dir`, `design`, `plan`, `checklist`, `progress_memory`
   - `scope`: extracted globs
   - `started_at`: today
   - `started_commit`: `git rev-parse --short HEAD`
   - `current_wave`: first wave id
   - `current_pr`: first PR id in first wave
   - `current_task`: first unchecked task from checklist
   - `status`: "in_progress"
   - `waves`: array from design
   - `prs`: object from plan
7. Write file.
8. Confirm:

```
✅ Activated: <name>
Current: <wave> <pr>
Next task: <task>

Hooks are now active:
- SessionStart injects STATUS (~30 lines)
- UserPromptSubmit injects 1-line STATUS (~25 tokens)
- PreToolUse BLOCKS edits in scope until design+checklist read
- PostToolUse reminds to update checklist

Run /plan-autopilot to begin wave execution.
Run /plan-status to verify.
```
