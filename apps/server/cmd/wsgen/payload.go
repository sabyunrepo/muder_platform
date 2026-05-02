package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"reflect"
	"sort"
	"strings"
)

// PayloadStruct is the denormalised form of a Go struct earmarked for TS
// interface emission via the `//wsgen:payload` doc comment marker.
type PayloadStruct struct {
	Name    string
	Comment string // doc comment (minus the marker line) for JSDoc
	Fields  []PayloadField
}

// PayloadField is a single struct field mapped to TS.
type PayloadField struct {
	JSONName string
	TSType   string
	Optional bool // json tag "omitempty" (or pointer)
}

const payloadMarker = "wsgen:payload"

// extractPayloads scans dir (non-recursively; .go files only, _test excluded)
// for struct declarations whose doc comment group contains `wsgen:payload`.
// Each matching struct becomes a PayloadStruct in the output.
//
// Only top-level struct types are considered; nested / anonymous structs
// are intentionally out-of-scope for v1.5 (Phase 19 PR-1). json tags are
// honoured: the tag name becomes the TS property key, and `omitempty`
// flags the field optional. Pointer types also become optional (nullable
// → `T | null` plus `?` key).
func extractPayloads(dir string) ([]PayloadStruct, error) {
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, dir, func(fi fs.FileInfo) bool {
		return !strings.HasSuffix(fi.Name(), "_test.go")
	}, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("parse dir %s: %w", dir, err)
	}

	var out []PayloadStruct
	for _, pkg := range pkgs {
		for _, f := range pkg.Files {
			for _, decl := range f.Decls {
				gd, ok := decl.(*ast.GenDecl)
				if !ok || gd.Tok != token.TYPE || !hasMarker(gd.Doc) {
					continue
				}
				for _, spec := range gd.Specs {
					ps, ok := buildPayload(spec, gd.Doc)
					if ok {
						out = append(out, ps)
					}
				}
			}
		}
	}
	// Sort by struct name for deterministic output across Go versions and
	// runs (parser.ParseDir returns map[string]*ast.Package whose iteration
	// order is randomized).
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func hasMarker(doc *ast.CommentGroup) bool {
	if doc == nil {
		return false
	}
	return strings.Contains(doc.Text(), payloadMarker)
}

func buildPayload(spec ast.Spec, doc *ast.CommentGroup) (PayloadStruct, bool) {
	ts, ok := spec.(*ast.TypeSpec)
	if !ok {
		return PayloadStruct{}, false
	}
	st, ok := ts.Type.(*ast.StructType)
	if !ok {
		return PayloadStruct{}, false
	}
	ps := PayloadStruct{
		Name:    ts.Name.Name,
		Comment: cleanDoc(doc),
		Fields:  convertFields(st.Fields),
	}
	return ps, true
}

// cleanDoc extracts the non-marker lines of the doc comment group so they
// survive into the generated TS JSDoc, while stripping the `wsgen:payload`
// directive itself (and any blank line that held it).
func cleanDoc(doc *ast.CommentGroup) string {
	if doc == nil {
		return ""
	}
	var kept []string
	for _, line := range strings.Split(strings.TrimSpace(doc.Text()), "\n") {
		if strings.Contains(line, payloadMarker) {
			continue
		}
		kept = append(kept, line)
	}
	return strings.TrimSpace(strings.Join(kept, "\n"))
}

func convertFields(fl *ast.FieldList) []PayloadField {
	if fl == nil {
		return nil
	}
	var out []PayloadField
	for _, field := range fl.List {
		jsonName, omitempty := parseJSONTag(field.Tag)
		tsType, pointer := goTypeToTS(field.Type)
		optional := omitempty || pointer
		for _, name := range field.Names {
			jn := jsonName
			if jn == "" {
				jn = name.Name
			}
			if jn == "-" {
				continue
			}
			out = append(out, PayloadField{
				JSONName: jn,
				TSType:   tsType,
				Optional: optional,
			})
		}
	}
	return out
}

func parseJSONTag(lit *ast.BasicLit) (name string, omitempty bool) {
	if lit == nil {
		return "", false
	}
	raw := strings.Trim(lit.Value, "`")
	tag := reflect.StructTag(raw)
	j := tag.Get("json")
	if j == "" {
		return "", false
	}
	parts := strings.Split(j, ",")
	name = parts[0]
	for _, p := range parts[1:] {
		if p == "omitempty" {
			omitempty = true
		}
	}
	return
}

// goTypeToTS maps a Go AST type expression to a TypeScript type.
// Returns (tsType, isPointer) — pointer types also render as nullable in
// addition to the caller marking the field optional.
func goTypeToTS(expr ast.Expr) (string, bool) {
	switch t := expr.(type) {
	case *ast.Ident:
		return mapPrimitive(t.Name), false
	case *ast.StarExpr:
		inner, _ := goTypeToTS(t.X)
		return inner + " | null", true
	case *ast.ArrayType:
		inner, _ := goTypeToTS(t.Elt)
		return inner + "[]", false
	case *ast.MapType:
		k, _ := goTypeToTS(t.Key)
		v, _ := goTypeToTS(t.Value)
		return fmt.Sprintf("Record<%s, %s>", k, v), false
	case *ast.SelectorExpr:
		ident, ok := t.X.(*ast.Ident)
		if !ok {
			return "unknown", false
		}
		return mapQualified(ident.Name + "." + t.Sel.Name), false
	case *ast.InterfaceType:
		return "unknown", false
	}
	return "unknown", false
}

func mapPrimitive(n string) string {
	switch n {
	case "string":
		return "string"
	case "bool":
		return "boolean"
	case "int", "int8", "int16", "int32", "int64",
		"uint", "uint8", "uint16", "uint32", "uint64",
		"float32", "float64", "byte", "rune":
		return "number"
	case "any":
		return "unknown"
	}
	// Project-local named types that are numeric / string aliases on the
	// wire. Extend this table as new payload structs are opted in via
	// //wsgen:payload. An unmapped named type falls through to the raw
	// identifier so the TS compiler flags the mapping gap loudly.
	switch n {
	case "ErrorCode":
		return "number"
	}
	return n
}

func mapQualified(qualified string) string {
	switch qualified {
	case "uuid.UUID":
		return "string"
	case "time.Time":
		return "number"
	case "json.RawMessage":
		return "unknown"
	}
	return "unknown"
}
