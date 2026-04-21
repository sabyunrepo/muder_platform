package room_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"go.uber.org/mock/gomock"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/domain/room"
	"github.com/mmp-platform/server/internal/domain/room/mocks"
	"github.com/mmp-platform/server/internal/middleware"
)

// withAuth injects a user ID into the request context.
func withAuth(r *http.Request, userID uuid.UUID) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID)
	return r.WithContext(ctx)
}

// withChiParam injects a chi URL parameter into the request context.
func withChiParam(r *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func TestCreateRoom_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	roomID := uuid.New()
	hostID := uuid.New()
	themeID := uuid.New()

	mock.EXPECT().
		CreateRoom(gomock.Any(), gomock.Eq(hostID), gomock.Any()).
		DoAndReturn(func(_ context.Context, hID uuid.UUID, req room.CreateRoomRequest) (*room.RoomResponse, error) {
			effective := int32(0)
			if req.MaxPlayers != nil {
				effective = *req.MaxPlayers
			}
			return &room.RoomResponse{
				ID:          roomID,
				ThemeID:     themeID,
				HostID:      hostID,
				Code:        "ABC123",
				Status:      "WAITING",
				MaxPlayers:  effective,
				IsPrivate:   req.IsPrivate,
				PlayerCount: 1,
			}, nil
		}).Times(1)

	h := room.NewHandler(mock)

	mp := int32(6)
	body, _ := json.Marshal(room.CreateRoomRequest{
		ThemeID:    themeID,
		MaxPlayers: &mp,
		IsPrivate:  false,
	})

	req := httptest.NewRequest(http.MethodPost, "/rooms", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, hostID)

	rec := httptest.NewRecorder()
	h.CreateRoom(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp room.RoomResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.ID != roomID {
		t.Fatalf("expected room ID %s, got %s", roomID, resp.ID)
	}
	if resp.PlayerCount != 1 {
		t.Fatalf("expected player count 1, got %d", resp.PlayerCount)
	}
}

func TestCreateRoom_OmitMaxPlayers_FallbackApplied(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	roomID := uuid.New()
	hostID := uuid.New()
	themeID := uuid.New()
	const themeDefault int32 = 8

	mock.EXPECT().
		CreateRoom(gomock.Any(), gomock.Any(), gomock.Any()).
		DoAndReturn(func(_ context.Context, _ uuid.UUID, req room.CreateRoomRequest) (*room.RoomResponse, error) {
			if req.MaxPlayers != nil {
				t.Fatalf("expected MaxPlayers nil, got %d", *req.MaxPlayers)
			}
			return &room.RoomResponse{
				ID:          roomID,
				ThemeID:     themeID,
				HostID:      hostID,
				Code:        "FAL123",
				Status:      "WAITING",
				MaxPlayers:  themeDefault,
				IsPrivate:   req.IsPrivate,
				PlayerCount: 1,
			}, nil
		}).Times(1)

	h := room.NewHandler(mock)

	body := []byte(`{"theme_id":"` + themeID.String() + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/rooms", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, hostID)

	rec := httptest.NewRecorder()
	h.CreateRoom(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp room.RoomResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.MaxPlayers != themeDefault {
		t.Fatalf("expected theme-default max_players=%d, got %d", themeDefault, resp.MaxPlayers)
	}
}

func TestCreateRoom_MaxPlayersOutOfRange_Returns400(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	hostID := uuid.New()
	themeID := uuid.New()

	mock.EXPECT().
		CreateRoom(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(nil, apperror.New(
			apperror.ErrValidation,
			http.StatusBadRequest,
			"max_players 20 is outside theme range [4, 8]",
		)).Times(1)

	h := room.NewHandler(mock)

	mp := int32(10)
	body, _ := json.Marshal(room.CreateRoomRequest{
		ThemeID:    themeID,
		MaxPlayers: &mp,
	})

	req := httptest.NewRequest(http.MethodPost, "/rooms", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, hostID)

	rec := httptest.NewRecorder()
	h.CreateRoom(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte("VALIDATION_ERROR")) {
		t.Fatalf("expected VALIDATION_ERROR in body, got: %s", rec.Body.String())
	}
}

func TestCreateRoom_InvalidBody(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	h := room.NewHandler(mock)

	body := []byte(`{"is_private": true}`)
	req := httptest.NewRequest(http.MethodPost, "/rooms", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, uuid.New())

	rec := httptest.NewRecorder()
	h.CreateRoom(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestListWaitingRooms_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	mock.EXPECT().
		ListWaitingRooms(gomock.Any(), gomock.Any(), gomock.Any()).
		Return([]room.RoomResponse{
			{ID: uuid.New(), Code: "AAA111", Status: "WAITING", MaxPlayers: 6},
			{ID: uuid.New(), Code: "BBB222", Status: "WAITING", MaxPlayers: 4},
		}, nil).Times(1)

	h := room.NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/rooms?limit=10&offset=0", nil)
	rec := httptest.NewRecorder()
	h.ListWaitingRooms(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var rooms []room.RoomResponse
	if err := json.NewDecoder(rec.Body).Decode(&rooms); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(rooms) != 2 {
		t.Fatalf("expected 2 rooms, got %d", len(rooms))
	}
}

func TestGetRoom_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	roomID := uuid.New()

	mock.EXPECT().
		GetRoom(gomock.Any(), gomock.Eq(roomID)).
		Return(&room.RoomDetailResponse{
			RoomResponse: room.RoomResponse{
				ID:          roomID,
				Code:        "XYZ789",
				Status:      "WAITING",
				MaxPlayers:  6,
				PlayerCount: 2,
			},
			Players: []room.PlayerInfo{
				{UserID: uuid.New(), IsReady: false},
				{UserID: uuid.New(), IsReady: true},
			},
		}, nil).Times(1)

	h := room.NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/rooms/"+roomID.String(), nil)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.GetRoom(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp room.RoomDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp.Players) != 2 {
		t.Fatalf("expected 2 players, got %d", len(resp.Players))
	}
}

func TestGetRoom_NotFound(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	roomID := uuid.New()

	mock.EXPECT().
		GetRoom(gomock.Any(), gomock.Any()).
		Return(nil, apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")).Times(1)

	h := room.NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/rooms/"+roomID.String(), nil)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.GetRoom(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestJoinRoom_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	roomID := uuid.New()
	userID := uuid.New()

	mock.EXPECT().
		JoinRoom(gomock.Any(), gomock.Eq(roomID), gomock.Eq(userID)).
		Return(nil).Times(1)

	h := room.NewHandler(mock)

	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/join", nil)
	req = withAuth(req, userID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.JoinRoom(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestJoinRoom_Full(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	roomID := uuid.New()
	userID := uuid.New()

	mock.EXPECT().
		JoinRoom(gomock.Any(), gomock.Any(), gomock.Any()).
		Return(apperror.New(apperror.ErrRoomFull, http.StatusConflict, "room is full")).Times(1)

	h := room.NewHandler(mock)

	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/join", nil)
	req = withAuth(req, userID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.JoinRoom(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestLeaveRoom_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	roomID := uuid.New()
	userID := uuid.New()

	mock.EXPECT().
		LeaveRoom(gomock.Any(), gomock.Eq(roomID), gomock.Eq(userID)).
		Return(nil).Times(1)

	h := room.NewHandler(mock)

	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/leave", nil)
	req = withAuth(req, userID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.LeaveRoom(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
