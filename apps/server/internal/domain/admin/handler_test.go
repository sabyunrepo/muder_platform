package admin

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

	"github.com/mmp-platform/server/internal/apperror"
)

// mockService implements Service for testing.
type mockService struct {
	listUsersFn          func(ctx context.Context, limit, offset int32) ([]UserSummary, error)
	getUserFn            func(ctx context.Context, userID uuid.UUID) (*UserSummary, error)
	updateUserRoleFn     func(ctx context.Context, userID uuid.UUID, role string) (*UserSummary, error)
	listAllThemesFn      func(ctx context.Context, limit, offset int32) ([]ThemeSummary, error)
	forceUnpublishFn     func(ctx context.Context, themeID uuid.UUID) (*ThemeSummary, error)
	listAllRoomsFn       func(ctx context.Context, limit, offset int32) ([]RoomSummary, error)
	forceCloseRoomFn     func(ctx context.Context, roomID uuid.UUID) error
}

func (m *mockService) ListUsers(ctx context.Context, limit, offset int32) ([]UserSummary, error) {
	return m.listUsersFn(ctx, limit, offset)
}

func (m *mockService) GetUser(ctx context.Context, userID uuid.UUID) (*UserSummary, error) {
	return m.getUserFn(ctx, userID)
}

func (m *mockService) UpdateUserRole(ctx context.Context, userID uuid.UUID, role string) (*UserSummary, error) {
	return m.updateUserRoleFn(ctx, userID, role)
}

func (m *mockService) ListAllThemes(ctx context.Context, limit, offset int32) ([]ThemeSummary, error) {
	return m.listAllThemesFn(ctx, limit, offset)
}

func (m *mockService) ForceUnpublishTheme(ctx context.Context, themeID uuid.UUID) (*ThemeSummary, error) {
	return m.forceUnpublishFn(ctx, themeID)
}

func (m *mockService) ListAllRooms(ctx context.Context, limit, offset int32) ([]RoomSummary, error) {
	return m.listAllRoomsFn(ctx, limit, offset)
}

func (m *mockService) ForceCloseRoom(ctx context.Context, roomID uuid.UUID) error {
	return m.forceCloseRoomFn(ctx, roomID)
}

// withChiParam injects a chi URL parameter into the request context.
func withChiParam(r *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func TestListUsers_Success(t *testing.T) {
	mock := &mockService{
		listUsersFn: func(_ context.Context, limit, offset int32) ([]UserSummary, error) {
			return []UserSummary{
				{ID: uuid.New(), Nickname: "alice", Role: "PLAYER", CoinBalance: 100, CreatedAt: time.Now()},
				{ID: uuid.New(), Nickname: "bob", Role: "ADMIN", CoinBalance: 500, CreatedAt: time.Now()},
			}, nil
		},
	}

	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/users?limit=10&offset=0", nil)
	rec := httptest.NewRecorder()
	h.ListUsers(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var users []UserSummary
	if err := json.NewDecoder(rec.Body).Decode(&users); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(users) != 2 {
		t.Fatalf("expected 2 users, got %d", len(users))
	}
}

func TestGetUser_Success(t *testing.T) {
	userID := uuid.New()
	email := "alice@example.com"

	mock := &mockService{
		getUserFn: func(_ context.Context, id uuid.UUID) (*UserSummary, error) {
			if id != userID {
				t.Fatalf("expected userID %s, got %s", userID, id)
			}
			return &UserSummary{
				ID:          userID,
				Nickname:    "alice",
				Email:       &email,
				Role:        "PLAYER",
				CoinBalance: 100,
				CreatedAt:   time.Now(),
			}, nil
		},
	}

	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/users/"+userID.String(), nil)
	req = withChiParam(req, "id", userID.String())

	rec := httptest.NewRecorder()
	h.GetUser(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var user UserSummary
	if err := json.NewDecoder(rec.Body).Decode(&user); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if user.ID != userID {
		t.Fatalf("expected user ID %s, got %s", userID, user.ID)
	}
	if user.Email == nil || *user.Email != email {
		t.Fatalf("expected email %s, got %v", email, user.Email)
	}
}

func TestGetUser_NotFound(t *testing.T) {
	userID := uuid.New()

	mock := &mockService{
		getUserFn: func(_ context.Context, _ uuid.UUID) (*UserSummary, error) {
			return nil, apperror.New(apperror.ErrNotFound, http.StatusNotFound, "user not found")
		},
	}

	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/users/"+userID.String(), nil)
	req = withChiParam(req, "id", userID.String())

	rec := httptest.NewRecorder()
	h.GetUser(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestUpdateUserRole_Success(t *testing.T) {
	userID := uuid.New()

	mock := &mockService{
		updateUserRoleFn: func(_ context.Context, id uuid.UUID, role string) (*UserSummary, error) {
			if id != userID {
				t.Fatalf("expected userID %s, got %s", userID, id)
			}
			if role != "ADMIN" {
				t.Fatalf("expected role ADMIN, got %s", role)
			}
			return &UserSummary{
				ID:       userID,
				Nickname: "alice",
				Role:     "ADMIN",
			}, nil
		},
	}

	h := NewHandler(mock)

	body, _ := json.Marshal(UpdateRoleRequest{Role: "ADMIN"})
	req := httptest.NewRequest(http.MethodPut, "/admin/users/"+userID.String()+"/role", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withChiParam(req, "id", userID.String())

	rec := httptest.NewRecorder()
	h.UpdateUserRole(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var user UserSummary
	if err := json.NewDecoder(rec.Body).Decode(&user); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if user.Role != "ADMIN" {
		t.Fatalf("expected role ADMIN, got %s", user.Role)
	}
}

func TestUpdateUserRole_InvalidBody(t *testing.T) {
	userID := uuid.New()

	mock := &mockService{}
	h := NewHandler(mock)

	// Send invalid role value.
	body := []byte(`{"role": "SUPERADMIN"}`)
	req := httptest.NewRequest(http.MethodPut, "/admin/users/"+userID.String()+"/role", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = withChiParam(req, "id", userID.String())

	rec := httptest.NewRecorder()
	h.UpdateUserRole(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestListAllThemes_Success(t *testing.T) {
	mock := &mockService{
		listAllThemesFn: func(_ context.Context, limit, offset int32) ([]ThemeSummary, error) {
			return []ThemeSummary{
				{ID: uuid.New(), Title: "Mystery Manor", Status: "PUBLISHED", MinPlayers: 4, MaxPlayers: 8},
				{ID: uuid.New(), Title: "Dark Castle", Status: "DRAFT", MinPlayers: 3, MaxPlayers: 6},
			}, nil
		},
	}

	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/themes?limit=10&offset=0", nil)
	rec := httptest.NewRecorder()
	h.ListAllThemes(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var themes []ThemeSummary
	if err := json.NewDecoder(rec.Body).Decode(&themes); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(themes) != 2 {
		t.Fatalf("expected 2 themes, got %d", len(themes))
	}
}

func TestForceUnpublishTheme_Success(t *testing.T) {
	themeID := uuid.New()

	mock := &mockService{
		forceUnpublishFn: func(_ context.Context, id uuid.UUID) (*ThemeSummary, error) {
			if id != themeID {
				t.Fatalf("expected themeID %s, got %s", themeID, id)
			}
			return &ThemeSummary{
				ID:     themeID,
				Title:  "Mystery Manor",
				Status: "DRAFT",
			}, nil
		},
	}

	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/themes/"+themeID.String()+"/unpublish", nil)
	req = withChiParam(req, "id", themeID.String())

	rec := httptest.NewRecorder()
	h.ForceUnpublishTheme(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var theme ThemeSummary
	if err := json.NewDecoder(rec.Body).Decode(&theme); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if theme.Status != "DRAFT" {
		t.Fatalf("expected status DRAFT, got %s", theme.Status)
	}
}

func TestListAllRooms_Success(t *testing.T) {
	mock := &mockService{
		listAllRoomsFn: func(_ context.Context, limit, offset int32) ([]RoomSummary, error) {
			return []RoomSummary{
				{ID: uuid.New(), Code: "ABC123", Status: "WAITING", MaxPlayers: 6},
				{ID: uuid.New(), Code: "XYZ789", Status: "PLAYING", MaxPlayers: 4},
			}, nil
		},
	}

	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/rooms?limit=10&offset=0", nil)
	rec := httptest.NewRecorder()
	h.ListAllRooms(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var rooms []RoomSummary
	if err := json.NewDecoder(rec.Body).Decode(&rooms); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(rooms) != 2 {
		t.Fatalf("expected 2 rooms, got %d", len(rooms))
	}
}

func TestForceCloseRoom_Success(t *testing.T) {
	roomID := uuid.New()

	mock := &mockService{
		forceCloseRoomFn: func(_ context.Context, id uuid.UUID) error {
			if id != roomID {
				t.Fatalf("expected roomID %s, got %s", roomID, id)
			}
			return nil
		},
	}

	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/rooms/"+roomID.String()+"/close", nil)
	req = withChiParam(req, "id", roomID.String())

	rec := httptest.NewRecorder()
	h.ForceCloseRoom(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d: %s", rec.Code, rec.Body.String())
	}
}
