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

func TestSelectCharacter_Success(t *testing.T) {
	roomID := uuid.New()
	userID := uuid.New()
	characterID := uuid.New()

	svc := &mockService{
		selectCharFn: func(_ context.Context, gotRoomID, gotUserID uuid.UUID, req SelectCharacterRequest) error {
			if gotRoomID != roomID || gotUserID != userID || req.CharacterID != characterID {
				t.Fatalf("SelectCharacter args mismatch: room=%s user=%s req=%+v", gotRoomID, gotUserID, req)
			}
			return nil
		},
	}
	h := NewHandler(svc)

	body, _ := json.Marshal(SelectCharacterRequest{CharacterID: characterID})
	req := httptest.NewRequest(http.MethodPut, "/rooms/"+roomID.String()+"/character", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, userID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.SelectCharacter(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "character selected") {
		t.Fatalf("expected success body, got %s", rec.Body.String())
	}
}

func TestSelectCharacter_NoAuth(t *testing.T) {
	h := NewHandler(&mockService{})
	roomID := uuid.New()
	characterID := uuid.New()
	body, _ := json.Marshal(SelectCharacterRequest{CharacterID: characterID})

	req := httptest.NewRequest(http.MethodPut, "/rooms/"+roomID.String()+"/character", bytes.NewReader(body))
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.SelectCharacter(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSelectCharacter_InvalidJSON(t *testing.T) {
	h := NewHandler(&mockService{})
	roomID := uuid.New()
	userID := uuid.New()

	req := httptest.NewRequest(http.MethodPut, "/rooms/"+roomID.String()+"/character", strings.NewReader(`not valid json`))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, userID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.SelectCharacter(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSelectCharacter_InvalidRoomID(t *testing.T) {
	h := NewHandler(&mockService{})
	userID := uuid.New()
	characterID := uuid.New()
	body, _ := json.Marshal(SelectCharacterRequest{CharacterID: characterID})

	req := httptest.NewRequest(http.MethodPut, "/rooms/not-a-uuid/character", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, userID)
	req = withChiParam(req, "id", "not-a-uuid")

	rec := httptest.NewRecorder()
	h.SelectCharacter(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}
