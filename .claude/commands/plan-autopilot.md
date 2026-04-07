---
description: Run wave-based autopilot execution loop
argument-hint: [--until WAVE] [--only PR-N] [--dry-run]
---

Execute the active plan using wave-based parallel sub-agents.

## Prerequisites check

1. Verify `.claude/active-plan.json` exists. If not: report "Run /plan-start first" and exit.
2. Verify `.claude/post-task-pipeline.json` exists. If not: offer to copy from template.
3. Verify design.md, plan.md, checklist.md paths resolve. If not: error.
4. Check git working directory is clean (or near-clean). If dirty: warn + ask to proceed.

## Parse arguments

- `--until WAVE`: run waves up to and including WAVE
- `--only PR-N`: run only one PR (useful for debugging)
- `--dry-run`: print wave manifests without executing

## Execution loop

For each wave in `.active.waves` (starting from current_wave):

### 1. Pre-wave checks
```bash
.claude/scripts/plan-wave.sh check-deps <wave.id>
.claude/scripts/plan-wave.sh validate <wave.id>   # if parallel, check scope overlaps
```

### 2. Generate manifest
```bash
.claude/scripts/plan-wave.sh manifest <wave.id>
```

### 3. Spawn sub-agents (THIS IS THE KEY STEP)

**Parallel wave**: In ONE message, use multiple Agent tool calls with `isolation: "worktree"`:
```
Agent(subagent_type="oh-my-claudecode:executor",
      isolation="worktree",
      prompt=<from manifest>)
Agent(subagent_type="oh-my-claudecode:executor",
      isolation="worktree",
      prompt=<from manifest>)
...
```
(All agent calls in the SAME message = true parallelism)

**Sequential wave**: One Agent call per PR, wait for completion before next.

### 4. Collect results

Each sub-agent returns: `{pr_id, branch, commit_hash, status, findings_summary}`

Aggregate into wave summary.

### 5. Sequential merge with test gate

```bash
.claude/scripts/run-pipeline.sh --merge-wave <wave.id>
```

This runs `git merge` for each PR's branch in order, running `go test -race` between merges.

On merge conflict: spawn Agent(subagent_type="oh-my-claudecode:executor") with prompt to resolve.

### 6. Wave gate (user confirmation)

Read `global.require_user_confirm_before_merge` from pipeline config. If true (default):

```
═══════════════════════════════════════════
 Wave <N> Complete
═══════════════════════════════════════════
PRs merged: <list with commit hashes>
Tests: PASS
Duration: <elapsed>
Findings resolved: <count>

Continue to Wave <N+1>? [y/n/pause]
```

- `y`: advance wave, continue loop
- `n`: stop autopilot
- `pause`: save state to `.claude/autopilot-state.json`, exit

### 7. Update active-plan.json

```bash
.claude/scripts/autopilot-loop.sh advance-wave <next.wave.id>
```

### 8. Continue or terminate

If more waves remain → next iteration.
If last wave complete → run `after_plan` pipeline:
- `/plan-finish`
- Notification message

## Inside each sub-agent (reference only — the agent itself handles this)

The spawned sub-agent's prompt (from `plan-wave.sh manifest`) instructs it to:
1. Read design.md + checklist PR section
2. Implement tasks in order, atomic commits
3. Run `after_task` pipeline (format + scope test) per task
4. Mark ✅ in checklist per task
5. After all tasks: run `after_pr` pipeline (full test + lint + 4 parallel reviewers + fix-loop ≤3 + commit + push + create PR)
6. Return result

## Fix-loop (inside sub-agent)

If any review finds CRITICAL/HIGH:
- iteration 1: spawn executor to fix
- iteration 2: re-run 4 reviewers, if still findings → spawn executor
- iteration 3: final attempt
- iteration > 3: pause + report

## Failure handling

- Pre-check fail → exit with message
- Sub-agent error → save state, report
- Merge conflict → auto-resolve attempt, then user
- CI failure (after push) → wait max 30min, then pause
- Fix-loop exhausted → hard pause, `/plan-resume` later

## Important

- **Always use `isolation: "worktree"`** for parallel wave agents — file conflicts are guaranteed otherwise
- **Batch all parallel Agent calls in ONE message** — sequential tool_use is not parallel
- **Respect 200-line limit** — remind sub-agents in the spawn prompt
- **STATUS marker updates** — sub-agents must update checklist.md's STATUS marker after task completion

**Skill reference**: `~/.claude/skills/plan-autopilot/refs/execution.md`
