package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"strconv"
	"strings"
)

// EventEntry is the denormalised form of a Go EventDef literal, with all
// identifier references (TypePing, DirS2C, StatusStub, ...) already
// resolved to their underlying string / enum value.
type EventEntry struct {
	Type      string // wire type, e.g. "phase.advanced"
	Direction string // "c2s" | "s2c" | "bidi"
	Category  string // coarse grouping
	Status    string // "active" | "stub" | "deprec"
	Note      string // optional one-liner for generated TS JSDoc
}

// extractCatalog parses every .go file in dir (excluding _test.go) and
// returns the list of EventDef literals passed to RegisterCatalog calls.
// Identifier values (const names) are resolved via a package-wide const
// map built from the same source set — so entries like
// `{Type: TypePing, Direction: DirBidi, Category: "system"}` surface as
// `{Type: "ping", Direction: "bidi", Category: "system"}`.
func extractCatalog(dir string) ([]EventEntry, error) {
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, dir, func(fi fs.FileInfo) bool {
		return !strings.HasSuffix(fi.Name(), "_test.go")
	}, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("parse dir %s: %w", dir, err)
	}

	var pkg *ast.Package
	for _, p := range pkgs {
		if pkg == nil || len(p.Files) > len(pkg.Files) {
			pkg = p
		}
	}
	if pkg == nil {
		return nil, fmt.Errorf("no package in %s", dir)
	}

	consts := buildConstMap(pkg)

	var out []EventEntry
	for _, f := range pkg.Files {
		ast.Inspect(f, func(n ast.Node) bool {
			call, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}
			if !isRegisterCatalogCall(call) {
				return true
			}
			for _, arg := range call.Args {
				if e, ok := parseEventDefLit(arg, consts); ok {
					out = append(out, e)
				}
			}
			return true
		})
	}
	return out, nil
}

// isRegisterCatalogCall matches both `RegisterCatalog(...)` and the
// fully-qualified `ws.RegisterCatalog(...)` variant (future-proof for
// callers outside the package if any).
func isRegisterCatalogCall(call *ast.CallExpr) bool {
	switch fn := call.Fun.(type) {
	case *ast.Ident:
		return fn.Name == "RegisterCatalog"
	case *ast.SelectorExpr:
		return fn.Sel != nil && fn.Sel.Name == "RegisterCatalog"
	}
	return false
}

// buildConstMap collects top-level `const X = "literal"` bindings so
// EventDef fields referring to named string constants can be resolved.
func buildConstMap(pkg *ast.Package) map[string]string {
	m := make(map[string]string)
	for _, f := range pkg.Files {
		for _, decl := range f.Decls {
			gd, ok := decl.(*ast.GenDecl)
			if !ok || gd.Tok != token.CONST {
				continue
			}
			for _, spec := range gd.Specs {
				vs, ok := spec.(*ast.ValueSpec)
				if !ok {
					continue
				}
				for i, name := range vs.Names {
					if i >= len(vs.Values) {
						continue
					}
					lit, ok := vs.Values[i].(*ast.BasicLit)
					if !ok || lit.Kind != token.STRING {
						continue
					}
					if v, err := strconv.Unquote(lit.Value); err == nil {
						m[name.Name] = v
					}
				}
			}
		}
	}
	return m
}

// parseEventDefLit recognises an `EventDef{...}` composite literal and
// pulls out each named field (Type, Direction, Category, Status, Note).
// Unknown fields and positional forms are ignored — the catalog uses only
// keyed form by convention.
func parseEventDefLit(expr ast.Expr, consts map[string]string) (EventEntry, bool) {
	cl, ok := expr.(*ast.CompositeLit)
	if !ok {
		return EventEntry{}, false
	}
	id, ok := cl.Type.(*ast.Ident)
	if !ok || id.Name != "EventDef" {
		return EventEntry{}, false
	}
	e := EventEntry{Status: "active"}
	for _, el := range cl.Elts {
		kv, ok := el.(*ast.KeyValueExpr)
		if !ok {
			continue
		}
		key, ok := kv.Key.(*ast.Ident)
		if !ok {
			continue
		}
		val := literalOrConst(kv.Value, consts)
		switch key.Name {
		case "Type":
			e.Type = val
		case "Direction":
			e.Direction = dirToString(val)
		case "Category":
			e.Category = val
		case "Status":
			e.Status = statusToString(val)
		case "Note":
			e.Note = val
		}
	}
	return e, true
}

func literalOrConst(expr ast.Expr, consts map[string]string) string {
	switch v := expr.(type) {
	case *ast.BasicLit:
		if v.Kind == token.STRING {
			s, _ := strconv.Unquote(v.Value)
			return s
		}
		return v.Value
	case *ast.Ident:
		if s, ok := consts[v.Name]; ok {
			return s
		}
		return v.Name
	}
	return ""
}

func dirToString(v string) string {
	switch v {
	case "DirC2S":
		return "c2s"
	case "DirS2C":
		return "s2c"
	case "DirBidi":
		return "bidi"
	}
	return "unknown"
}

func statusToString(v string) string {
	switch v {
	case "StatusStub":
		return "stub"
	case "StatusDeprec":
		return "deprec"
	default:
		return "active"
	}
}
