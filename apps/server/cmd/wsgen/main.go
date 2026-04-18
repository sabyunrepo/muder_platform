// Command wsgen generates packages/shared/src/ws/types.generated.ts
// from the authoritative Go Catalog in apps/server/internal/ws.
//
// Usage (from apps/server/):
//
//	go run ./cmd/wsgen [-catalog-dir internal/ws] [-out ../../packages/shared/src/ws/types.generated.ts]
//
// Phase 19 PR-1 (2026-04-18).
//
// The generated file is the sole source of truth for the Go→TS WebSocket
// contract. CI (Phase G) runs `go generate ./...` and fails on a non-empty
// `git diff` against the committed file, enforcing the handshake between
// server catalog edits and frontend enum regeneration.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	catalogDir := flag.String("catalog-dir", "internal/ws",
		"directory containing envelope_catalog_*.go (SSOT)")
	outPath := flag.String("out", "../../packages/shared/src/ws/types.generated.ts",
		"output TypeScript file path (default assumes wsgen run from apps/server/)")
	flag.Parse()

	absCat, err := filepath.Abs(*catalogDir)
	if err != nil {
		die("resolve catalog-dir: %v", err)
	}

	catalog, err := extractCatalog(absCat)
	if err != nil {
		die("extract catalog: %v", err)
	}
	if len(catalog) == 0 {
		die("catalog is empty — check -catalog-dir %s", absCat)
	}

	payloads, err := extractPayloads(absCat)
	if err != nil {
		die("extract payloads: %v", err)
	}

	rendered, err := render(catalog, payloads)
	if err != nil {
		die("render: %v", err)
	}

	absOut, err := filepath.Abs(*outPath)
	if err != nil {
		die("resolve out: %v", err)
	}
	if err := os.WriteFile(absOut, []byte(rendered), 0o644); err != nil {
		die("write %s: %v", absOut, err)
	}

	fmt.Fprintf(os.Stderr, "wsgen: %d events, %d payload structs → %s\n",
		len(catalog), len(payloads), *outPath)
}

func die(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "wsgen: "+format+"\n", args...)
	os.Exit(1)
}
