#!/usr/bin/env bash
#
# PR-2b coverage lint: BuildStateFor must not be a stub.
#
# Rationale
# ---------
# Phase 19 F-sec-2 gate forces every engine.Module to either
#   (a) implement PlayerAwareModule.BuildStateFor with real per-player
#       redaction, or
#   (b) embed engine.PublicStateMarker (and therefore not implement
#       BuildStateFor at all).
#
# A module that does implement BuildStateFor but delegates straight back to
# m.BuildState() has opted neither in nor out — it reintroduces the pre-PR-2a
# permissive fallback. This lint flags that single regression pattern.
#
# The regex is deliberately narrow:
#   - grep -A2 after a BuildStateFor signature
#   - require the literal `return m.BuildState()` on one of the next lines
#   - one-line stubs (`{ return m.BuildState() }`) are also matched
#
# Legitimate patterns (independent snapshot, even if semantically identical
# to BuildState) pass because the body references module fields instead of
# re-calling BuildState.

set -euo pipefail

ROOT="${1:-apps/server/internal/module}"

if [ ! -d "$ROOT" ]; then
    echo "scripts/check-playeraware-coverage.sh: directory not found: $ROOT" >&2
    exit 2
fi

# Allowed exceptions (tracked as their own PR). Each path must be removed
# from this list when the corresponding real-redaction PR lands.
#   - crime_scene/combination : PR-2c (D-MO-1 craftedAsClueMap redaction)
ALLOW_STUB=(
    "apps/server/internal/module/crime_scene/combination/"
)

allow_filter=""
for p in "${ALLOW_STUB[@]}"; do
    if [ -z "$allow_filter" ]; then
        allow_filter="$p"
    else
        allow_filter="$allow_filter|$p"
    fi
done

# Collect BuildStateFor-signature lines with 2 lines of trailing context, then
# surface only the blocks that contain `return m.BuildState()`.
match_blocks=$(grep -rn --include='*.go' -A2 -E 'func \([a-zA-Z_]+ \*?[A-Z][a-zA-Z0-9_]*\) BuildStateFor\(' "$ROOT" 2>/dev/null | \
    (if [ -n "$allow_filter" ]; then grep -vE "$allow_filter"; else cat; fi) || true)

violations=$(echo "$match_blocks" | awk '
    /BuildStateFor\(/ { sig=$0; armed=1; next }
    armed==1 && /return[[:space:]]+m\.BuildState\(\)/ { print sig; print $0; armed=0; next }
    /^--$/ { armed=0 }
')

if [ -n "$violations" ]; then
    echo "❌ PR-2b coverage lint — BuildStateFor delegates to m.BuildState() (stub pattern banned):" >&2
    echo "" >&2
    echo "$violations" >&2
    echo "" >&2
    echo "Fix: either implement real per-player redaction, or switch the" >&2
    echo "module to PublicStateMarker (remove BuildStateFor, embed" >&2
    echo "engine.PublicStateMarker)." >&2
    exit 1
fi

echo "✅ PR-2b coverage clean — no BuildStateFor → m.BuildState() stubs under $ROOT."
