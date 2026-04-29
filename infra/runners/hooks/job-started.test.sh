#!/usr/bin/env bash
# bash unit test for job-started.sh — verifies cleanup hook behavior.
set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="${THIS_DIR}/job-started.sh"

# 임시 HOME 픽스처
TMP_HOME="$(mktemp -d)"
trap 'rm -rf "$TMP_HOME"' EXIT
mkdir -p "$TMP_HOME/go/pkg/mod/dummy" "$TMP_HOME/.cache/go-build/dummy"
touch "$TMP_HOME/go/pkg/mod/dummy/file" "$TMP_HOME/.cache/go-build/dummy/file"

HOME="$TMP_HOME" bash "$HOOK"

# Assert: 두 디렉토리 비었음
[ -z "$(ls -A "$TMP_HOME/go/pkg/mod" 2>/dev/null)" ] || { echo "FAIL: go/pkg/mod not cleaned"; exit 1; }
[ -z "$(ls -A "$TMP_HOME/.cache/go-build" 2>/dev/null)" ] || { echo "FAIL: .cache/go-build not cleaned"; exit 1; }

# Assert: 빈 디렉토리 재생성됨 (setup-go가 기대)
[ -d "$TMP_HOME/go/pkg/mod" ] || { echo "FAIL: go/pkg/mod not recreated"; exit 1; }
[ -d "$TMP_HOME/.cache/go-build" ] || { echo "FAIL: .cache/go-build not recreated"; exit 1; }

echo "PASS: job-started.sh cleanup correct"
