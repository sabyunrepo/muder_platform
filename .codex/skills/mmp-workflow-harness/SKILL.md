---
name: mmp-workflow-harness
description: Use when starting or standardizing non-trivial MMP work from user request through diagnosis, interview/seed, scoped implementation, validation evidence, review, PR, and merge.
---

# MMP Workflow Harness

## When

- A user request may turn into code, config, data, browser QA, PR, or merge work.
- The request starts from a screen symptom, backend error, production-like data issue, or broad workflow improvement.
- You need to keep the main Codex session as the decision and integration owner while preserving a clear execution ledger.
- If the user explicitly requires OOO, subagent handoffs, independent review/validation, and PR stewardship as one routine, load `mmp-agentic-delivery-chain` as the narrower entrypoint.

## Do

1. Run a preflight when practical:
   - `scripts/mmp-workflow-preflight.sh`
   - If an issue is known: `scripts/mmp-workflow-preflight.sh --issue <number>`
2. Classify the task:
   - `diagnosis-only`: inspect and brief, no edits.
   - `narrow-fix`: one focused defect or UI issue.
   - `feature`: product behavior or API/data-model change.
   - `workflow`: AGENTS, skill, hook, script, CI, PR lifecycle, or docs/process change.
   - `pr-lifecycle`: review, CodeRabbit, local validation, merge.
3. Build an execution ledger with checkboxes:
   - objective
   - scope in/out
   - assumptions
   - stop conditions
   - Coverage Plan
   - validation plan
   - review/PR/merge gate
4. Evidence-first diagnosis:
   - Frontend: component, state, network request, console, browser reproduction.
   - Backend: log, API response, DB state, ownership/auth, error type.
   - Workflow/CI: script path, exit code meaning, marker file, generated diff.
5. Use interview/seed only where it adds control:
   - Use `deep-interview` first when goals, scope, exclusions, constraints, or done criteria are materially unclear.
   - Use OOO interview/refinement only after the deep-interview brief exists or a safe default is explicit; keep OOO bounded to refining the accepted brief.
   - Use Issue/Seed for trackable multi-step work.
   - Before implementation, ensure the issue/seed captures objective, scope in/out, done criteria, Coverage Plan, validation plan, and E2E/browser QA expectations when UI is involved.
   - For small defects with clear evidence, proceed with a narrow plan and record assumptions in the final report.
6. OOO run scope guard:
   - Stop or cancel OOO execution when it expands beyond the accepted scope, touches unrelated backend/API/DB/media areas, multiplies acceptance criteria without user approval, or stalls without new evidence.
   - Salvage useful findings, then implement a narrow patch manually or via a bounded subagent.
7. Implementation:
   - Use a feature/chore branch or separate worktree.
   - Do not mix unrelated dirty worktree changes.
   - Prefer existing project patterns and small direct changes.
   - Main Codex orchestrates the chain because `.codex/config.toml` uses `max_depth = 1`; subagents return handoff fields and never spawn the next agent directly.
   - Implementers must not review or validate their own work as the final gate. Assign independent review/validation after implementation.
8. Validation:
   - Run focused tests first.
   - Add typecheck/lint/build when frontend or shared TS changes.
   - Use `scripts/mmp-local-ci.sh quick` for PR-bound code changes when practical.
   - For relevant UI work, include an E2E plan plus browser QA evidence. If E2E is not appropriate, record the reason and substitute tests.
   - For cmux browser QA, report the surface, URL, user flow, assertion, and fallback reason if cmux is unavailable.
   - After the last fix commit/change, rerun independent validation and review before PR creation or merge judgment.
9. Review and PR:
   - Use `mmp-pr-lifecycle` before PR creation or merge.
   - Keep PR title/body in Korean.
   - Use CodeRabbit and unresolved-thread gates under the repo policy.
   - PR creation and merge remain main Codex owned. `mmp-ci-steward` may steward review wait loops and valid fixes on a handed-off PR, but does not create or merge PRs.

## Browser Evidence Format

```md
Browser evidence:
- Surface:
- URL:
- User flow:
- Network/API:
- Console:
- DOM/assertion:
- Screenshot/video:
- Result:
```

## Done

- The final report separates cause, impact, changes, validation, and remaining risk.
- Dirty worktree state and branch/worktree location are clear.
- Any deferred work is tracked in an issue/checklist or explicitly reported as not created.
- OOO/subagent output is summarized and integrated, not pasted raw.

## Avoid

- Do not let OOO or subagents widen scope silently.
- Do not treat local-ci generated drift, dirty worktree, dependency install failure, and code test failure as the same class of failure.
- Do not create new process rules in AGENTS.md when a skill or script is sufficient.
