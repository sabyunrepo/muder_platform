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
2. Start with `mmp-parallel-coordinator` for non-trivial work:
   - use it to split read-heavy audits, write ownership, conflict risks, and integration checkpoints.
3. Delegate implementation by ownership:
   - frontend UI/adapter/tests -> `mmp-frontend-implementer`
   - backend handler/service/engine/migration/tests -> `mmp-backend-implementer`
   - shared DTO/migration/generated client/adapter contract -> `mmp-contract-integrator`
4. Delegate review by axis before PR creation:
   - frontend UX/adapter/E2E readiness -> `mmp-frontend-editor-reviewer`
   - backend/runtime/persistence consistency -> `mmp-backend-engine-reviewer`
   - test/coverage/local validation readiness -> `mmp-test-coverage-reviewer`
   - auth/ownership/redaction/secret risks -> `mmp-security-reviewer`
   - concurrency/query/render/flakiness risks -> `mmp-performance-reviewer`
5. Delegate long checks:
   - use `mmp-local-validation-runner` for focused test/build commands that would flood main context.
6. Delegate PR waiting/fix loop:
   - use `mmp-ci-steward` for one handed-off PR after main Codex creates the PR.
7. Delegate wrap-up:
   - use `mmp-docs-wrap-steward` after significant work to propose docs, automation, learning, and follow-up candidates.
8. Main Codex integrates:
   - review subagent output under `발견 / 수행 / 판단 / 미해결`
   - decide which findings are valid
   - make PR/merge/user-facing decisions
   - close completed subagents after collecting final output

## Done

- Assigned agents, ownership, and stop conditions are explicit.
- Implementation agents changed only assigned files.
- Review and validation evidence is summarized without raw log dumps.
- PR creation/merge and product-risk decisions remain with main Codex.

## Avoid

- Do not delegate secrets, destructive commands, deploys, broad contract decisions, PR creation, or final merge.
- Do not assign two write agents to the same file, API DTO, migration, adapter mapping, route file, or generated contract at the same time.
- Do not use subagents for tiny one-file judgment tasks when delegation overhead is larger than the work, unless the user explicitly asks for strict headquarter mode.
