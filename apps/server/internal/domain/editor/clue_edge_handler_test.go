package editor

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
)

func TestGetClueEdges_Empty(t *testing.T) {
	ms := &mockService{
		getClueEdgesFn: func(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueEdgeGroupResponse, error) {
			return []ClueEdgeGroupResponse{}, nil
		},
	}
	h := NewHandler(ms)

	r := httptest.NewRequest(http.MethodGet, "/editor/themes/"+testThemeID.String()+"/clue-edges", nil)
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.GetClueEdges(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var body []ClueEdgeGroupResponse
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body) != 0 {
		t.Fatalf("expected empty body, got %d items", len(body))
	}
}

func TestGetClueEdges_OK(t *testing.T) {
	gID := uuid.New()
	targetID := uuid.New()
	srcID := uuid.New()
	ms := &mockService{
		getClueEdgesFn: func(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueEdgeGroupResponse, error) {
			return []ClueEdgeGroupResponse{{
				ID:       gID,
				TargetID: targetID,
				Sources:  []uuid.UUID{srcID},
				Trigger:  "AUTO",
				Mode:     "AND",
			}}, nil
		},
	}
	h := NewHandler(ms)

	r := httptest.NewRequest(http.MethodGet, "/editor/themes/"+testThemeID.String()+"/clue-edges", nil)
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.GetClueEdges(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body []ClueEdgeGroupResponse
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body) != 1 || body[0].Trigger != "AUTO" || body[0].Mode != "AND" {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestReplaceClueEdges_OK(t *testing.T) {
	newID := uuid.New()
	ms := &mockService{
		replaceClueEdgesFn: func(ctx context.Context, creatorID, themeID uuid.UUID, reqs []ClueEdgeGroupRequest) ([]ClueEdgeGroupResponse, error) {
			if len(reqs) != 1 {
				t.Errorf("expected 1 req, got %d", len(reqs))
			}
			return []ClueEdgeGroupResponse{{
				ID:       newID,
				TargetID: reqs[0].TargetID,
				Sources:  reqs[0].Sources,
				Trigger:  reqs[0].Trigger,
				Mode:     reqs[0].Mode,
			}}, nil
		},
	}
	h := NewHandler(ms)

	body, _ := json.Marshal([]ClueEdgeGroupRequest{{
		TargetID: uuid.New(),
		Sources:  []uuid.UUID{uuid.New(), uuid.New()},
		Trigger:  "CRAFT",
		Mode:     "AND",
	}})
	r := httptest.NewRequest(http.MethodPut, "/editor/themes/"+testThemeID.String()+"/clue-edges", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.ReplaceClueEdges(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp []ClueEdgeGroupResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp) != 1 || resp[0].Trigger != "CRAFT" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestReplaceClueEdges_InvalidJSON(t *testing.T) {
	ms := &mockService{}
	h := NewHandler(ms)

	r := httptest.NewRequest(http.MethodPut, "/editor/themes/"+testThemeID.String()+"/clue-edges", bytes.NewReader([]byte("not json")))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.ReplaceClueEdges(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestReplaceClueEdges_CycleDetected(t *testing.T) {
	ms := &mockService{
		replaceClueEdgesFn: func(ctx context.Context, creatorID, themeID uuid.UUID, reqs []ClueEdgeGroupRequest) ([]ClueEdgeGroupResponse, error) {
			return nil, apperror.New("EDGE_CYCLE_DETECTED", 400, "clue edge graph contains a cycle")
		},
	}
	h := NewHandler(ms)

	body, _ := json.Marshal([]ClueEdgeGroupRequest{{
		TargetID: uuid.New(),
		Sources:  []uuid.UUID{uuid.New()},
		Trigger:  "AUTO",
		Mode:     "AND",
	}})
	r := httptest.NewRequest(http.MethodPut, "/editor/themes/"+testThemeID.String()+"/clue-edges", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.ReplaceClueEdges(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 (cycle), got %d", w.Code)
	}
	if !bytes.Contains(w.Body.Bytes(), []byte("EDGE_CYCLE_DETECTED")) {
		t.Fatalf("expected EDGE_CYCLE_DETECTED in body, got %s", w.Body.String())
	}
}

func TestReplaceClueEdges_InvalidCraftOR(t *testing.T) {
	ms := &mockService{
		replaceClueEdgesFn: func(ctx context.Context, creatorID, themeID uuid.UUID, reqs []ClueEdgeGroupRequest) ([]ClueEdgeGroupResponse, error) {
			return nil, apperror.New("EDGE_INVALID_CRAFT_OR", 400, "edge[0]: CRAFT trigger does not allow OR mode")
		},
	}
	h := NewHandler(ms)

	body, _ := json.Marshal([]ClueEdgeGroupRequest{{
		TargetID: uuid.New(),
		Sources:  []uuid.UUID{uuid.New()},
		Trigger:  "CRAFT",
		Mode:     "OR",
	}})
	r := httptest.NewRequest(http.MethodPut, "/editor/themes/"+testThemeID.String()+"/clue-edges", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.ReplaceClueEdges(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	if !bytes.Contains(w.Body.Bytes(), []byte("EDGE_INVALID_CRAFT_OR")) {
		t.Fatalf("expected EDGE_INVALID_CRAFT_OR in body, got %s", w.Body.String())
	}
}
