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

func TestStartRoom_Success(t *testing.T) {
	roomID := uuid.New()
	hostID := uuid.New()

	svc := &mockService{
		startRoomFn: func(_ context.Context, _, _ uuid.UUID, _ StartRoomRequest) error {
			return nil
		},
	}
	h := NewHandler(svc)

	body, _ := json.Marshal(StartRoomRequest{ConfigJson: []byte(`{"modules":[]}`)})
	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/start", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, hostID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.StartRoom(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestStartRoom_NoAuth(t *testing.T) {
	h := NewHandler(&mockService{})
	roomID := uuid.New()

	body, _ := json.Marshal(StartRoomRequest{})
	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/start", bytes.NewReader(body))
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.StartRoom(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestStartRoom_InvalidJSON(t *testing.T) {
	roomID := uuid.New()
	hostID := uuid.New()

	h := NewHandler(&mockService{})

	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/start",
		strings.NewReader(`not valid json`))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, hostID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.StartRoom(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestStartRoom_BodyTooLarge(t *testing.T) {
	roomID := uuid.New()
	hostID := uuid.New()

	h := NewHandler(&mockService{})

	// Build a body larger than 256 KiB.
	large := make([]byte, 257*1024)
	for i := range large {
		large[i] = 'x'
	}

	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/start",
		bytes.NewReader(large))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, hostID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.StartRoom(rec, req)

	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 400 or 413, got %d: %s", rec.Code, rec.Body.String())
	}
}
