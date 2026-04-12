#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/../apps/server"

echo "=== Module Isolation Tests ==="

for mod in cluedist decision progression exploration media communication crime_scene core; do
    echo "--- Testing module: $mod ---"
    go test -race -count=1 ./internal/module/$mod/... || { echo "FAIL: $mod"; exit 1; }
done

echo "--- Cross-module import check ---"
for mod in cluedist decision progression exploration media communication crime_scene core; do
    # Modules must not import other modules (only engine, clue packages allowed)
    if grep -r '"github.com/mmp-platform/server/internal/module/' "internal/module/$mod/" 2>/dev/null | grep -v '_test.go' | grep -v 'register.go'; then
        echo "FAIL: $mod imports another module package"
        exit 1
    fi
done

echo "--- Full build check ---"
go build ./...

echo "=== All modules isolated ==="
