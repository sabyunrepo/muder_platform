package room

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/middleware"
)

// mockService implements Service for testing.
type mockService struct {
	createRoomFn    func(ctx context.Context, hostID uuid.UUID, req CreateRoomRequest) (*RoomResponse, error)
	getRoomFn       func(ctx context.Context, roomID uuid.UUID) (*RoomDetailResponse, error)
	getRoomByCodeFn func(ctx context.Context, code string) (*RoomDetailResponse, error)
	listWaitingFn   func(ctx context.Context, limit, offset int32) ([]RoomResponse, error)
	joinRoomFn      func(ctx context.Context, roomID, userID uuid.UUID) error
	leaveRoomFn     func(ctx context.Context, roomID, userID uuid.UUID) error
	startRoomFn     func(ctx context.Context, roomID, hostID uuid.UUID, req StartRoomRequest) error
}

func (m *mockService) CreateRoom(ctx context.Context, hostID uuid.UUID, req CreateRoomRequest) (*RoomResponse, error) {
	return m.createRoomFn(ctx, hostID, req)
}

func (m *mockService) GetRoom(ctx context.Context, roomID uuid.UUID) (*RoomDetailResponse, error) {
	return m.getRoomFn(ctx, roomID)
}

func (m *mockService) GetRoomByCode(ctx context.Context, code string) (*RoomDetailResponse, error) {
	return m.getRoomByCodeFn(ctx, code)
}

func (m *mockService) ListWaitingRooms(ctx context.Context, limit, offset int32) ([]RoomResponse, error) {
	return m.listWaitingFn(ctx, limit, offset)
}

func (m *mockService) JoinRoom(ctx context.Context, roomID, userID uuid.UUID) error {
	return m.joinRoomFn(ctx, roomID, userID)
}

func (m *mockService) LeaveRoom(ctx context.Context, roomID, userID uuid.UUID) error {
	return m.leaveRoomFn(ctx, roomID, userID)
}

func (m *mockService) StartRoom(ctx context.Context, roomID, hostID uuid.UUID, req StartRoomRequest) error {
	if m.startRoomFn != nil {
		return m.startRoomFn(ctx, roomID, hostID, req)
	}
	return nil
}

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
	roomID := uuid.New()
	hostID := uuid.New()
	themeID := uuid.New()

	mock := &mockService{
		createRoomFn: func(_ context.Context, hID uuid.UUID, req CreateRoomRequest) (*RoomResponse, error) {
			if hID != hostID {
				t.Fatalf("expected hostID %s, got %s", hostID, hID)
			}
			effective := int32(0)
			if req.MaxPlayers != nil {
				effective = *req.MaxPlayers
			}
			return &RoomResponse{
				ID:          roomID,
				ThemeID:     themeID,
				HostID:      hostID,
				Code:        "ABC123",
				Status:      "WAITING",
				MaxPlayers:  effective,
				IsPrivate:   req.IsPrivate,
				PlayerCount: 1,
			}, nil
		},
	}

	h := NewHandler(mock)

	mp := int32(6)
	body, _ := json.Marshal(CreateRoomRequest{
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

	var resp RoomResponse
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

// TestCreateRoom_OmitMaxPlayers_FallbackApplied verifies that a body without
// max_players is accepted (201) and the service sees req.MaxPlayers == nil so
// it can apply the theme default fallback.
func TestCreateRoom_OmitMaxPlayers_FallbackApplied(t *testing.T) {
	roomID := uuid.New()
	hostID := uuid.New()
	themeID := uuid.New()

	const themeDefault int32 = 8

	mock := &mockService{
		createRoomFn: func(_ context.Context, _ uuid.UUID, req CreateRoomRequest) (*RoomResponse, error) {
			if req.MaxPlayers != nil {
				t.Fatalf("expected MaxPlayers nil, got %d", *req.MaxPlayers)
			}
			// Simulate service-side theme fallback.
			return &RoomResponse{
				ID:          roomID,
				ThemeID:     themeID,
				HostID:      hostID,
				Code:        "FAL123",
				Status:      "WAITING",
				MaxPlayers:  themeDefault,
				IsPrivate:   req.IsPrivate,
				PlayerCount: 1,
			}, nil
		},
	}

	h := NewHandler(mock)

	// Body intentionally omits max_players entirely.
	body := []byte(`{"theme_id":"` + themeID.String() + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/rooms", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withAuth(req, hostID)

	rec := httptest.NewRecorder()
	h.CreateRoom(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp RoomResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.MaxPlayers != themeDefault {
		t.Fatalf("expected theme-default max_players=%d, got %d", themeDefault, resp.MaxPlayers)
	}
}

// TestCreateRoom_MaxPlayersOutOfRange_Returns400 verifies that when the
// service returns a VALIDATION_ERROR AppError (e.g. max_players outside the
// theme's [min,max] range), the handler responds 400.
func TestCreateRoom_MaxPlayersOutOfRange_Returns400(t *testing.T) {
	hostID := uuid.New()
	themeID := uuid.New()

	mock := &mockService{
		createRoomFn: func(_ context.Context, _ uuid.UUID, _ CreateRoomRequest) (*RoomResponse, error) {
			return nil, apperror.New(
				apperror.ErrValidation,
				http.StatusBadRequest,
				"max_players 20 is outside theme range [4, 8]",
			)
		},
	}

	h := NewHandler(mock)

	// Body with max_players within the validator tag bounds (≤12) but that the
	// service will reject as exceeding the theme's per-theme cap.
	mp := int32(10)
	body, _ := json.Marshal(CreateRoomRequest{
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
	mock := &mockService{}
	h := NewHandler(mock)

	// Missing required theme_id.
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
	mock := &mockService{
		listWaitingFn: func(_ context.Context, limit, offset int32) ([]RoomResponse, error) {
			return []RoomResponse{
				{ID: uuid.New(), Code: "AAA111", Status: "WAITING", MaxPlayers: 6},
				{ID: uuid.New(), Code: "BBB222", Status: "WAITING", MaxPlayers: 4},
			}, nil
		},
	}

	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/rooms?limit=10&offset=0", nil)
	rec := httptest.NewRecorder()
	h.ListWaitingRooms(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var rooms []RoomResponse
	if err := json.NewDecoder(rec.Body).Decode(&rooms); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(rooms) != 2 {
		t.Fatalf("expected 2 rooms, got %d", len(rooms))
	}
}

func TestGetRoom_Success(t *testing.T) {
	roomID := uuid.New()

	mock := &mockService{
		getRoomFn: func(_ context.Context, rID uuid.UUID) (*RoomDetailResponse, error) {
			if rID != roomID {
				t.Fatalf("expected roomID %s, got %s", roomID, rID)
			}
			return &RoomDetailResponse{
				RoomResponse: RoomResponse{
					ID:          roomID,
					Code:        "XYZ789",
					Status:      "WAITING",
					MaxPlayers:  6,
					PlayerCount: 2,
				},
				Players: []PlayerInfo{
					{UserID: uuid.New(), IsReady: false},
					{UserID: uuid.New(), IsReady: true},
				},
			}, nil
		},
	}

	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/rooms/"+roomID.String(), nil)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.GetRoom(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp RoomDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp.Players) != 2 {
		t.Fatalf("expected 2 players, got %d", len(resp.Players))
	}
}

func TestGetRoom_NotFound(t *testing.T) {
	roomID := uuid.New()

	mock := &mockService{
		getRoomFn: func(_ context.Context, _ uuid.UUID) (*RoomDetailResponse, error) {
			return nil, apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		},
	}

	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/rooms/"+roomID.String(), nil)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.GetRoom(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestJoinRoom_Success(t *testing.T) {
	roomID := uuid.New()
	userID := uuid.New()

	mock := &mockService{
		joinRoomFn: func(_ context.Context, rID, uID uuid.UUID) error {
			if rID != roomID || uID != userID {
				t.Fatalf("unexpected IDs: room=%s user=%s", rID, uID)
			}
			return nil
		},
	}

	h := NewHandler(mock)

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
	roomID := uuid.New()
	userID := uuid.New()

	mock := &mockService{
		joinRoomFn: func(_ context.Context, _, _ uuid.UUID) error {
			return apperror.New(apperror.ErrRoomFull, http.StatusConflict, "room is full")
		},
	}

	h := NewHandler(mock)

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
	roomID := uuid.New()
	userID := uuid.New()

	mock := &mockService{
		leaveRoomFn: func(_ context.Context, rID, uID uuid.UUID) error {
			if rID != roomID || uID != userID {
				t.Fatalf("unexpected IDs: room=%s user=%s", rID, uID)
			}
			return nil
		},
	}

	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID.String()+"/leave", nil)
	req = withAuth(req, userID)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.LeaveRoom(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
