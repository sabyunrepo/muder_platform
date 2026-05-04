#!/usr/bin/env bash
# Summarize or validate MMP self-improvement state without reading archive logs.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
exec python3 "$repo_root/.codex/skills/mmp-self-improvement-loop/scripts/scan_self_improvement.py" "$@"
