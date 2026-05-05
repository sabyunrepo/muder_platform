---
name: mmp-pr-lifecycle
description: Use when creating, reviewing, updating, labeling, checking, or merging MMP pull requests, especially when CodeRabbit, Codecov, ready-for-ci labels, CI checks, or Korean PR descriptions are involved.
---

# MMP PR Lifecycle

## When
- Before opening a PR, adding `ready-for-ci`, resolving CodeRabbit feedback, checking Codecov, or merging.

## Do
1. Work on a feature branch or dedicated worktree; never commit directly to `main`.
2. Before PR creation:
   - run focused checks for the changed scope
   - run/perform code review using available review skill or manual review
   - write PR title/body in Korean
   - link the GitHub issue in the PR body:
     - use `Closes #<issue>` when the PR completes the issue so GitHub closes it on merge
     - use `Refs #<issue>` only for partial PRs that must leave the issue open
   - do **not** add `ready-for-ci`
3. PR sequence:
   - create PR without CI label
   - inspect CodeRabbit review threads
   - fix only valid comments and resolve/address them
   - wait for or request CodeRabbit re-review
   - repeat once more when new valid comments appear
   - confirm unresolved review threads are zero
   - classify CI scope with `scripts/mmp-pr-ci-scope.sh <PR>`
   - for `full-ci`, add `ready-for-ci`, check CI and Codecov, and fix failures without skipping tests
   - for `code-rabbit-only`, do not add `ready-for-ci` or dispatch workflows; merge after light/focused checks and review gates are clear
   - merge only when scope-specific checks and required reviews are satisfied
4. API polling cadence: 30-60 seconds unless user explicitly asks for faster status. Main Codex must not run `scripts/mmp-pr-watch.sh` for repeated waiting. Use one-shot checks (`scripts/mmp-pr-status.sh <PR>`, `gh pr view`) in the main thread, and delegate repeated CodeRabbit/CI waiting to `mmp-ci-steward` through `scripts/mmp-ci-steward-handoff.sh <PR>`.
5. For Codecov: treat patch coverage under 70% as a blocker unless the user approves an exception and the PR documents why.
6. Operational-only PR exception:
   - Start by running `scripts/mmp-pr-ci-scope.sh <PR>`. Do not infer from `mergeStateStatus=BLOCKED` alone.
   - Use `scripts/mmp-pr-ci-scope.sh` as the canonical source for full path rules; examples such as `AGENTS.md`, `.codex/**`, docs, memory, and PR helper scripts usually classify as `code-rabbit-only`.
   - `code-rabbit-only` means heavy CI runs are intentionally not created by workflow path filters. Do not add `ready-for-ci`, do not dispatch `CI`/`E2E — Stubbed Backend`/`Security — Fast Feedback`, and do not wait for branch-protection required check names that cannot appear on that head.
   - For these PRs, merge after CodeRabbit is clear, unresolved review threads are 0, light checks pass, and focused local checks for changed scripts/config pass. If waiting is needed, hand off to `mmp-ci-steward`; do not keep the main thread in a watcher loop.
   - If GitHub reports `MERGEABLE` + `BLOCKED` only because required heavy-CI contexts are absent on a `code-rabbit-only` PR, main Codex may admin-merge after recording the scope evidence. This is not a CI failure.
7. CI steward handoff:
   - Use when PR review/CI waiting would block starting the next issue and the user has approved agent delegation.
   - Generate a copy-ready handoff with `scripts/mmp-ci-steward-handoff.sh <PR>`.
   - The steward owns only the target PR branch/worktree: CodeRabbit fixes, focused checks, Codecov/CI fixes, push commits, strict up-to-date branch refresh through `gh pr update-branch <PR>`, and `ready-for-ci` through `scripts/pr-ready-for-ci-guard.sh --apply <PR>`.
   - Main Codex continues the next issue only from a separate worktree/branch based on `origin/main` unless intentionally stacking work.
   - Merge authority stays with main Codex until the user explicitly changes the policy. When the steward reports `MERGE_READY`, main Codex verifies the scope-specific gate, then merges.
   - The handoff must include `scripts/mmp-pr-ci-scope.sh <PR>` output.
   - A steward's final report is valid only if it ran `scripts/mmp-pr-status.sh <PR> --fail-on-blocker` on the final head. Treat a green `CodeRabbit` check as insufficient unless unresolved review threads are 0 and GitHub review decision is non-blocking.
   - Give the steward enough autonomy to finish the PR lifecycle inside its target branch: it may update the PR branch for strict up-to-date checks, apply `ready-for-ci` through the guard, dispatch missing required workflows through the watcher, and resolve only verified target-PR review threads. Merge authority still stays with main Codex.
   - For `full-ci`, CodeRabbit-only success is not a steward completion state. The steward must continue by applying `scripts/pr-ready-for-ci-guard.sh --apply <PR>` and then watching required workflows with `MMP_CI_STEWARD=1 scripts/mmp-pr-watch.sh <PR> --trigger-missing-workflows`.
   - For `code-rabbit-only`, CodeRabbit clear + unresolved 0 + light/focused validation is a valid steward `MERGE_READY` state. The steward must not add `ready-for-ci` or dispatch missing workflows.
   - `ready-for-ci` is an authorization label, not evidence that workflows started. The steward must verify current-head runs for the required set (`CI`, `E2E — Stubbed Backend`, `Security — Fast Feedback`) and rely on `--trigger-missing-workflows` to dispatch missing workflows instead of passively waiting for label-created runs.
   - A steward may report `MERGE_READY` for `full-ci` only when the latest head SHA was checked, unresolved threads are 0, CodeRabbit is clear, `ready-for-ci` label is present, required checks are green, and Codecov is satisfied or explicitly not applicable.
   - A steward may report `MERGE_READY` for `code-rabbit-only` only when latest head SHA was checked, unresolved threads are 0, CodeRabbit is clear, light checks are green, focused local validation for changed scripts/config/docs is recorded, and the handoff scope says `code-rabbit-only`.
   - If main Codex pushes an additional commit to a steward-managed PR, re-handoff the latest head to the steward for CodeRabbit/check waiting instead of running repeated watcher polling in the main thread.
   - After reading the steward's final result, call `close_agent` for that steward before spawning more agents or moving to the next PR.
   - After any steward-managed PR is merged, main Codex pulls `origin/main`.
   - Do not automatically rebase or merge `origin/main` into active PR branches that are already under steward review/CI. Update an active branch only when GitHub reports a merge conflict or up-to-date requirement, `main` branch protection has `required_status_checks.strict=true` and the PR is behind, the merged main change touches the same files/shared contracts or a stacked parent branch, CI/Codecov failure is caused by main drift, or the user explicitly asks for the branch refresh.
   - In this repo, `main` currently requires strict up-to-date status checks. Therefore `mergeable_state=behind` / `mergeStateStatus=BEHIND` can block merge even when `mergeable=MERGEABLE`; the steward should update the PR branch with `gh pr update-branch <PR>` or `MMP_CI_STEWARD=1 scripts/mmp-pr-watch.sh <PR> --update-branch-if-needed ...`, then restart latest-head review/CI verification.
   - If no branch-refresh trigger exists, preserve the active PR head and let the steward finish the current review/CI cycle. Resolve any remaining conflict at the merge decision point.

## Done
- PR has Korean title/body.
- Completed issues are linked with `Closes #<issue>` and are confirmed closed after merge.
- CodeRabbit valid feedback is fixed or explicitly rejected with reason.
- CI scope evidence from `scripts/mmp-pr-ci-scope.sh <PR>` is recorded.
- For `full-ci`, `ready-for-ci` was added only after review cleanup and CI/Codecov evidence is reported before merge.
- For `code-rabbit-only`, no `ready-for-ci`/workflow dispatch was used and light/focused validation evidence is reported before merge.
- If a CI steward was used, handoff scope, steward result, and main Codex final verification are separated in the report.
- Completed CI steward agents are closed so agent slots are released.
- Steward final evidence includes `scripts/mmp-pr-status.sh <PR> --fail-on-blocker` passing on the reported head.

## Avoid
- Do not add `ready-for-ci` at PR creation.
- Do not treat all bot comments as automatically correct.
- Do not trigger repeated CI runs while review threads are still unresolved.
