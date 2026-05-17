package flow

import (
	"context"
	"encoding/json"
	"testing"
	"time"

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
		PositionX: flowFloat64Ptr(999),
		PositionY: flowFloat64Ptr(999),
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

	if err := svc.DeleteNode(ctx, otherCreatorID, themeID, startNode.ID); err == nil {
		t.Fatal("expected DeleteNode to reject a different creator")
	} else {
		assertFlowNotFound(t, err)
	}
	assertFlowNodeExists(t, pool, startNode.ID)
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
		PositionX: flowFloat64Ptr(99),
		PositionY: flowFloat64Ptr(99),
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

	if err := svc.DeleteNode(ctx, creatorID, themeBID, nodeA.ID); err == nil {
		t.Fatal("expected DeleteNode to reject a node from a different route theme")
	} else {
		assertFlowNotFound(t, err)
	}
	assertFlowNodeExists(t, pool, nodeA.ID)
}

func TestServiceFlowOwnership_SaveFlowOwnedGraphPreservesProvidedNodeIDs(t *testing.T) {
	ctx := context.Background()
	pool := setupFlowTestPool(t)
	svc := NewService(pool, zerolog.Nop())
	creatorID := insertFlowTestUser(t, pool)
	themeID := insertFlowTestTheme(t, pool, creatorID, json.RawMessage(`{}`))
	clientStartID := uuid.New()
	clientPhaseID := uuid.New()

	graph, err := svc.SaveFlow(ctx, creatorID, themeID, SaveFlowRequest{
		Nodes: []FlowNodeInput{
			{
				ID:        &clientStartID,
				Type:      NodeTypeStart,
				PositionX: 0,
				PositionY: 0,
			},
			{
				ID:        &clientPhaseID,
				Type:      NodeTypePhase,
				Data:      json.RawMessage(`{"label":"조사"}`),
				PositionX: 100,
				PositionY: 50,
			},
		},
		Edges: []FlowEdgeInput{{
			SourceID:  clientStartID,
			TargetID:  clientPhaseID,
			Condition: validFlowCondition(),
			SortOrder: 1,
		}},
	})
	if err != nil {
		t.Fatalf("SaveFlow: %v", err)
	}
	if len(graph.Nodes) != 2 || len(graph.Edges) != 1 {
		t.Fatalf("graph sizes = nodes %d edges %d, want 2/1", len(graph.Nodes), len(graph.Edges))
	}
	nodeIDs := map[uuid.UUID]struct{}{}
	for _, node := range graph.Nodes {
		nodeIDs[node.ID] = struct{}{}
	}
	if _, ok := nodeIDs[clientStartID]; !ok {
		t.Fatalf("saved nodes do not include provided start ID %s", clientStartID)
	}
	if _, ok := nodeIDs[clientPhaseID]; !ok {
		t.Fatalf("saved nodes do not include provided phase ID %s", clientPhaseID)
	}
	if graph.Edges[0].SourceID != clientStartID || graph.Edges[0].TargetID != clientPhaseID {
		t.Fatalf("edge endpoints = %s -> %s, want %s -> %s", graph.Edges[0].SourceID, graph.Edges[0].TargetID, clientStartID, clientPhaseID)
	}

	loaded, err := svc.GetFlow(ctx, creatorID, themeID)
	if err != nil {
		t.Fatalf("GetFlow: %v", err)
	}
	if len(loaded.Nodes) != 2 || len(loaded.Edges) != 1 {
		t.Fatalf("loaded graph sizes = nodes %d edges %d, want 2/1", len(loaded.Nodes), len(loaded.Edges))
	}

	updated, err := svc.UpdateNode(ctx, creatorID, themeID, clientPhaseID, UpdateNodeRequest{
		Data: json.RawMessage(`{"label":"수정된 조사"}`),
	})
	if err != nil {
		t.Fatalf("UpdateNode with preserved ID: %v", err)
	}
	if updated.ID != clientPhaseID {
		t.Fatalf("updated node ID = %s, want %s", updated.ID, clientPhaseID)
	}
}

func TestServiceSaveFlow_RejectsEdgeEndpointOutsideSubmittedGraph(t *testing.T) {
	ctx := context.Background()
	pool := setupFlowTestPool(t)
	svc := NewService(pool, zerolog.Nop())
	creatorID := insertFlowTestUser(t, pool)
	themeID := insertFlowTestTheme(t, pool, creatorID, json.RawMessage(`{}`))
	startID := uuid.New()
	unknownTargetID := uuid.New()

	_, err := svc.SaveFlow(ctx, creatorID, themeID, SaveFlowRequest{
		Nodes: []FlowNodeInput{{
			ID:        &startID,
			Type:      NodeTypeStart,
			PositionX: 0,
			PositionY: 0,
		}},
		Edges: []FlowEdgeInput{{
			SourceID: startID,
			TargetID: unknownTargetID,
		}},
	})
	if err == nil {
		t.Fatal("expected SaveFlow to reject an edge target outside the submitted graph")
	}
	appErr, ok := err.(*apperror.AppError)
	if !ok {
		t.Fatalf("expected app error, got %T", err)
	}
	if appErr.Code != apperror.ErrValidation {
		t.Fatalf("error code = %q, want %q", appErr.Code, apperror.ErrValidation)
	}
}

func TestServiceSaveFlow_RejectsNilEdgeEndpoint(t *testing.T) {
	ctx := context.Background()
	pool := setupFlowTestPool(t)
	svc := NewService(pool, zerolog.Nop())
	creatorID := insertFlowTestUser(t, pool)
	themeID := insertFlowTestTheme(t, pool, creatorID, json.RawMessage(`{}`))
	startID := uuid.New()

	_, err := svc.SaveFlow(ctx, creatorID, themeID, SaveFlowRequest{
		Nodes: []FlowNodeInput{{
			ID:        &startID,
			Type:      NodeTypeStart,
			PositionX: 0,
			PositionY: 0,
		}},
		Edges: []FlowEdgeInput{{
			SourceID: startID,
			TargetID: uuid.Nil,
		}},
	})
	if err == nil {
		t.Fatal("expected SaveFlow to reject a nil edge endpoint")
	}
	appErr, ok := err.(*apperror.AppError)
	if !ok {
		t.Fatalf("expected app error, got %T", err)
	}
	if appErr.Code != apperror.ErrValidation {
		t.Fatalf("error code = %q, want %q", appErr.Code, apperror.ErrValidation)
	}
}

func TestServiceUpdateNode_PartialDataPatchPreservesTypeAndPosition(t *testing.T) {
	ctx := context.Background()
	pool := setupFlowTestPool(t)
	svc := NewService(pool, zerolog.Nop())
	creatorID := insertFlowTestUser(t, pool)
	themeID := insertFlowTestTheme(t, pool, creatorID, json.RawMessage(`{}`))

	node, err := svc.CreateNode(ctx, creatorID, themeID, CreateNodeRequest{
		Type:      NodeTypeEnding,
		Data:      json.RawMessage(`{"label":"새 결말"}`),
		PositionX: 240,
		PositionY: 360,
	})
	if err != nil {
		t.Fatalf("CreateNode ending: %v", err)
	}

	updated, err := svc.UpdateNode(ctx, creatorID, themeID, node.ID, UpdateNodeRequest{
		Data: json.RawMessage(`{"label":"진실","endingContent":"범인이 밝혀졌다."}`),
	})
	if err != nil {
		t.Fatalf("UpdateNode partial data patch: %v", err)
	}

	if updated.Type != NodeTypeEnding {
		t.Fatalf("updated type = %q, want %q", updated.Type, NodeTypeEnding)
	}
	if updated.PositionX != 240 || updated.PositionY != 360 {
		t.Fatalf("updated position = (%v,%v), want (240,360)", updated.PositionX, updated.PositionY)
	}
	var data map[string]string
	if err := json.Unmarshal(updated.Data, &data); err != nil {
		t.Fatalf("unmarshal updated data: %v", err)
	}
	if data["label"] != "진실" || data["endingContent"] != "범인이 밝혀졌다." {
		t.Fatalf("updated data = %#v", data)
	}
}

func TestServiceUpdateNode_WaitsForThemeLock(t *testing.T) {
	ctx := context.Background()
	pool := setupFlowTestPool(t)
	svc := NewService(pool, zerolog.Nop())
	creatorID := insertFlowTestUser(t, pool)
	themeID := insertFlowTestTheme(t, pool, creatorID, json.RawMessage(`{}`))

	node, err := svc.CreateNode(ctx, creatorID, themeID, CreateNodeRequest{
		Type:      NodeTypeEnding,
		Data:      json.RawMessage(`{"label":"초기 결말"}`),
		PositionX: 240,
		PositionY: 360,
	})
	if err != nil {
		t.Fatalf("CreateNode ending: %v", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin lock tx: %v", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if err := lockThemeOwner(ctx, tx, creatorID, themeID); err != nil {
		t.Fatalf("lock theme: %v", err)
	}

	done := make(chan error, 1)
	go func() {
		_, updateErr := svc.UpdateNode(ctx, creatorID, themeID, node.ID, UpdateNodeRequest{
			Data: json.RawMessage(`{"label":"락 이후 결말"}`),
		})
		done <- updateErr
	}()

	select {
	case err := <-done:
		t.Fatalf("UpdateNode completed before the theme lock was released: %v", err)
	case <-time.After(100 * time.Millisecond):
	}

	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit lock tx: %v", err)
	}

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("UpdateNode after lock release: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("UpdateNode did not complete after the theme lock was released")
	}
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

func flowFloat64Ptr(value float64) *float64 {
	return &value
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
