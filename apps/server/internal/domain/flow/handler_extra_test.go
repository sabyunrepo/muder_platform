package flow

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestSaveFlow_Success(t *testing.T) {
	themeID := uuid.New()
	svc := &mockService{
		saveFlowFn: func(_ context.Context, _, _ uuid.UUID, req SaveFlowRequest) (*FlowGraph, error) {
			return &FlowGraph{Nodes: []FlowNode{}, Edges: []FlowEdge{}}, nil
		},
	}
	r := newRouter(NewHandler(svc))
	body, _ := json.Marshal(SaveFlowRequest{Nodes: []FlowNodeInput{}, Edges: []FlowEdgeInput{}})
	req := withAuth(httptest.NewRequest(http.MethodPut, "/themes/"+themeID.String()+"/flow", bytes.NewReader(body)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSaveFlow_InvalidJSON(t *testing.T) {
	themeID := uuid.New()
	svc := &mockService{}
	r := newRouter(NewHandler(svc))
	req := withAuth(httptest.NewRequest(http.MethodPut, "/themes/"+themeID.String()+"/flow", bytes.NewReader([]byte("not-json"))))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestUpdateNode_Success(t *testing.T) {
	themeID := uuid.New()
	nodeID := uuid.New()
	svc := &mockService{
		updateNodeFn: func(_ context.Context, _, routeThemeID, id uuid.UUID, req UpdateNodeRequest) (*FlowNode, error) {
			return &FlowNode{ID: id, ThemeID: routeThemeID, Type: req.Type, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
		},
	}
	r := newRouter(NewHandler(svc))
	body, _ := json.Marshal(UpdateNodeRequest{Type: NodeTypePhase, PositionX: 100, PositionY: 200})
	req := withAuth(httptest.NewRequest(http.MethodPatch, "/themes/"+themeID.String()+"/flow/nodes/"+nodeID.String(), bytes.NewReader(body)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateEdge_Success(t *testing.T) {
	themeID := uuid.New()
	srcID := uuid.New()
	tgtID := uuid.New()
	svc := &mockService{
		createEdgeFn: func(_ context.Context, _, _ uuid.UUID, req CreateEdgeRequest) (*FlowEdge, error) {
			return &FlowEdge{ID: uuid.New(), SourceID: req.SourceID, TargetID: req.TargetID}, nil
		},
	}
	r := newRouter(NewHandler(svc))
	body, _ := json.Marshal(CreateEdgeRequest{SourceID: srcID, TargetID: tgtID})
	req := withAuth(httptest.NewRequest(http.MethodPost, "/themes/"+themeID.String()+"/flow/edges", bytes.NewReader(body)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}
