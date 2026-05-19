---
name: mmp-agentic-delivery-chain
description: Use when MMP work requires OOO, subagents, harness engineering, strict role separation, independent review or validation, or issue-to-PR execution.
---

# MMP Agentic Delivery Chain

This skill is the entrypoint for MMP work that must be executed through agent handoffs instead of direct main-thread implementation.

## Trigger

Use this when the user asks for OOO, subagents, harness engineering, strict role separation, issue-to-PR execution, or "do not review/validate your own work".

## Chain

1. Preflight:
   - Run `scripts/mmp-workflow-preflight.sh` when practical.
   - Work on a feature/chore branch or separate worktree.
2. Requirements:
   - Use `deep-interview` first when goal, scope, exclusions, constraints, or done criteria are unclear.
   - Run OOO interview/refinement only after the deep-interview brief or an explicit safe default exists.
   - Keep OOO bounded to the accepted brief; cancel or salvage if it widens scope.
3. Tracking:
   - Create or update a GitHub issue with `mmp-issue-planning`.
   - Create/approve the local seed when PR guard requires it.
   - The issue/seed must include objective, scope in/out, exclusions, done criteria, Coverage Plan, validation plan, and E2E/browser QA expectations when UI is involved.
4. Delegation:
   - Main Codex owns orchestration. `.codex/config.toml` uses `max_depth = 1`, so subagents must not spawn follow-up agents.
   - Each agent returns `next_agent`, `handoff`, `checklist_delta`, and `evidence`; main Codex decides the next spawn.
   - Use `mmp-parallel-coordinator` first for non-trivial splits.
5. Implementation:
   - Assign explicit file/module ownership.
   - Implementers may run focused checks for their slice, but cannot be final reviewers or final validators for their own work.
6. Review and validation:
   - Run independent validation with `mmp-local-validation-runner` or a relevant reviewer lane.
   - Run independent review by axis: frontend, backend, test coverage, security, performance, or docs/workflow.
   - If fixes are needed, assign a different fixer where practical. For tiny one- or two-file urgent fixes, main Codex may patch directly and must state the exception.
   - After the last fix, rerun independent validation and the relevant independent review before PR creation or merge judgment.
7. PR:
   - Main Codex creates PRs, decides scope, and merges.
   - Use `mmp-pr-lifecycle`.
   - `mmp-ci-steward` may handle CodeRabbit waiting, valid review fixes, and focused validation on a handed-off PR, but does not create or merge PRs.

## Required Handoff Fields

```md
next_agent:
handoff:
checklist_delta:
evidence:
```

`evidence` should name changed files, commands, exit status, browser surface, screenshots, logs, or review findings. For UI work, include the E2E plan and cmux/browser QA evidence or the documented substitute.

## Stop Conditions

- OOO or a subagent expands beyond accepted scope.
- Two agents would edit the same file or shared contract at the same time.
- An implementer is about to be used as final reviewer or final validator.
- Final validation/review has not rerun after the last fix.
- PR creation, label, or merge authority is being delegated away from main Codex.

## Done

- Issue/seed/checklist can reproduce the chain.
- Each delegated result has the four handoff fields.
- Final validation and review are independent and post-fix.
- PR/merge ownership remains with main Codex.
