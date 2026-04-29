#!/usr/bin/env bash
# ACTIONS_RUNNER_HOOK_JOB_STARTED — 매 job 시작 직전 fire.
#
# Phase 23 follow-up (image-resident toolchain):
# - GOMODCACHE/GOCACHE는 image pre-bake + named volume mount로 persist.
# - setup-go의 `cache: false`와 결합해 GHA cache restore 자체가 일어나지 않음
#   → 옛 카논의 tar 충돌 우려는 미발생. rm -rf 제거.
#
# myoung34 base image의 runner user home은 /home/runner 고정.
# set -u로 인한 unbound variable abort 방지.
set -euo pipefail
HOME="${HOME:-/home/runner}"
# setup-go가 cache restore disabled여도 parent dir 존재 가정 — 안전망 idempotent mkdir.
mkdir -p "${HOME}/go/pkg/mod" "${HOME}/.cache/go-build"
