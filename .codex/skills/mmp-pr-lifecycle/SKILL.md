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
   - add `ready-for-ci`
   - check CI and Codecov
   - fix failures without skipping tests
   - merge only when checks and required reviews are satisfied
4. API polling cadence: 30-60 seconds unless user explicitly asks for faster status. Prefer `scripts/mmp-pr-watch.sh <PR> --trigger-missing-workflows` for repeated CodeRabbit/CI polling instead of manual loop calls. When the watcher exits, immediately continue based on its exit code: `0` ready/merge path, `2` CI failure logs/fix, `3` CodeRabbit thread handling, `4` timeout state refresh. Do not stop at reporting that the watcher ended.
5. For Codecov: treat patch coverage under 70% as a blocker unless the user approves an exception and the PR documents why.
6. Operational-only PR exception:
   - If changed files do **not** touch app/runtime/test/build trigger paths (`apps/**`, `packages/**`, `tooling/**`, `.github/workflows/**`, `package.json`, lockfiles, `turbo.json`, `playwright.config.ts`, `e2e/**`, `go.mod`, `go.sum`), do not force full CI or manual workflow dispatch.
   - For these PRs, merge after CodeRabbit is clear, unresolved review threads are 0, light checks pass, and focused local checks for changed scripts/config pass. Use `scripts/mmp-pr-watch.sh <PR> --code-rabbit-only` for this path.
   - Examples: `AGENTS.md`, `.codex/**`, `docs/ops/**`, PR helper scripts that were locally shell-checked.

## Done
- PR has Korean title/body.
- Completed issues are linked with `Closes #<issue>` and are confirmed closed after merge.
- CodeRabbit valid feedback is fixed or explicitly rejected with reason.
- `ready-for-ci` was added only after review cleanup.
- CI and Codecov evidence is reported before merge.

## Avoid
- Do not add `ready-for-ci` at PR creation.
- Do not treat all bot comments as automatically correct.
- Do not trigger repeated CI runs while review threads are still unresolved.
