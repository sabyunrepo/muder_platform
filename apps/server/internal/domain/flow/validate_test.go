package flow

import (
	"testing"

	"github.com/google/uuid"
)

func node(id uuid.UUID, t string) FlowNode {
	return FlowNode{ID: id, Type: t}
}

func edge(src, tgt uuid.UUID) FlowEdge {
	return FlowEdge{SourceID: src, TargetID: tgt}
}

func TestValidateDAG_NoCycle(t *testing.T) {
	a, b, c := uuid.New(), uuid.New(), uuid.New()
	nodes := []FlowNode{node(a, NodeTypeStart), node(b, NodeTypePhase), node(c, NodeTypeEnding)}
	edges := []FlowEdge{edge(a, b), edge(b, c)}
	if err := ValidateDAG(nodes, edges); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestValidateDAG_WithCycle(t *testing.T) {
	a, b, c := uuid.New(), uuid.New(), uuid.New()
	nodes := []FlowNode{node(a, NodeTypeStart), node(b, NodeTypePhase), node(c, NodeTypeBranch)}
	edges := []FlowEdge{edge(a, b), edge(b, c), edge(c, b)} // b→c→b cycle
	if err := ValidateDAG(nodes, edges); err == nil {
		t.Fatal("expected cycle error, got nil")
	}
}

func TestValidateDAG_NoStartNode(t *testing.T) {
	a, b := uuid.New(), uuid.New()
	nodes := []FlowNode{node(a, NodeTypePhase), node(b, NodeTypeEnding)}
	edges := []FlowEdge{edge(a, b)}
	if err := ValidateDAG(nodes, edges); err == nil {
		t.Fatal("expected error for missing start node")
	}
}

func TestValidateDAG_MultipleStartNodes(t *testing.T) {
	a, b, c := uuid.New(), uuid.New(), uuid.New()
	nodes := []FlowNode{node(a, NodeTypeStart), node(b, NodeTypeStart), node(c, NodeTypeEnding)}
	edges := []FlowEdge{edge(a, c), edge(b, c)}
	if err := ValidateDAG(nodes, edges); err == nil {
		t.Fatal("expected error for multiple start nodes")
	}
}

func TestValidateDAG_SingleStartNode(t *testing.T) {
	a := uuid.New()
	nodes := []FlowNode{node(a, NodeTypeStart)}
	if err := ValidateDAG(nodes, nil); err != nil {
		t.Fatalf("expected no error for single start node, got %v", err)
	}
}

func TestValidateNodeType_Valid(t *testing.T) {
	for _, tp := range []string{NodeTypeStart, NodeTypePhase, NodeTypeBranch, NodeTypeEnding} {
		if err := ValidateNodeType(tp); err != nil {
			t.Errorf("expected valid type %q, got error %v", tp, err)
		}
	}
}

func TestValidateNodeType_Invalid(t *testing.T) {
	if err := ValidateNodeType("unknown"); err == nil {
		t.Fatal("expected error for unknown node type")
	}
}
