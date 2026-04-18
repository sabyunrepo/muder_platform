package main

import (
	"go/ast"
	"go/parser"
	"go/token"
	"strings"
	"testing"
)

// Each fixture exercises one known regression shape. `want` indicates whether
// inspectAST must return at least one violation from the module's
// BuildStateFor body. The linter deliberately accepts some legitimate patterns
// (direct map access, snapshotFor dispatch) as negatives.
var fixtures = []struct {
	name         string
	src          string
	wantAnyMatch bool
	wantPattern  string // substring the reported pattern must contain (only for positives)
}{
	{
		name: "ok_snapshotFor_dispatch",
		src: `package combination
import (
	"encoding/json"
	"github.com/google/uuid"
)
type M struct{}
func (m *M) snapshotFor(uuid.UUID) map[string][]string { return map[string][]string{} }
func (m *M) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	return json.Marshal(m.snapshotFor(playerID))
}`,
		wantAnyMatch: false,
	},
	{
		name: "ok_direct_field_access",
		src: `package combination
import (
	"encoding/json"
	"github.com/google/uuid"
)
type M struct{ completed map[string][]string }
func (m *M) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
	key := playerID.String()
	_ = key
	return json.Marshal(m.completed[key])
}`,
		wantAnyMatch: false,
	},
	{
		name: "bad_direct_delegate",
		src: `package combination
import (
	"encoding/json"
	"github.com/google/uuid"
)
type M struct{}
func (m *M) BuildState() (json.RawMessage, error) { return nil, nil }
func (m *M) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	return m.BuildState()
}`,
		wantAnyMatch: true,
		wantPattern:  "BuildState()",
	},
	{
		name: "bad_two_line_capture",
		src: `package combination
import (
	"encoding/json"
	"github.com/google/uuid"
)
type M struct{}
func (m *M) BuildState() (json.RawMessage, error) { return nil, nil }
func (m *M) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	data, err := m.BuildState()
	return data, err
}`,
		wantAnyMatch: true,
		wantPattern:  "BuildState()",
	},
	{
		name: "bad_marshal_whole_snapshot",
		src: `package combination
import (
	"encoding/json"
	"github.com/google/uuid"
)
type M struct{}
func (m *M) snapshot() any { return nil }
func (m *M) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	return json.Marshal(m.snapshot())
}`,
		wantAnyMatch: true,
		wantPattern:  "snapshot()",
	},
	{
		name: "bad_three_line_stub",
		src: `package combination
import (
	"encoding/json"
	"github.com/google/uuid"
)
type M struct{}
func (m *M) BuildState() (json.RawMessage, error) { return nil, nil }
func (m *M) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
	// noop
	_ = 1
	return m.BuildState()
}`,
		wantAnyMatch: true,
		wantPattern:  "BuildState()",
	},
}

func TestInspectAST_Fixtures(t *testing.T) {
	for _, tc := range fixtures {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			fset := token.NewFileSet()
			file, err := parser.ParseFile(fset, tc.name+".go", tc.src, parser.SkipObjectResolution)
			if err != nil {
				t.Fatalf("parse: %v", err)
			}
			got := inspectAST(fset, file, tc.name+".go")

			if tc.wantAnyMatch && len(got) == 0 {
				t.Fatalf("expected violations for %q, got none", tc.name)
			}
			if !tc.wantAnyMatch && len(got) != 0 {
				t.Fatalf("expected NO violations for %q, got %d: %v", tc.name, len(got), got)
			}
			if !tc.wantAnyMatch {
				return
			}
			found := false
			for _, v := range got {
				if strings.Contains(v.snippet, tc.wantPattern) || strings.Contains(v.pattern, tc.wantPattern) {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("expected pattern containing %q, got %+v", tc.wantPattern, got)
			}
		})
	}
}

// TestParseAllowList_TrimsAndClean ensures the CLI flag parser is robust
// against whitespace and trailing slashes.
func TestParseAllowList_TrimsAndClean(t *testing.T) {
	m := parseAllowList(" foo/bar , baz/ ,,  ")
	if _, ok := m["foo/bar"]; !ok {
		t.Errorf("expected foo/bar in allow list: %v", m)
	}
	if _, ok := m["baz"]; !ok {
		t.Errorf("expected baz (trailing slash trimmed by filepath.Clean) in allow list: %v", m)
	}
	if len(m) != 2 {
		t.Errorf("expected 2 entries, got %d: %v", len(m), m)
	}
}

// TestReceiverIdentName covers the two shapes the tool must handle.
func TestReceiverHelpers(t *testing.T) {
	src := `package x
type M struct{}
func (m *M) A() {}
func (*M) B() {}`
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "x.go", src, parser.SkipObjectResolution)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	got := map[string]struct {
		name string
		typ  string
	}{}
	for _, d := range file.Decls {
		fn, ok := d.(*ast.FuncDecl)
		if !ok || fn.Recv == nil {
			continue
		}
		got[fn.Name.Name] = struct {
			name string
			typ  string
		}{
			name: receiverIdentName(fn.Recv.List[0]),
			typ:  receiverTypeName(fn.Recv.List[0]),
		}
	}
	if got["A"].name != "m" || got["A"].typ != "M" {
		t.Errorf("A receiver: got %+v, want {m M}", got["A"])
	}
	if got["B"].name != "" || got["B"].typ != "M" {
		t.Errorf("B receiver: got %+v, want {\"\" M}", got["B"])
	}
}
