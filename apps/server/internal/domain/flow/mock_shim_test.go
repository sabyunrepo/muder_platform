package flow

// mock_shim_test.go provides a hand-rolled mockService shim used by
// handler_extra_test.go and migration_test.go, which require white-box access
// to unexported types and helpers. These files cannot use gomock because they
// embed serviceImpl or rely on package-internal symbols.
//
// TODO(phase-19-residual PR-5a): white-box 테스트가 black-box 로 전환되거나
// Service interface 가 sub-package 로 분리되어 import cycle 이 해소되면
// 이 파일을 제거하고 mocks/mock_service.go 만 사용. PR-5d PoC 에서 재평가.

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/middleware"
)

// mockService is a hand-rolled stub for the flow.Service interface.
type mockService struct {
	getFlowFn       func(ctx context.Context, themeID uuid.UUID) (*FlowGraph, error)
	saveFlowFn      func(ctx context.Context, creatorID, themeID uuid.UUID, req SaveFlowRequest) (*FlowGraph, error)
	createNodeFn    func(ctx context.Context, creatorID, themeID uuid.UUID, req CreateNodeRequest) (*FlowNode, error)
	updateNodeFn    func(ctx context.Context, creatorID, nodeID uuid.UUID, req UpdateNodeRequest) (*FlowNode, error)
	deleteNodeFn    func(ctx context.Context, creatorID, themeID, nodeID uuid.UUID) error
	createEdgeFn    func(ctx context.Context, creatorID, themeID uuid.UUID, req CreateEdgeRequest) (*FlowEdge, error)
	updateEdgeFn    func(ctx context.Context, creatorID, edgeID uuid.UUID, req UpdateEdgeRequest) (*FlowEdge, error)
	deleteEdgeFn    func(ctx context.Context, creatorID, edgeID uuid.UUID) error
	migratePhasesFn func(ctx context.Context, themeID uuid.UUID, phases []map[string]any) error
}

func (m *mockService) GetFlow(ctx context.Context, themeID uuid.UUID) (*FlowGraph, error) {
	if m.getFlowFn != nil {
		return m.getFlowFn(ctx, themeID)
	}
	return nil, nil
}
func (m *mockService) SaveFlow(ctx context.Context, creatorID, themeID uuid.UUID, req SaveFlowRequest) (*FlowGraph, error) {
	if m.saveFlowFn != nil {
		return m.saveFlowFn(ctx, creatorID, themeID, req)
	}
	return nil, nil
}
func (m *mockService) CreateNode(ctx context.Context, creatorID, themeID uuid.UUID, req CreateNodeRequest) (*FlowNode, error) {
	if m.createNodeFn != nil {
		return m.createNodeFn(ctx, creatorID, themeID, req)
	}
	return nil, nil
}
func (m *mockService) UpdateNode(ctx context.Context, creatorID, nodeID uuid.UUID, req UpdateNodeRequest) (*FlowNode, error) {
	if m.updateNodeFn != nil {
		return m.updateNodeFn(ctx, creatorID, nodeID, req)
	}
	return nil, nil
}
func (m *mockService) DeleteNode(ctx context.Context, creatorID, themeID, nodeID uuid.UUID) error {
	if m.deleteNodeFn != nil {
		return m.deleteNodeFn(ctx, creatorID, themeID, nodeID)
	}
	return nil
}
func (m *mockService) CreateEdge(ctx context.Context, creatorID, themeID uuid.UUID, req CreateEdgeRequest) (*FlowEdge, error) {
	if m.createEdgeFn != nil {
		return m.createEdgeFn(ctx, creatorID, themeID, req)
	}
	return nil, nil
}
func (m *mockService) UpdateEdge(ctx context.Context, creatorID, edgeID uuid.UUID, req UpdateEdgeRequest) (*FlowEdge, error) {
	if m.updateEdgeFn != nil {
		return m.updateEdgeFn(ctx, creatorID, edgeID, req)
	}
	return nil, nil
}
func (m *mockService) DeleteEdge(ctx context.Context, creatorID, edgeID uuid.UUID) error {
	if m.deleteEdgeFn != nil {
		return m.deleteEdgeFn(ctx, creatorID, edgeID)
	}
	return nil
}
func (m *mockService) MigratePhases(ctx context.Context, themeID uuid.UUID, phases []map[string]any) error {
	if m.migratePhasesFn != nil {
		return m.migratePhasesFn(ctx, themeID, phases)
	}
	return nil
}

var testCreatorIDInternal = uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

func withAuth(r *http.Request) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, testCreatorIDInternal)
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
