---
name: mmp-runner-image-rollout
description: Use when updating, verifying, or documenting the MMP ARC runner image rollout through KT Cloud Container Registry and Kubernetes, including build-runner-image workflow success, registry tag/digest checks, infra/k8s/arc/values-runner-set.yaml tag updates, Helm upgrade, runner pod image verification, and closing the linked infra issue only after rollout evidence is collected.
---

# MMP Runner Image Rollout

## Overview

Use this skill for the MMP custom GitHub Actions runner image lifecycle:
`build-runner-image.yml` -> KT registry tag -> `arc-runner-set` Helm values -> Kubernetes pod verification.

The completion criterion is not just a merged PR. The rollout is complete only when a versioned KT registry tag exists, Helm values point to it, and at least one ARC runner pod is Running with the expected image digest.

## Workflow

1. Confirm the source image build.
   - Use `gh run list --workflow build-runner-image.yml --branch main`.
   - Use `gh run view <run-id> --json status,conclusion,headSha,jobs,url`.
   - Continue only after the push run is `completed` with `conclusion=success`.
2. Verify KT registry tags.
   - Prefer a versioned tag, not `latest`.
   - The workflow pushes `registry.cloud.kt.com/dldxu5p5/mmp-runner:<sha>` and `latest`.
   - If a human-readable tag is needed, create it with `docker buildx imagetools create` from the SHA tag. This avoids re-pulling and re-pushing the large image layers.
3. Update repo values on a feature branch.
   - Edit only `infra/k8s/arc/values-runner-set.yaml` unless a broader infra change is explicitly needed.
   - Keep `imagePullPolicy: IfNotPresent` and use a versioned tag.
   - PR scope should normally be `code-rabbit-only`.
4. Apply the same values to the cluster.
   - Use:
     ```bash
     helm upgrade --install arc-runner-set \
       oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
       --namespace arc-runners \
       -f infra/k8s/arc/values-runner-set.yaml
     ```
   - Do not delete old Running runner pods while GitHub Actions jobs are in progress. ARC will create new ephemeral runner pods from the new spec.
5. Verify rollout evidence.
   - Run `scripts/verify-runner-rollout.sh <tag>`.
   - Confirm Helm values use the tag.
   - Confirm at least one Running pod uses the tag.
   - Confirm the pod `imageID` digest matches the KT registry image index or manifest digest.
6. Finish PR/issue lifecycle.
   - Create the PR with `scripts/pr-create-guard.sh` and no `ready-for-ci` label.
   - For `code-rabbit-only`, do not dispatch heavy CI.
   - Merge after CodeRabbit, unresolved threads, gitleaks, file-size, and focused validation are clear.
   - Close the linked issue only after registry and Kubernetes rollout evidence is recorded.

## Commands

Check current build-runner-image push runs:

```bash
gh run list --workflow build-runner-image.yml --branch main --limit 5 \
  --json databaseId,status,conclusion,headSha,createdAt,updatedAt,url,event
```

Create a versioned KT tag from a workflow SHA tag:

```bash
docker buildx imagetools create \
  -t registry.cloud.kt.com/dldxu5p5/mmp-runner:<versioned-tag> \
  registry.cloud.kt.com/dldxu5p5/mmp-runner:<workflow-sha>
```

Verify the registry and cluster rollout:

```bash
.codex/skills/mmp-runner-image-rollout/scripts/verify-runner-rollout.sh <versioned-tag>
```

## Safety Rules

- Never print `.env` contents or registry passwords. Use only key names or sanitized command output.
- Do not use `latest` in `infra/k8s/arc/values-runner-set.yaml`.
- Do not close the infra issue after PR merge alone; require KT registry and Kubernetes evidence.
- Do not force-delete active runner pods while `gh run list --status in_progress` shows jobs that may be using them.
- Treat `helm template` lookup errors from the ARC chart as non-authoritative; prefer live `helm upgrade --install` and `helm get values` evidence.
