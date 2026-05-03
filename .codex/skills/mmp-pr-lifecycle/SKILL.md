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
4. API polling cadence: 30-60 seconds unless user explicitly asks for faster status.
5. For Codecov: treat patch coverage under 70% as a blocker unless the user approves an exception and the PR documents why.

## Done
- PR has Korean title/body.
- CodeRabbit valid feedback is fixed or explicitly rejected with reason.
- `ready-for-ci` was added only after review cleanup.
- CI and Codecov evidence is reported before merge.

## Avoid
- Do not add `ready-for-ci` at PR creation.
- Do not treat all bot comments as automatically correct.
- Do not trigger repeated CI runs while review threads are still unresolved.
