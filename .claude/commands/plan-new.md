---
description: (sabyun) 새 phase 플랜 저작 — brainstorming + writing-plans + plan-autopilot 템플릿 통합
argument-hint: <topic>
allowed-tools: Read Write Edit Bash(mkdir*) Bash(git*) Bash(cp*) Bash(wc*)
---

Start a new phase plan for: **$ARGUMENTS**

Follow this workflow strictly.

## Stage 1: Brainstorming

Invoke `superpowers:brainstorming` with guardrails:
- Output must fit plan-autopilot format (wave-based DAG)
- Identify PR-level dependencies explicitly
- Specify scope_globs per PR
- Determine parallel vs sequential waves
- All docs <200 lines (index + refs pattern)
- Cover 7 standard decisions:
  1. Scope (what's in/out)
  2. Architecture pattern
  3. Lifecycle (create/destroy/transition)
  4. External interface
  5. Persistence/state
  6. Operational safety (panic, observability, tests)
  7. Rollout strategy (feature flag + waves)

Wait for user approval of design before proceeding.

## Stage 2: Plan writing

Invoke `superpowers:writing-plans` with:
- Design path from stage 1
- PR breakdown with id/title/depends_on/scope_globs/tasks
- Wave grouping (topological sort)
- Each PR plan file <200 lines
- Task granularity: one commit per task

## Stage 3: Template materialization

Create `docs/plans/YYYY-MM-DD-<slug>/`.

Copy from `~/.claude/skills/plan-autopilot/templates/`:
- `design.index.template.md` → `design.md`
- `plan.index.template.md` → `plan.md`
- `checklist.index.template.md` → `checklist.md` (STATUS marker at top!)
- Create `refs/pr-N-<slug>.md` per PR

Also create from brainstorming output:
- `refs/scope-and-decisions.md`
- `refs/architecture.md`
- `refs/execution-model.md` (**required** — wave DAG)
- `refs/observability-testing.md`
- `refs/data-flow.md` (optional)
- `refs/persistence.md` (optional)

## Stage 4: Quality gates

Before success:
- [ ] All .md files <200 lines (`find docs/plans/YYYY-MM-DD-<slug> -name '*.md' | xargs wc -l | awk '$1>200{print}'` → empty)
- [ ] STATUS marker in checklist.md
- [ ] Dependency graph is valid DAG
- [ ] Each PR has ≥1 task
- [ ] scope_globs cover all files

## Stage 5: Initial commit

```bash
git add docs/plans/YYYY-MM-DD-<slug>/
git commit -m "docs(<phase-id>): initial plan — design + plan + checklist"
```

Report path. Next:
- `/plan-start docs/plans/YYYY-MM-DD-<slug>` to activate
- `/plan-autopilot` to execute

**Skill reference**: `~/.claude/skills/plan-autopilot/refs/authoring.md`
