#!/usr/bin/env bash
#
# Phase 19 F-sec-2 gate — BuildStateFor coverage lint.
#
# Since Phase 19.1 PR-B this script is a thin wrapper around the Go-based AST
# linter at apps/server/cmd/playeraware-lint. The AST walker catches four
# regression patterns the original awk/grep implementation missed:
#
#   1. return m.BuildState()                                  (direct delegate)
#   2. data, err := m.BuildState(); return data, err          (variable capture)
#   3. return json.Marshal(m.snapshot())                      (whole-state marshal)
#   4. m.BuildState() anywhere in a multi-line BuildStateFor body
#
# Empty ALLOW list as of PR-2c (2026-04-18): crime_scene/combination now
# implements real per-player redaction (D-MO-1). Add a new `--allow` entry
# below only when introducing a deliberate, time-boxed stub tracked by a
# follow-up PR.

set -euo pipefail

ROOT="${1:-./internal/module/...}"
REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT/apps/server"

# shellcheck disable=SC2086  # intentional word-splitting of $ROOT
go run ./cmd/playeraware-lint $ROOT
