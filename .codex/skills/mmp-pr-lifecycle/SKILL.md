---
name: mmp-pr-lifecycle
description: Use when creating, reviewing, updating, checking, or merging MMP pull requests, especially when CodeRabbit, focused local validation, or Korean PR descriptions are involved.
---

# MMP PR Lifecycle

## When
- Before opening a PR, resolving CodeRabbit feedback, checking PR status, or merging.

## Do
1. Work on a feature branch or dedicated worktree; never commit directly to `main`.
2. Before PR creation:
   - confirm the issue or working note has a `Coverage Plan` mapping changed files and important branches to focused tests
   - confirm any minimized, excluded, or deferred behavior is tracked in the issue body, issue checklist/comment, or a newly created follow-up issue
   - confirm PR grouping avoids waste: group related same-scope workflow/config/doc changes into one PR, and split only when conflict risk, review ownership, or runtime blast radius justifies it
   - default로는 MMP 스크립트 경로를 사용한다:
     - 작업 정리 + PR까지 자동화하려면 `scripts/mmp-workflow-agent.sh commit --issue <번호> --message ... --create-pr -- --title ...`
     - 이미 브랜치만 있으면 PR만 만들 때는 `scripts/mmp-workflow-agent.sh pr --issue <번호> ...`
   - run focused checks for the changed scope
   - include the Coverage Plan evidence in the PR body or final handoff summary
   - include `Refs #<issue>` for deferred/follow-up issue links when the PR intentionally leaves work out
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
   - record development-minimum scope with `scripts/mmp-pr-ci-scope.sh <PR>`
   - do not add `ready-for-ci`, do not dispatch workflows, and do not wait for GitHub Actions workers
   - merge when CodeRabbit is clear, unresolved review threads are 0, GitHub review decision is non-blocking, and focused local validation evidence is recorded
4. API polling cadence: 30-60 seconds unless user explicitly asks for faster status. Main Codex must not run `scripts/mmp-pr-watch.sh` for repeated waiting. Use one-shot checks (`scripts/mmp-pr-status.sh <PR>`, `gh pr view`) in the main thread, and delegate repeated CodeRabbit waiting to `mmp-ci-steward` through `scripts/mmp-ci-steward-handoff.sh <PR>`.
5. For coverage: do not wait until remote Codecov comments to discover obvious untested handler/service/adapter files. Add focused local tests before PR creation when new code paths are introduced. Treat Codecov as informational unless a maintainer manually ran GitHub CI for that PR and asked to use the result as a gate.
6. Development-minimum PR policy:
   - Start by running `scripts/mmp-pr-ci-scope.sh <PR>`. Do not infer from `mergeStateStatus=BLOCKED` alone.
   - The script reports `code-rabbit-only` under current policy. This means GitHub Actions workers are intentionally not PR gates.
   - Do not add `ready-for-ci`, do not dispatch `CI`/`E2E — Stubbed Backend`/`Security — Fast Feedback`, and do not wait for branch-protection required check names that cannot appear on that head.
   - Merge after CodeRabbit is clear, unresolved review threads are 0, light checks pass, and focused local checks for changed scripts/config/code pass. If waiting is needed, hand off to `mmp-ci-steward`; do not keep the main thread in a watcher loop.
   - If GitHub reports `MERGEABLE` + `BLOCKED` only because legacy heavy-CI contexts are absent, main Codex may admin-merge after recording the scope evidence. This is not a CI failure.
7. CI steward handoff:
   - Use when CodeRabbit waiting would block starting the next issue and the user has approved agent delegation.
   - Generate a copy-ready handoff with `scripts/mmp-ci-steward-handoff.sh <PR>`.
   - The steward owns only the target PR branch/worktree: CodeRabbit fixes, focused checks, push commits, and strict up-to-date branch refresh through `gh pr update-branch <PR>` only when main Codex explicitly asks or merge-conflict/main-drift evidence requires it.
   - Main Codex continues the next issue only from a separate worktree/branch based on `origin/main` unless intentionally stacking work.
   - Merge authority stays with main Codex until the user explicitly changes the policy. When the steward reports `MERGE_READY`, main Codex verifies the scope-specific gate, then merges.
   - The handoff must include `scripts/mmp-pr-ci-scope.sh <PR>` output.
   - A steward's final report is valid only if it ran `scripts/mmp-pr-status.sh <PR> --fail-on-blocker --allow-behind` on the final head. Treat a green `CodeRabbit` check as insufficient unless unresolved review threads are 0 and GitHub review decision is non-blocking.
   - Give the steward enough autonomy to finish the PR lifecycle inside its target branch: it may fix valid CodeRabbit findings, run focused local validation, push fixes, and resolve only verified target-PR review threads. Merge authority and merge-batch ordering stay with main Codex.
   - A steward must not treat a pending CodeRabbit/CI state as a final result when an allowed next action exists. Pending means the steward keeps watching or advances to the next gate.
   - CodeRabbit clear + unresolved 0 + light/focused validation is a valid steward `MERGE_READY` state. The steward must not add `ready-for-ci` or dispatch workflows.
   - A steward may report `MERGE_READY` when latest head SHA was checked, unresolved threads are 0, CodeRabbit is clear, light checks are green, focused local validation for changed files is recorded, and the handoff scope says `code-rabbit-only`.
   - A steward may report `MERGE_CANDIDATE` when all quality gates are clear but the only remaining blocker is strict up-to-date/behind. Main Codex then chooses admin merge, branch update for the next merge target, or leaving the head untouched to avoid wasting worker runs.
   - If main Codex pushes an additional commit to a steward-managed PR, re-handoff the latest head to the steward for CodeRabbit/check waiting instead of running repeated watcher polling in the main thread.
   - If main Codex asks an active steward for status, the steward should answer with the latest head SHA, phase, current command, pending checks/threads, and next autonomous action. If no state changes before the watcher timeout, the steward reports `BLOCKED` with timeout/no-progress evidence instead of silently staying active.
   - After reading the steward's final result, call `close_agent` for that steward before spawning more agents or moving to the next PR.
   - After any steward-managed PR is merged, main Codex pulls `origin/main`.
   - In this repo, `main` currently requires strict up-to-date status checks. Therefore `mergeable_state=behind` / `mergeStateStatus=BEHIND` can block normal merge even when `mergeable=MERGEABLE`; this is a merge-batch decision, not automatically a CI failure.
   - Do not automatically update every active PR after one PR merges. Update an active branch only when GitHub reports a merge conflict, the PR is the next merge target and main Codex chooses branch refresh instead of admin merge, the merged main change touches the same files/shared contracts or a stacked parent branch, or the user explicitly asks for the branch refresh.
   - If no branch-refresh trigger exists, preserve the active PR head and existing CI evidence. Resolve any remaining behind state at the merge decision point.
8. Merge batch operation:
   - When several PRs share the same base, treat quality-clear PRs as a merge batch.
   - Merge one PR at a time in priority order. Do not refresh the rest immediately after each merge.
   - For low-conflict PRs where CodeRabbit and focused local validation are clear, main Codex may admin merge a `MERGE_CANDIDATE` to avoid burning worker runs on a pure strict-behind blocker.
   - Do not bypass real quality blockers such as unresolved review threads, `CHANGES_REQUESTED`, failing focused local checks, or merge conflicts.

## Done
- PR has Korean title/body.
- Coverage Plan evidence maps changed files/branches to focused tests before PR creation.
- Deferred/minimized work is tracked by issue checklist/comment or a follow-up GitHub Issue before merge.
- PR grouping rationale accounts for CI cost and avoids unnecessary micro-PRs.
- Completed issues are linked with `Closes #<issue>` and are confirmed closed after merge.
- CodeRabbit valid feedback is fixed or explicitly rejected with reason.
- CI scope evidence from `scripts/mmp-pr-ci-scope.sh <PR>` is recorded.
- No `ready-for-ci`/workflow dispatch was used and light/focused validation evidence is reported before merge.
- If a CI steward was used, handoff scope, steward result, and main Codex final verification are separated in the report.
- Completed CI steward agents are closed so agent slots are released.
- Steward final evidence includes `scripts/mmp-pr-status.sh <PR> --fail-on-blocker --allow-behind` passing on the reported head.
- Steward pending states are observable: active status replies include head SHA, phase, pending checks, elapsed wait/no-progress evidence, and the next autonomous action.

## Avoid
- Do not add `ready-for-ci` at PR creation.
- Do not treat all bot comments as automatically correct.
- Do not trigger GitHub Actions workers for the default PR flow.
- Do not say "follow-up" only in chat or PR prose without an issue/checklist reference.
