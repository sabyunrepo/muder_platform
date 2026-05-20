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

func TestInviteFriends_Success(t *testing.T) {
	roomID := uuid.New()
	userID := uuid.New()
	friendID := uuid.New()

	svc := &mockService{
		inviteFriendsFn: func(_ context.Context, gotRoomID, gotUserID uuid.UUID, req RoomInviteRequest) (*RoomInviteResponse, error) {
			if gotRoomID != roomID || gotUserID != userID {
				t.Fatalf("InviteFriends ids mismatch: room=%s user=%s", gotRoomID, gotUserID)
			}
			if len(req.FriendIDs) != 1 || req.FriendIDs[0] != friendID {
				t.Fatalf("FriendIDs = %+v, want [%s]", req.FriendIDs, friendID)
			}
			return &RoomInviteResponse{
				Sent: []RoomInviteSent{{FriendID: friendID, Nickname: "Ada", Online: true}},
			}, nil
		},
	}
	h := NewHandler(svc)

	body, _ := json.Marshal(RoomInviteRequest{FriendIDs: []uuid.UUID{friendID}})
	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/invites", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, userID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.InviteFriends(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"online":true`) {
		t.Fatalf("expected invite response body, got %s", rec.Body.String())
	}
}

func TestInviteFriends_NoAuth(t *testing.T) {
	h := NewHandler(&mockService{})
	roomID := uuid.New()
	body, _ := json.Marshal(RoomInviteRequest{FriendIDs: []uuid.UUID{uuid.New()}})

	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/invites", bytes.NewReader(body))
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.InviteFriends(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestInviteFriends_InvalidRoomID(t *testing.T) {
	h := NewHandler(&mockService{})
	userID := uuid.New()

	req := httptest.NewRequest(http.MethodPost, "/rooms/not-a-uuid/invites", strings.NewReader(`{"friend_ids":[]}`))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, userID)
	req = withChiParam(req, "id", "not-a-uuid")

	rec := httptest.NewRecorder()
	h.InviteFriends(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestInviteFriends_InvalidJSON(t *testing.T) {
	h := NewHandler(&mockService{})
	roomID := uuid.New()
	userID := uuid.New()

	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/invites", strings.NewReader(`not json`))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, userID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.InviteFriends(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}
