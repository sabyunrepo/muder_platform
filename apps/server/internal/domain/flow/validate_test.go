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

func TestValidateDAG_DisconnectedNode(t *testing.T) {
	a, b, c := uuid.New(), uuid.New(), uuid.New()
	// c is disconnected — no edges touch it
	nodes := []FlowNode{node(a, NodeTypeStart), node(b, NodeTypePhase), node(c, NodeTypeEnding)}
	edges := []FlowEdge{edge(a, b)}
	// disconnected nodes are not cycles; should pass DAG validation
	if err := ValidateDAG(nodes, edges); err != nil {
		t.Fatalf("expected no error for disconnected node, got %v", err)
	}
}

func TestValidateDAG_SelfLoop(t *testing.T) {
	a, b := uuid.New(), uuid.New()
	nodes := []FlowNode{node(a, NodeTypeStart), node(b, NodeTypePhase)}
	edges := []FlowEdge{edge(a, b), edge(b, b)} // b→b self-loop
	if err := ValidateDAG(nodes, edges); err == nil {
		t.Fatal("expected cycle error for self-loop, got nil")
	}
}

func TestValidateDAG_LargeGraph(t *testing.T) {
	// 100 nodes in a linear chain: start → p[0] → p[1] → ... → p[98]
	const n = 100
	ids := make([]uuid.UUID, n)
	for i := range ids {
		ids[i] = uuid.New()
	}
	nodes := make([]FlowNode, n)
	nodes[0] = node(ids[0], NodeTypeStart)
	for i := 1; i < n-1; i++ {
		nodes[i] = node(ids[i], NodeTypePhase)
	}
	nodes[n-1] = node(ids[n-1], NodeTypeEnding)

	edges := make([]FlowEdge, n-1)
	for i := 0; i < n-1; i++ {
		edges[i] = edge(ids[i], ids[i+1])
	}
	if err := ValidateDAG(nodes, edges); err != nil {
		t.Fatalf("expected no error for large linear graph, got %v", err)
	}
}

func TestValidateDAG_EndingWithOutput(t *testing.T) {
	// ending node with an outgoing edge — DAG validator doesn't block this
	// (business rule check is separate); should still pass cycle detection
	a, b, c := uuid.New(), uuid.New(), uuid.New()
	nodes := []FlowNode{node(a, NodeTypeStart), node(b, NodeTypeEnding), node(c, NodeTypePhase)}
	edges := []FlowEdge{edge(a, b), edge(b, c)} // ending → phase is unusual but not a cycle
	if err := ValidateDAG(nodes, edges); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}
