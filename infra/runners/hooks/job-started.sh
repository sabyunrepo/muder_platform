#!/usr/bin/env bash
# ACTIONS_RUNNER_HOOK_JOB_STARTED — 매 job 시작 직전 fire.
# myoung34 EPHEMERAL=true가 file system reset 안 함에 대한 정공.
set -euo pipefail
rm -rf "${HOME}/go/pkg/mod" "${HOME}/.cache/go-build" 2>/dev/null || true
mkdir -p "${HOME}/go/pkg/mod" "${HOME}/.cache/go-build"
