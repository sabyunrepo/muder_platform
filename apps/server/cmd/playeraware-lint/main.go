// playeraware-lint enforces the PR-2a / Phase 19 F-sec-2 boot-gate invariant at
// source level: every engine.Module's BuildStateFor implementation must do
// real per-player redaction — it may NOT delegate to BuildState() or snapshot
// the whole-player map.
//
// Ran once per CI build against apps/server/internal/module/..., this linter
// walks the Go AST and rejects four known regression patterns:
//
//  1. `return m.BuildState()`                               — direct delegate
//  2. `data, err := m.BuildState(); return data, err`       — variable capture
//  3. `return json.Marshal(m.snapshot())`                   — whole-state marshal
//  4. `m.BuildState()` anywhere else in a BuildStateFor body (3-line stubs, etc.)
//
// Patterns 1 & 4 collapse into "any call on the receiver to BuildState" —
// the AST walker catches that independent of surrounding syntax. Pattern 3
// collapses into "any call on the receiver to snapshot()". Pattern 2 is
// structurally identical to 1 once we stop caring about the return path.
//
// The previous awk+grep implementation at scripts/check-playeraware-coverage.sh
// missed patterns 2 through 4 because they spanned more than -A2 lines or
// used intermediate variables. This tool is a drop-in replacement.
//
// Usage:
//
//	go run ./cmd/playeraware-lint ./internal/module/...
//	go run ./cmd/playeraware-lint --allow path/to/exempt ./internal/module/...
package main

import (
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type violation struct {
	file    string
	line    int
	module  string // receiver type name (e.g. "CombinationModule")
	pattern string
	snippet string // trimmed source excerpt
}

func main() {
	allowFlag := flag.String("allow", "", "comma-separated directory paths to exempt (deprecated — should normally be empty)")
	flag.Usage = usage
	flag.Parse()

	roots := flag.Args()
	if len(roots) == 0 {
		usage()
		os.Exit(2)
	}

	allow := parseAllowList(*allowFlag)

	var all []violation
	for _, root := range roots {
		root = strings.TrimSuffix(root, "/...")
		if err := walk(root, allow, &all); err != nil {
			fmt.Fprintf(os.Stderr, "playeraware-lint: walk %s: %v\n", root, err)
			os.Exit(2)
		}
	}

	if len(all) == 0 {
		fmt.Println("✅ playeraware-lint: no BuildStateFor delegates to BuildState/snapshot.")
		return
	}

	sort.Slice(all, func(i, j int) bool {
		if all[i].file != all[j].file {
			return all[i].file < all[j].file
		}
		return all[i].line < all[j].line
	})

	fmt.Fprintln(os.Stderr, "❌ playeraware-lint: BuildStateFor must do real per-player redaction:")
	fmt.Fprintln(os.Stderr, "")
	for _, v := range all {
		fmt.Fprintf(os.Stderr, "  %s:%d  (*%s).BuildStateFor — %s\n", v.file, v.line, v.module, v.pattern)
		if v.snippet != "" {
			fmt.Fprintf(os.Stderr, "    > %s\n", v.snippet)
		}
	}
	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintln(os.Stderr, "Fix: implement real per-player redaction (e.g. snapshotFor(playerID)),")
	fmt.Fprintln(os.Stderr, "or switch the module to engine.PublicStateMarker + drop BuildStateFor.")
	os.Exit(1)
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: playeraware-lint [--allow pkg1,pkg2] <dir>[/...]...")
}

func parseAllowList(raw string) map[string]struct{} {
	out := map[string]struct{}{}
	if raw == "" {
		return out
	}
	for _, p := range strings.Split(raw, ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			out[filepath.Clean(p)] = struct{}{}
		}
	}
	return out
}

func walk(root string, allow map[string]struct{}, out *[]violation) error {
	return filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if _, skip := allow[filepath.Clean(path)]; skip {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		vs, err := inspectFile(path)
		if err != nil {
			return err
		}
		*out = append(*out, vs...)
		return nil
	})
}

// inspectFile parses a single Go source file and returns any violations in
// its BuildStateFor method bodies. Pure AST — no type resolution required.
func inspectFile(path string) ([]violation, error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, path, nil, parser.SkipObjectResolution)
	if err != nil {
		return nil, err
	}
	return inspectAST(fset, file, path), nil
}

// inspectAST is the analyser used by both the filesystem walker and the
// in-memory test fixtures.
func inspectAST(fset *token.FileSet, file *ast.File, path string) []violation {
	var violations []violation
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Name == nil || fn.Name.Name != "BuildStateFor" {
			continue
		}
		if fn.Recv == nil || len(fn.Recv.List) == 0 || fn.Body == nil {
			continue
		}
		recvName := receiverIdentName(fn.Recv.List[0])
		if recvName == "" {
			continue // anonymous receiver — cannot match method calls reliably
		}
		typeName := receiverTypeName(fn.Recv.List[0])

		ast.Inspect(fn.Body, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			sel, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			ident, ok := sel.X.(*ast.Ident)
			if !ok || ident.Name != recvName {
				return true
			}
			switch sel.Sel.Name {
			case "BuildState":
				violations = append(violations, violation{
					file:    path,
					line:    fset.Position(call.Pos()).Line,
					module:  typeName,
					pattern: "delegates to BuildState() — reveals every player's state",
					snippet: fmt.Sprintf("%s.BuildState()", recvName),
				})
			case "snapshot":
				violations = append(violations, violation{
					file:    path,
					line:    fset.Position(call.Pos()).Line,
					module:  typeName,
					pattern: "calls whole-map snapshot() from within per-player BuildStateFor",
					snippet: fmt.Sprintf("%s.snapshot()", recvName),
				})
			}
			return true
		})
	}
	return violations
}

func receiverIdentName(field *ast.Field) string {
	if len(field.Names) == 0 {
		return ""
	}
	return field.Names[0].Name
}

func receiverTypeName(field *ast.Field) string {
	expr := field.Type
	if star, ok := expr.(*ast.StarExpr); ok {
		expr = star.X
	}
	if ident, ok := expr.(*ast.Ident); ok {
		return ident.Name
	}
	return "<unknown>"
}
