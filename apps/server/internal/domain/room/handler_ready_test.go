package room

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestSetReady_Success(t *testing.T) {
	roomID := uuid.New()
	userID := uuid.New()

	var gotReady bool
	svc := &mockService{
		setReadyFn: func(_ context.Context, gotRoomID, gotUserID uuid.UUID, ready bool) error {
			if gotRoomID != roomID {
				t.Fatalf("roomID = %s, want %s", gotRoomID, roomID)
			}
			if gotUserID != userID {
				t.Fatalf("userID = %s, want %s", gotUserID, userID)
			}
			gotReady = ready
			return nil
		},
	}
	h := NewHandler(svc)

	body, _ := json.Marshal(SetReadyRequest{IsReady: true})
	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/ready", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, userID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.SetReady(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !gotReady {
		t.Fatal("expected is_ready=true to be passed to service")
	}
}

func TestSetReady_NoAuth(t *testing.T) {
	h := NewHandler(&mockService{})
	roomID := uuid.New()

	body, _ := json.Marshal(SetReadyRequest{IsReady: true})
	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/ready", bytes.NewReader(body))
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.SetReady(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSetReady_InvalidJSON(t *testing.T) {
	h := NewHandler(&mockService{})
	roomID := uuid.New()
	userID := uuid.New()

	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/ready", strings.NewReader(`not json`))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, userID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.SetReady(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSetReady_InvalidRoomID(t *testing.T) {
	h := NewHandler(&mockService{})
	userID := uuid.New()

	req := httptest.NewRequest(http.MethodPost, "/rooms/not-a-uuid/ready", strings.NewReader(`{"is_ready":true}`))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, userID)
	req = withChiParam(req, "id", "not-a-uuid")

	rec := httptest.NewRecorder()
	h.SetReady(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}
