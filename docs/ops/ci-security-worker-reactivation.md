# CI/security worker reactivation policy

Last verified: 2026-05-07

## Current state

MMP is in development-minimum mode.

- Default PR gate: CodeRabbit only.
- Local gate before PR: `scripts/mmp-local-ci.sh quick`, or `coverage` / `e2e` / `full` for higher-risk changes.
- Branch protection on `main`: required status check is `CodeRabbit`; strict up-to-date is enabled.
- GitHub Actions workers for CI, E2E, gitleaks, security scans, flaky retry, module isolation, and runner image builds are manual unless noted below.
- Release workflow still runs only for `v*` tags.

This mode is intentional while active feature work is moving quickly. It avoids burning self-hosted runner minutes on every small PR while still keeping CodeRabbit review and local container validation as the merge evidence.

## External basis

This policy follows three practical constraints from current CI/CD guidance:

- GitHub branch protection only blocks merges on required checks that actually run on the PR head. Required checks should therefore match the workflow mode, not a future target mode.
- GitHub Actions hardening guidance recommends least-privilege workflow permissions and explicit security workflow ownership.
- OWASP CI/CD guidance treats repeatable automation and security controls as core pipeline safeguards. Before service operations, secret scanning and scheduled/deep security scans must become automatic again.

References:

- GitHub Docs: required status checks and branch protection.
- GitHub Docs: secure use of GitHub Actions and least-privilege `GITHUB_TOKEN`.
- OWASP CI/CD Security Cheat Sheet.
- Gitleaks Action documentation for PR, push, schedule, and manual scan patterns.

## Cost and failure impact

Worker cost here is mostly self-hosted runner occupancy, not GitHub-hosted billing. The operational symptom of over-enabling checks is that active PRs wait on ARC runner capacity, CodeRabbit fixes get delayed by unrelated workflow queues, and strict branch protection can block merge on checks that were never supposed to run for that PR.

Low-cost checks:

- CodeRabbit review
- local focused tests before PR
- `Gitleaks` on same-repo PRs
- path-filtered security-fast checks

Medium-cost checks:

- full `CI` on same-repo PRs
- `Module Isolation` for backend runtime paths
- `E2E — Stubbed Backend` on main push

High-cost checks:

- matrix E2E on every PR
- deep container/SARIF scans on every PR
- runner image builds on broad push triggers
- real-backend E2E on every PR

Recommended failure handling:

- Secret scan failure: stop merge immediately. A leaked secret remains in git history even if a later commit removes it.
- CI or unit failure: stop merge unless the failing check is confirmed unrelated runner debt and local equivalent passes.
- E2E failure: stop merge for touched user flows; otherwise triage as flaky only after a retry lane or fresh run confirms it.
- Deep security finding: block service release on critical/high exploitable findings; track lower-signal findings with owner and deadline.
- Scheduled scan failure: do not block an unrelated PR retroactively, but open or update an issue before the next release candidate.

## Reactivation phases

### Phase 0: Development-minimum mode

Use now.

Keep:

- `CodeRabbit` as the only required branch-protection check.
- `CI`, `E2E — Stubbed Backend`, `Security — Fast Feedback`, `Gitleaks`, `Security — Deep Scan`, `Flaky Test Report`, `Module Isolation`, and `Build Runner Image` manual.
- No `ready-for-ci` label in the default PR lifecycle.

Run manually only when the PR touches one of these high-risk areas:

- database migration or generated SQL
- auth, realtime, runtime engine, or player-aware redaction
- Docker, runner image, workflow, or security configuration
- Playwright E2E flow or browser runtime behavior

### Phase 1: Pre-service hardening

Enter this phase when one of these is true:

- external testers or external contributors get access
- production-like deployment is scheduled
- payment, auth, profile, creator revenue, or admin workflows become service-blocking
- runner pool has enough capacity to absorb scheduled scans without blocking feature PRs

Enable:

- `Gitleaks Secret Scan`
  - `pull_request` for secret regression detection
  - `push` on `main`
  - keep `workflow_dispatch`
- `Security — Fast Feedback`
  - `pull_request` for dependency/security-sensitive path changes only
  - `push` on `main`
  - keep current warn-only policy until a separate vulnerability baseline issue is closed
- `Security — Deep Scan`
  - `schedule` nightly or weekly
  - `push` on `main`
  - keep `workflow_dispatch`
- `Phase 18.1 — Real-Backend E2E`
  - `schedule` nightly or twice weekly
  - `push` on `main` only after runner stability is confirmed

Do not restore `ready-for-ci` as a normal workflow trigger. The label made the PR flow harder to reason about. Prefer one of these:

- path-based `pull_request` triggers for cheap or critical checks
- `push` to `main` for post-merge observation
- `schedule` for expensive deep scans
- `workflow_dispatch` for explicit maintainer confirmation

Branch protection:

- Keep `CodeRabbit` required at phase entry.
- Do not add scheduled-only checks to branch protection.
- Add `Gitleaks Secret Scan / gitleaks (Secret scan)` only after five consecutive same-repo PR runs pass and the check name is stable.
- Add a CI summary check only if `CI` is restored to PR events and passes five consecutive same-repo PRs without runner flake.

### Phase 2: Service operations

Enter this phase when the service has production traffic or paid creator/user workflows.

Enable:

- `CI` on same-repo `pull_request` and `push` to `main`.
- `E2E — Stubbed Backend` on same-repo `pull_request` for E2E path changes and `push` to `main`.
- `Gitleaks Secret Scan` on `pull_request`, `push` to `main`, and weekly `schedule`.
- `Security — Fast Feedback` on same-repo `pull_request`, `push` to `main`, and weekly `schedule`.
- `Security — Deep Scan` on nightly or weekly `schedule` and `push` to `main`.
- `Flaky Test Report` weekly after at least one known flaky tag exists.
- `Module Isolation` on same-repo `pull_request` when module/runtime code changes, and `push` to `main`.
- `Build Runner Image` on manual dispatch, plus path-based `push` only for `infra/runners/**` or workflow-owned runner image files.

Branch protection:

- Required checks should be limited to checks that run for every protected PR in this phase.
- Recommended required set:
  - `CodeRabbit`
  - one CI summary check, if `CI` has a stable summary job
  - `Gitleaks Secret Scan / gitleaks (Secret scan)`, after the five-green rule
- Do not require matrix shard names directly unless the workflow emits a stable merge/summary check.

## Exact status commands

Check current branch protection:

```bash
gh api repos/sabyunrepo/muder_platform/branches/main/protection \
  --jq '{required_status_checks:.required_status_checks, required_pull_request_reviews:.required_pull_request_reviews}'
```

Check workflow trigger headers:

```bash
for f in .github/workflows/*.yml; do
  echo "== $f =="
  sed -n '1,35p' "$f"
done
```

Check PR CI scope under development-minimum mode:

```bash
scripts/mmp-pr-ci-scope.sh <PR_NUMBER>
```

Check merge gate before merging:

```bash
scripts/mmp-pr-status.sh <PR_NUMBER> --fail-on-blocker --allow-behind
```

## Exact branch-protection update shape

Use this only after the phase criteria above are met and the exact check names have been observed on real PR heads.

```bash
gh api \
  --method PATCH \
  repos/sabyunrepo/muder_platform/branches/main/protection/required_status_checks \
  -f strict=true \
  -f contexts[]=CodeRabbit \
  -f contexts[]='<STABLE_CHECK_NAME>'
```

Remove a stale required check:

```bash
gh api \
  --method PATCH \
  repos/sabyunrepo/muder_platform/branches/main/protection/required_status_checks \
  -f strict=true \
  -f contexts[]=CodeRabbit
```

## Workflow trigger changes by file

Apply these only when entering Phase 1 or Phase 2.

| Workflow | Phase 0 | Phase 1 | Phase 2 |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | `workflow_dispatch` | manual, or path-based PR for high-risk changes | same-repo PR + main push |
| `.github/workflows/e2e-stubbed.yml` | `workflow_dispatch` | scheduled/main-push observation | path-based PR + main push |
| `.github/workflows/security-fast.yml` | `workflow_dispatch` | path-based PR + main push | PR + main push + schedule |
| `.github/workflows/gitleaks.yml` | `workflow_dispatch` | PR + main push | PR + main push + schedule |
| `.github/workflows/security-deep.yml` | `workflow_dispatch` | schedule + main push | schedule + main push |
| `.github/workflows/phase-18.1-real-backend.yml` | `workflow_dispatch` | schedule | schedule + main push |
| `.github/workflows/flaky-report.yml` | `workflow_dispatch` | manual | weekly schedule after flaky tags exist |
| `.github/workflows/module-isolation.yml` | `workflow_dispatch` | manual | path-based PR + main push |
| `.github/workflows/build-runner-image.yml` | `workflow_dispatch` | manual | path-based push for runner image files |

## Stop conditions

Do not move from Phase 0 to Phase 1 if any of these are true:

- ARC runner capacity cannot finish one manual `CI` and one manual `E2E — Stubbed Backend` run without starving active PR work.
- `Gitleaks` or SCA tools still produce untriaged high-signal findings without an exception process.
- Required status check names have not been confirmed from real PR runs.
- The workflow change would require secrets not already present in the repository settings.

Do not move from Phase 1 to Phase 2 if:

- five consecutive same-repo PR runs are not green for the proposed required check.
- scheduled deep scans produce repeated flakes.
- service launch criteria are still unknown.
