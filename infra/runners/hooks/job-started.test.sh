#!/usr/bin/env bash
# bash unit test for job-started.sh — verifies image-resident toolchain preservation.
# Phase 23 follow-up: hook은 더 이상 cache 청소하지 않음. 기존 cache 데이터 보존 필수.
set -euo pipefail

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="${THIS_DIR}/job-started.sh"

# Case 1: 기존 cache 데이터가 있을 때 — 보존되어야 함 (image-resident toolchain).
TMP_HOME="$(mktemp -d)"
trap 'rm -rf "$TMP_HOME"' EXIT
mkdir -p "$TMP_HOME/go/pkg/mod/golang.org/x/sys@v0.20.0" "$TMP_HOME/.cache/go-build/00"
touch "$TMP_HOME/go/pkg/mod/golang.org/x/sys@v0.20.0/sys.go" "$TMP_HOME/.cache/go-build/00/abc"

HOME="$TMP_HOME" bash "$HOOK"

# Assert: 기존 cache 보존 (rm -rf 안 함)
[ -f "$TMP_HOME/go/pkg/mod/golang.org/x/sys@v0.20.0/sys.go" ] || { echo "FAIL: GOMODCACHE 데이터 삭제됨 (image-resident 의도 위배)"; exit 1; }
[ -f "$TMP_HOME/.cache/go-build/00/abc" ] || { echo "FAIL: GOCACHE 데이터 삭제됨"; exit 1; }

# Case 2: cache 디렉토리 부재 — idempotent mkdir로 재생성.
TMP_HOME2="$(mktemp -d)"
HOME="$TMP_HOME2" bash "$HOOK"
[ -d "$TMP_HOME2/go/pkg/mod" ] || { echo "FAIL: GOMODCACHE dir 미생성"; exit 1; }
[ -d "$TMP_HOME2/.cache/go-build" ] || { echo "FAIL: GOCACHE dir 미생성"; exit 1; }
rm -rf "$TMP_HOME2"

echo "PASS: job-started.sh preserves image-resident cache + idempotent mkdir"
