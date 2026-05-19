---
name: mmp-subagent-orchestration
description: Use when executing MMP work under the user-approved main-Codex-as-orchestrator model, where implementation, review, validation, PR stewardship, or wrap-up should be delegated to MMP subagents while main Codex owns decisions.
---

# MMP Subagent Orchestration

## When

- The user asks to use subagents, delegation, parallel agents, or the MMP headquarter/orchestrator workflow.
- A task involves meaningful implementation, review, long validation, PR stewardship, or session wrap-up.
- The main Codex context should stay focused on intent, scope, risk, integration, and final judgment.

## Do

1. Main Codex owns the task ledger:
   - goal, issue/plan link, scope, exclusions, Coverage Plan, file/module ownership, stop conditions, and validation gate.
   - Write executable work items as Markdown checkboxes (`- [ ]`) and update completed items to `- [x]` as agents report verified completion.
   - Include the checkbox ledger in subagent handoffs when the agent owns multiple steps, so the agent can report which items are done, blocked, or deferred.
   - Because `.codex/config.toml` sets `max_depth = 1`, subagents must not call the next agent. They return `next_agent`, `handoff`, `checklist_delta`, and `evidence`; main Codex decides and spawns the next step.
   - Standard handoff fields:
     - `next_agent`: recommended next lane or `none`
     - `handoff`: concise context and exact files/commands for the next lane
     - `checklist_delta`: completed/blocked/deferred checkbox updates
     - `evidence`: changed files, commands, exit status, browser surface, logs, or review findings
2. Start with `mmp-parallel-coordinator` for non-trivial work:
   - use it to split read-heavy audits, write ownership, conflict risks, and integration checkpoints.
3. Start with `mmp-requirements-interviewer` before planning/implementation when the request is still vague:
   - use it to run deep-interview style clarification, mandatory `ouroboros_interview` refinement, and a handoff-ready Execution Brief.
   - keep OOO refinement bounded to the accepted brief; main Codex decides whether to route next to issue planning, parallel coordination, implementation, review, or validation.
4. Delegate implementation by ownership:
   - frontend UI/adapter/tests -> `mmp-frontend-implementer`
   - backend handler/service/engine/migration/tests -> `mmp-backend-implementer`
   - shared DTO/migration/generated client/adapter contract -> `mmp-contract-integrator`
5. Delegate review by axis before PR creation:
   - frontend UX/adapter/E2E readiness -> `mmp-frontend-editor-reviewer`
   - backend/runtime/persistence consistency -> `mmp-backend-engine-reviewer`
   - test/coverage/local validation readiness -> `mmp-test-coverage-reviewer`
   - auth/ownership/redaction/secret risks -> `mmp-security-reviewer`
   - concurrency/query/render/flakiness risks -> `mmp-performance-reviewer`
6. Delegate long checks:
   - use `mmp-local-validation-runner` for focused test/build commands that would flood main context.
   - when local browser QA is explicitly in cmux, instruct validation agents to use the `cmux-browse` skill/CLI first and to report a fallback only if cmux browser control is unavailable.
7. Delegate PR waiting/fix loop:
   - use `mmp-ci-steward` for one handed-off PR after main Codex creates the PR.
   - `mmp-ci-steward` owns review waiting and valid fix stewardship only; PR creation, PR scope changes, labels outside policy, and merge remain main Codex decisions.
8. Delegate wrap-up:
   - use `mmp-docs-wrap-steward` after significant work to propose docs, automation, learning, and follow-up candidates.
9. Main Codex integrates:
   - review subagent output under `발견 / 수행 / 판단 / 미해결`
   - decide which findings are valid
   - make PR/merge/user-facing decisions
   - close completed subagents after collecting final output
10. Enforce independence gates:
   - implementers do not provide the final review or final validation for their own changes.
   - after the final fix, rerun independent validation plus the relevant review lane before PR creation or merge judgment.
   - for relevant UI work, require an E2E plan and browser QA evidence; use cmux first when that is the active or requested browser surface, and record the fallback reason otherwise.

## Done

- Assigned agents, ownership, and stop conditions are explicit.
- The active task ledger uses checkboxes and completed items are checked off before final reporting.
- Implementation agents changed only assigned files.
- Subagents returned `next_agent`, `handoff`, `checklist_delta`, and `evidence` instead of spawning follow-up agents.
- Review and validation evidence is summarized without raw log dumps.
- Final validation/review was performed by an independent lane after the last fix.
- PR creation/merge and product-risk decisions remain with main Codex.

## Avoid

- Do not delegate secrets, destructive commands, deploys, broad contract decisions, PR creation, or final merge.
- Do not assign two write agents to the same file, API DTO, migration, adapter mapping, route file, or generated contract at the same time.
- Do not use subagents for tiny one-file judgment tasks when delegation overhead is larger than the work, unless the user explicitly asks for strict headquarter mode.
