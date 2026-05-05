package flow

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
)

func TestServiceFlowOwnership_RejectsDifferentCreatorMutations(t *testing.T) {
	ctx := context.Background()
	pool := setupFlowTestPool(t)
	svc := NewService(pool, zerolog.Nop())
	ownerID := insertFlowTestUser(t, pool)
	otherCreatorID := insertFlowTestUser(t, pool)
	themeID := insertFlowTestTheme(t, pool, ownerID, json.RawMessage(`{}`))

	startNode, err := svc.CreateNode(ctx, ownerID, themeID, CreateNodeRequest{
		Type:      NodeTypeStart,
		Data:      json.RawMessage(`{}`),
		PositionX: 10,
		PositionY: 20,
	})
	if err != nil {
		t.Fatalf("CreateNode start: %v", err)
	}
	phaseNode, err := svc.CreateNode(ctx, ownerID, themeID, CreateNodeRequest{
		Type:      NodeTypePhase,
		Data:      json.RawMessage(`{"label":"조사"}`),
		PositionX: 100,
		PositionY: 120,
	})
	if err != nil {
		t.Fatalf("CreateNode phase: %v", err)
	}
	edge, err := svc.CreateEdge(ctx, ownerID, themeID, CreateEdgeRequest{
		SourceID:  startNode.ID,
		TargetID:  phaseNode.ID,
		Condition: validFlowCondition(),
		SortOrder: 1,
	})
	if err != nil {
		t.Fatalf("CreateEdge: %v", err)
	}

	if _, err := svc.GetFlow(ctx, otherCreatorID, themeID); err == nil {
		t.Fatal("expected GetFlow to reject a different creator")
	} else {
		assertFlowNotFound(t, err)
	}

	if _, err := svc.SaveFlow(ctx, otherCreatorID, themeID, validSaveFlowRequest()); err == nil {
		t.Fatal("expected SaveFlow to reject a different creator")
	} else {
		assertFlowNotFound(t, err)
	}
	assertFlowNodeExists(t, pool, startNode.ID)

	if _, err := svc.CreateNode(ctx, otherCreatorID, themeID, CreateNodeRequest{
		Type:      NodeTypePhase,
		Data:      json.RawMessage(`{}`),
		PositionX: 0,
		PositionY: 0,
	}); err == nil {
		t.Fatal("expected CreateNode to reject a different creator")
	} else {
		assertFlowNotFound(t, err)
	}

	if _, err := svc.UpdateNode(ctx, otherCreatorID, themeID, startNode.ID, UpdateNodeRequest{
		Type:      NodeTypeEnding,
		Data:      json.RawMessage(`{"label":"탈취"}`),
		PositionX: 999,
		PositionY: 999,
	}); err == nil {
		t.Fatal("expected UpdateNode to reject a different creator")
	} else {
		assertFlowNotFound(t, err)
	}
	assertFlowNodeType(t, pool, startNode.ID, NodeTypeStart)

	if _, err := svc.CreateEdge(ctx, otherCreatorID, themeID, CreateEdgeRequest{
		SourceID:  startNode.ID,
		TargetID:  phaseNode.ID,
		Condition: validFlowCondition(),
		SortOrder: 2,
	}); err == nil {
		t.Fatal("expected CreateEdge to reject a different creator")
	} else {
		assertFlowNotFound(t, err)
	}

	if _, err := svc.UpdateEdge(ctx, otherCreatorID, themeID, edge.ID, UpdateEdgeRequest{
		SourceID:  phaseNode.ID,
		TargetID:  startNode.ID,
		Condition: validFlowCondition(),
		SortOrder: 3,
	}); err == nil {
		t.Fatal("expected UpdateEdge to reject a different creator")
	} else {
		assertFlowNotFound(t, err)
	}

	if err := svc.DeleteEdge(ctx, otherCreatorID, themeID, edge.ID); err == nil {
		t.Fatal("expected DeleteEdge to reject a different creator")
	} else {
		assertFlowNotFound(t, err)
	}
	assertFlowEdgeExists(t, pool, edge.ID)
}

func TestServiceFlowOwnership_RejectsCrossThemeEdgeEndpoints(t *testing.T) {
	ctx := context.Background()
	pool := setupFlowTestPool(t)
	svc := NewService(pool, zerolog.Nop())
	creatorID := insertFlowTestUser(t, pool)
	themeAID := insertFlowTestTheme(t, pool, creatorID, json.RawMessage(`{}`))
	themeBID := insertFlowTestTheme(t, pool, creatorID, json.RawMessage(`{}`))

	nodeA, err := svc.CreateNode(ctx, creatorID, themeAID, CreateNodeRequest{
		Type:      NodeTypeStart,
		Data:      json.RawMessage(`{}`),
		PositionX: 0,
		PositionY: 0,
	})
	if err != nil {
		t.Fatalf("CreateNode theme A: %v", err)
	}
	nodeA2, err := svc.CreateNode(ctx, creatorID, themeAID, CreateNodeRequest{
		Type:      NodeTypePhase,
		Data:      json.RawMessage(`{}`),
		PositionX: 10,
		PositionY: 0,
	})
	if err != nil {
		t.Fatalf("CreateNode theme A phase: %v", err)
	}
	nodeB, err := svc.CreateNode(ctx, creatorID, themeBID, CreateNodeRequest{
		Type:      NodeTypePhase,
		Data:      json.RawMessage(`{}`),
		PositionX: 0,
		PositionY: 0,
	})
	if err != nil {
		t.Fatalf("CreateNode theme B: %v", err)
	}
	if _, err := svc.UpdateNode(ctx, creatorID, themeAID, nodeB.ID, UpdateNodeRequest{
		Type:      NodeTypeEnding,
		Data:      json.RawMessage(`{"label":"wrong theme"}`),
		PositionX: 99,
		PositionY: 99,
	}); err == nil {
		t.Fatal("expected UpdateNode to reject a node from a different theme")
	} else {
		assertFlowNotFound(t, err)
	}
	assertFlowNodeType(t, pool, nodeB.ID, NodeTypePhase)

	if _, err := svc.CreateEdge(ctx, creatorID, themeAID, CreateEdgeRequest{
		SourceID:  nodeA.ID,
		TargetID:  nodeB.ID,
		Condition: validFlowCondition(),
		SortOrder: 1,
	}); err == nil {
		t.Fatal("expected CreateEdge to reject a node from a different theme")
	} else {
		assertFlowNotFound(t, err)
	}

	edge, err := svc.CreateEdge(ctx, creatorID, themeAID, CreateEdgeRequest{
		SourceID:  nodeA.ID,
		TargetID:  nodeA2.ID,
		Condition: validFlowCondition(),
		SortOrder: 2,
	})
	if err != nil {
		t.Fatalf("CreateEdge valid: %v", err)
	}
	if _, err := svc.UpdateEdge(ctx, creatorID, themeAID, edge.ID, UpdateEdgeRequest{
		SourceID:  nodeA.ID,
		TargetID:  nodeB.ID,
		Condition: validFlowCondition(),
		SortOrder: 3,
	}); err == nil {
		t.Fatal("expected UpdateEdge to reject a node from a different theme")
	} else {
		assertFlowNotFound(t, err)
	}
	assertFlowEdgeTarget(t, pool, edge.ID, nodeA2.ID)

	if _, err := svc.UpdateEdge(ctx, creatorID, themeBID, edge.ID, UpdateEdgeRequest{
		SourceID:  nodeB.ID,
		TargetID:  nodeB.ID,
		Condition: validFlowCondition(),
		SortOrder: 4,
	}); err == nil {
		t.Fatal("expected UpdateEdge to reject an edge from a different route theme")
	} else {
		assertFlowNotFound(t, err)
	}
	assertFlowEdgeTarget(t, pool, edge.ID, nodeA2.ID)

	if err := svc.DeleteEdge(ctx, creatorID, themeBID, edge.ID); err == nil {
		t.Fatal("expected DeleteEdge to reject an edge from a different route theme")
	} else {
		assertFlowNotFound(t, err)
	}
	assertFlowEdgeExists(t, pool, edge.ID)
}

func validSaveFlowRequest() SaveFlowRequest {
	return SaveFlowRequest{
		Nodes: []FlowNodeInput{{
			Type:      NodeTypeStart,
			Data:      json.RawMessage(`{}`),
			PositionX: 0,
			PositionY: 0,
		}},
		Edges: []FlowEdgeInput{},
	}
}

func validFlowCondition() json.RawMessage {
	return json.RawMessage(`{"id":"group-1","operator":"AND","rules":[{"id":"rule-1","variable":"custom_flag","target_flag_key":"flow_ownership","comparator":"=","value":"true"}]}`)
}

func assertFlowNotFound(t *testing.T, err error) {
	t.Helper()
	appErr, ok := err.(*apperror.AppError)
	if !ok || appErr.Code != apperror.ErrNotFound {
		t.Fatalf("expected not found app error, got %#v", err)
	}
}

func assertFlowNodeExists(t *testing.T, pool *pgxpool.Pool, nodeID uuid.UUID) {
	t.Helper()
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM flow_nodes WHERE id=$1`, nodeID).Scan(&count); err != nil {
		t.Fatalf("count flow node: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected flow node to remain, got %d rows", count)
	}
}

func assertFlowNodeType(t *testing.T, pool *pgxpool.Pool, nodeID uuid.UUID, want string) {
	t.Helper()
	var got string
	if err := pool.QueryRow(context.Background(), `SELECT type FROM flow_nodes WHERE id=$1`, nodeID).Scan(&got); err != nil {
		t.Fatalf("read flow node type: %v", err)
	}
	if got != want {
		t.Fatalf("flow node type = %q, want %q", got, want)
	}
}

func assertFlowEdgeExists(t *testing.T, pool *pgxpool.Pool, edgeID uuid.UUID) {
	t.Helper()
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM flow_edges WHERE id=$1`, edgeID).Scan(&count); err != nil {
		t.Fatalf("count flow edge: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected flow edge to remain, got %d rows", count)
	}
}

func assertFlowEdgeTarget(t *testing.T, pool *pgxpool.Pool, edgeID, want uuid.UUID) {
	t.Helper()
	var got uuid.UUID
	if err := pool.QueryRow(context.Background(), `SELECT target_id FROM flow_edges WHERE id=$1`, edgeID).Scan(&got); err != nil {
		t.Fatalf("read flow edge target: %v", err)
	}
	if got != want {
		t.Fatalf("flow edge target = %s, want %s", got, want)
	}
}
