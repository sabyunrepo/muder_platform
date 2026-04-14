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

var (
	testClueAID = uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd")
	testClueBID = uuid.MustParse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
	testRelID   = uuid.MustParse("ffffffff-ffff-ffff-ffff-ffffffffffff")
)

func TestGetClueRelations_OK(t *testing.T) {
	ms := &mockService{
		getClueRelationsFn: func(_ context.Context, _, _ uuid.UUID) ([]ClueRelationResponse, error) {
			return []ClueRelationResponse{
				{ID: testRelID, SourceID: testClueAID, TargetID: testClueBID, Mode: "AND"},
			}, nil
		},
	}
	h := NewHandler(ms)

	r := httptest.NewRequest(http.MethodGet, "/editor/themes/"+testThemeID.String()+"/clue-relations", nil)
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.GetClueRelations(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var got []ClueRelationResponse
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 relation, got %d", len(got))
	}
	if got[0].Mode != "AND" {
		t.Errorf("expected mode AND, got %s", got[0].Mode)
	}
}

func TestReplaceClueRelations_OK(t *testing.T) {
	ms := &mockService{
		replaceClueRelationsFn: func(_ context.Context, _, _ uuid.UUID, reqs []ClueRelationRequest) ([]ClueRelationResponse, error) {
			out := make([]ClueRelationResponse, len(reqs))
			for i, rq := range reqs {
				out[i] = ClueRelationResponse{ID: testRelID, SourceID: rq.SourceID, TargetID: rq.TargetID, Mode: rq.Mode}
			}
			return out, nil
		},
	}
	h := NewHandler(ms)

	body, _ := json.Marshal([]ClueRelationRequest{
		{SourceID: testClueAID, TargetID: testClueBID, Mode: "AND"},
	})
	r := httptest.NewRequest(http.MethodPut, "/editor/themes/"+testThemeID.String()+"/clue-relations", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.ReplaceClueRelations(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var got []ClueRelationResponse
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 relation, got %d", len(got))
	}
}

func TestReplaceClueRelations_Empty(t *testing.T) {
	ms := &mockService{
		replaceClueRelationsFn: func(_ context.Context, _, _ uuid.UUID, _ []ClueRelationRequest) ([]ClueRelationResponse, error) {
			return []ClueRelationResponse{}, nil
		},
	}
	h := NewHandler(ms)

	body, _ := json.Marshal([]ClueRelationRequest{})
	r := httptest.NewRequest(http.MethodPut, "/editor/themes/"+testThemeID.String()+"/clue-relations", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.ReplaceClueRelations(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for empty relations, got %d: %s", w.Code, w.Body.String())
	}
	var got []ClueRelationResponse
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected empty relations, got %d", len(got))
	}
}

func TestReplaceClueRelations_CycleDetected(t *testing.T) {
	ms := &mockService{
		replaceClueRelationsFn: func(_ context.Context, _, _ uuid.UUID, _ []ClueRelationRequest) ([]ClueRelationResponse, error) {
			return nil, apperror.New("CYCLE_DETECTED", http.StatusBadRequest, "clue relation graph contains a cycle")
		},
	}
	h := NewHandler(ms)

	body, _ := json.Marshal([]ClueRelationRequest{
		{SourceID: testClueAID, TargetID: testClueBID, Mode: "AND"},
		{SourceID: testClueBID, TargetID: testClueAID, Mode: "AND"},
	})
	r := httptest.NewRequest(http.MethodPut, "/editor/themes/"+testThemeID.String()+"/clue-relations", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r = withAuth(r)
	r = chiContext(r, map[string]string{"id": testThemeID.String()})
	w := httptest.NewRecorder()

	h.ReplaceClueRelations(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for cycle, got %d: %s", w.Code, w.Body.String())
	}
}
