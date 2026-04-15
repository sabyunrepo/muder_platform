package flow

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/middleware"
)

// --- mock service ---

type mockService struct {
	getFlowFn       func(ctx context.Context, themeID uuid.UUID) (*FlowGraph, error)
	saveFlowFn      func(ctx context.Context, creatorID, themeID uuid.UUID, req SaveFlowRequest) (*FlowGraph, error)
	createNodeFn    func(ctx context.Context, creatorID, themeID uuid.UUID, req CreateNodeRequest) (*FlowNode, error)
	updateNodeFn    func(ctx context.Context, creatorID, nodeID uuid.UUID, req UpdateNodeRequest) (*FlowNode, error)
	deleteNodeFn    func(ctx context.Context, creatorID, nodeID uuid.UUID) error
	createEdgeFn    func(ctx context.Context, creatorID, themeID uuid.UUID, req CreateEdgeRequest) (*FlowEdge, error)
	updateEdgeFn    func(ctx context.Context, creatorID, edgeID uuid.UUID, req UpdateEdgeRequest) (*FlowEdge, error)
	deleteEdgeFn    func(ctx context.Context, creatorID, edgeID uuid.UUID) error
	migratePhasesFn func(ctx context.Context, themeID uuid.UUID, phases []map[string]any) error
}

func (m *mockService) GetFlow(ctx context.Context, themeID uuid.UUID) (*FlowGraph, error) {
	return m.getFlowFn(ctx, themeID)
}
func (m *mockService) SaveFlow(ctx context.Context, creatorID, themeID uuid.UUID, req SaveFlowRequest) (*FlowGraph, error) {
	return m.saveFlowFn(ctx, creatorID, themeID, req)
}
func (m *mockService) CreateNode(ctx context.Context, creatorID, themeID uuid.UUID, req CreateNodeRequest) (*FlowNode, error) {
	return m.createNodeFn(ctx, creatorID, themeID, req)
}
func (m *mockService) UpdateNode(ctx context.Context, creatorID, nodeID uuid.UUID, req UpdateNodeRequest) (*FlowNode, error) {
	return m.updateNodeFn(ctx, creatorID, nodeID, req)
}
func (m *mockService) DeleteNode(ctx context.Context, creatorID, nodeID uuid.UUID) error {
	return m.deleteNodeFn(ctx, creatorID, nodeID)
}
func (m *mockService) CreateEdge(ctx context.Context, creatorID, themeID uuid.UUID, req CreateEdgeRequest) (*FlowEdge, error) {
	return m.createEdgeFn(ctx, creatorID, themeID, req)
}
func (m *mockService) UpdateEdge(ctx context.Context, creatorID, edgeID uuid.UUID, req UpdateEdgeRequest) (*FlowEdge, error) {
	return m.updateEdgeFn(ctx, creatorID, edgeID, req)
}
func (m *mockService) DeleteEdge(ctx context.Context, creatorID, edgeID uuid.UUID) error {
	return m.deleteEdgeFn(ctx, creatorID, edgeID)
}
func (m *mockService) MigratePhases(ctx context.Context, themeID uuid.UUID, phases []map[string]any) error {
	if m.migratePhasesFn != nil {
		return m.migratePhasesFn(ctx, themeID, phases)
	}
	return nil
}

// --- helpers ---

var testCreatorID = uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

func withAuth(r *http.Request) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, testCreatorID)
	return r.WithContext(ctx)
}

func newRouter(h *Handler) *chi.Mux {
	r := chi.NewRouter()
	r.Get("/themes/{id}/flow", h.GetFlow)
	r.Put("/themes/{id}/flow", h.SaveFlow)
	r.Post("/themes/{id}/flow/nodes", h.CreateNode)
	r.Patch("/themes/{id}/flow/nodes/{nodeId}", h.UpdateNode)
	r.Delete("/themes/{id}/flow/nodes/{nodeId}", h.DeleteNode)
	r.Post("/themes/{id}/flow/edges", h.CreateEdge)
	r.Patch("/themes/{id}/flow/edges/{edgeId}", h.UpdateEdge)
	r.Delete("/themes/{id}/flow/edges/{edgeId}", h.DeleteEdge)
	return r
}

// --- tests ---

func TestGetFlow_OK(t *testing.T) {
	themeID := uuid.New()
	svc := &mockService{
		getFlowFn: func(_ context.Context, id uuid.UUID) (*FlowGraph, error) {
			return &FlowGraph{
				Nodes: []FlowNode{{ID: uuid.New(), ThemeID: id, Type: NodeTypeStart, CreatedAt: time.Now(), UpdatedAt: time.Now()}},
				Edges: []FlowEdge{},
			}, nil
		},
	}
	r := newRouter(NewHandler(svc))
	req := withAuth(httptest.NewRequest(http.MethodGet, "/themes/"+themeID.String()+"/flow", nil))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var graph FlowGraph
	if err := json.NewDecoder(w.Body).Decode(&graph); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(graph.Nodes) != 1 {
		t.Fatalf("expected 1 node, got %d", len(graph.Nodes))
	}
}

func TestCreateNode_OK(t *testing.T) {
	themeID := uuid.New()
	svc := &mockService{
		createNodeFn: func(_ context.Context, _, _ uuid.UUID, req CreateNodeRequest) (*FlowNode, error) {
			return &FlowNode{ID: uuid.New(), Type: req.Type, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
		},
	}
	r := newRouter(NewHandler(svc))
	body, _ := json.Marshal(CreateNodeRequest{Type: NodeTypePhase, PositionX: 10, PositionY: 20})
	req := withAuth(httptest.NewRequest(http.MethodPost, "/themes/"+themeID.String()+"/flow/nodes", bytes.NewReader(body)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteNode_OK(t *testing.T) {
	themeID := uuid.New()
	nodeID := uuid.New()
	svc := &mockService{
		deleteNodeFn: func(_ context.Context, _, _ uuid.UUID) error { return nil },
	}
	r := newRouter(NewHandler(svc))
	req := withAuth(httptest.NewRequest(http.MethodDelete, "/themes/"+themeID.String()+"/flow/nodes/"+nodeID.String(), nil))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetFlow_InvalidUUID(t *testing.T) {
	svc := &mockService{}
	r := newRouter(NewHandler(svc))
	req := withAuth(httptest.NewRequest(http.MethodGet, "/themes/not-a-uuid/flow", nil))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}
