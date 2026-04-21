package flow_test

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
	"go.uber.org/mock/gomock"

	"github.com/mmp-platform/server/internal/domain/flow"
	"github.com/mmp-platform/server/internal/domain/flow/mocks"
	"github.com/mmp-platform/server/internal/middleware"
)

var extCreatorID = uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

func withExtAuth(r *http.Request) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, extCreatorID)
	return r.WithContext(ctx)
}

func newExtRouter(h *flow.Handler) *chi.Mux {
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

func TestGetFlow_OK(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	themeID := uuid.New()
	mock.EXPECT().
		GetFlow(gomock.Any(), gomock.Eq(themeID)).
		Return(&flow.FlowGraph{
			Nodes: []flow.FlowNode{{ID: uuid.New(), ThemeID: themeID, Type: flow.NodeTypeStart, CreatedAt: time.Now(), UpdatedAt: time.Now()}},
			Edges: []flow.FlowEdge{},
		}, nil).Times(1)

	r := newExtRouter(flow.NewHandler(mock))
	req := withExtAuth(httptest.NewRequest(http.MethodGet, "/themes/"+themeID.String()+"/flow", nil))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var graph flow.FlowGraph
	if err := json.NewDecoder(w.Body).Decode(&graph); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(graph.Nodes) != 1 {
		t.Fatalf("expected 1 node, got %d", len(graph.Nodes))
	}
}

func TestCreateNode_OK(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	themeID := uuid.New()
	mock.EXPECT().
		CreateNode(gomock.Any(), gomock.Any(), gomock.Eq(themeID), gomock.Any()).
		DoAndReturn(func(_ context.Context, _, _ uuid.UUID, req flow.CreateNodeRequest) (*flow.FlowNode, error) {
			return &flow.FlowNode{ID: uuid.New(), Type: req.Type, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
		}).Times(1)

	r := newExtRouter(flow.NewHandler(mock))
	body, _ := json.Marshal(flow.CreateNodeRequest{Type: flow.NodeTypePhase, PositionX: 10, PositionY: 20})
	req := withExtAuth(httptest.NewRequest(http.MethodPost, "/themes/"+themeID.String()+"/flow/nodes", bytes.NewReader(body)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteNode_OK(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	themeID := uuid.New()
	nodeID := uuid.New()
	mock.EXPECT().
		DeleteNode(gomock.Any(), gomock.Any(), gomock.Eq(nodeID)).
		Return(nil).Times(1)

	r := newExtRouter(flow.NewHandler(mock))
	req := withExtAuth(httptest.NewRequest(http.MethodDelete, "/themes/"+themeID.String()+"/flow/nodes/"+nodeID.String(), nil))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetFlow_InvalidUUID(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	r := newExtRouter(flow.NewHandler(mock))
	req := withExtAuth(httptest.NewRequest(http.MethodGet, "/themes/not-a-uuid/flow", nil))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}
