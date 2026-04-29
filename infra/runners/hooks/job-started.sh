#!/usr/bin/env bash
# ACTIONS_RUNNER_HOOK_JOB_STARTED — 매 job 시작 직전 fire.
# myoung34 EPHEMERAL=true가 file system reset 안 함에 대한 정공.
set -euo pipefail
# myoung34 base image의 runner user home은 /home/runner 고정. set -u로 인한 unbound variable abort 방지.
HOME="${HOME:-/home/runner}"
rm -rf "${HOME}/go/pkg/mod" "${HOME}/.cache/go-build" 2>/dev/null || true
# setup-go가 cache restore 시 parent dir 존재 가정 — rm -rf 후 재생성 필수.
mkdir -p "${HOME}/go/pkg/mod" "${HOME}/.cache/go-build"
