package profile_test

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"go.uber.org/mock/gomock"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/domain/profile"
	"github.com/mmp-platform/server/internal/domain/profile/mocks"
	"github.com/mmp-platform/server/internal/middleware"
)

func withUserID(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, middleware.UserIDKey, userID)
}

func TestGetProfile_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	uid := uuid.New()
	email := "test@example.com"
	mock.EXPECT().
		GetProfile(gomock.Any(), gomock.Eq(uid)).
		Return(&profile.ProfileResponse{
			ID:          uid,
			Nickname:    "tester",
			Email:       &email,
			Role:        "PLAYER",
			CoinBalance: 100,
		}, nil).Times(1)

	h := profile.NewHandler(mock)
	req := httptest.NewRequest(http.MethodGet, "/profile", nil)
	req = req.WithContext(withUserID(req.Context(), uid))
	rec := httptest.NewRecorder()

	h.GetProfile(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var resp profile.ProfileResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Nickname != "tester" {
		t.Errorf("expected nickname 'tester', got %q", resp.Nickname)
	}
	if resp.CoinBalance != 100 {
		t.Errorf("expected coin_balance 100, got %d", resp.CoinBalance)
	}
}

func TestGetProfile_NotFound(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	uid := uuid.New()
	mock.EXPECT().
		GetProfile(gomock.Any(), gomock.Any()).
		Return(nil, apperror.NotFound("user not found")).Times(1)

	h := profile.NewHandler(mock)
	req := httptest.NewRequest(http.MethodGet, "/profile", nil)
	req = req.WithContext(withUserID(req.Context(), uid))
	rec := httptest.NewRecorder()

	h.GetProfile(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", rec.Code)
	}
}

func TestUpdateProfile_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	uid := uuid.New()
	avatar := "https://example.com/avatar.png"
	mock.EXPECT().
		UpdateProfile(gomock.Any(), gomock.Eq(uid), gomock.Any()).
		DoAndReturn(func(_ context.Context, id uuid.UUID, r profile.UpdateProfileRequest) (*profile.ProfileResponse, error) {
			return &profile.ProfileResponse{
				ID:          id,
				Nickname:    r.Nickname,
				AvatarURL:   r.AvatarURL,
				Role:        "PLAYER",
				CoinBalance: 50,
			}, nil
		}).Times(1)

	body, _ := json.Marshal(map[string]string{
		"nickname":   "newname",
		"avatar_url": avatar,
	})

	h := profile.NewHandler(mock)
	req := httptest.NewRequest(http.MethodPut, "/profile", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(withUserID(req.Context(), uid))
	rec := httptest.NewRecorder()

	h.UpdateProfile(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp profile.ProfileResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Nickname != "newname" {
		t.Errorf("expected nickname 'newname', got %q", resp.Nickname)
	}
}

func TestUpdateProfile_InvalidBody(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	uid := uuid.New()

	// nickname too short (min=2)
	body, _ := json.Marshal(map[string]string{
		"nickname": "x",
	})

	h := profile.NewHandler(mock)
	req := httptest.NewRequest(http.MethodPut, "/profile", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(withUserID(req.Context(), uid))
	rec := httptest.NewRecorder()

	h.UpdateProfile(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d; body: %s", rec.Code, rec.Body.String())
	}
}

func TestGetPublicProfile_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	uid := uuid.New()
	mock.EXPECT().
		GetPublicProfile(gomock.Any(), gomock.Eq(uid)).
		Return(&profile.PublicProfileResponse{
			ID:       uid,
			Nickname: "publicuser",
		}, nil).Times(1)

	h := profile.NewHandler(mock)

	r := chi.NewRouter()
	r.Get("/users/{id}", h.GetPublicProfile)

	req := httptest.NewRequest(http.MethodGet, "/users/"+uid.String(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var resp profile.PublicProfileResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Nickname != "publicuser" {
		t.Errorf("expected nickname 'publicuser', got %q", resp.Nickname)
	}
}

func TestGetPublicProfile_InvalidUUID(t *testing.T) {
	ctrl := gomock.NewController(t)
	mock := mocks.NewMockService(ctrl)

	h := profile.NewHandler(mock)

	r := chi.NewRouter()
	r.Get("/users/{id}", h.GetPublicProfile)

	req := httptest.NewRequest(http.MethodGet, "/users/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}
}

// Ensure mockService satisfies the full Service interface (compile-time check).
var _ profile.Service = (*mocks.MockService)(nil)
var _ profile.Service = (interface {
	GetProfile(ctx context.Context, userID uuid.UUID) (*profile.ProfileResponse, error)
	GetPublicProfile(ctx context.Context, userID uuid.UUID) (*profile.PublicProfileResponse, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, req profile.UpdateProfileRequest) (*profile.ProfileResponse, error)
	UpdateAvatar(ctx context.Context, userID uuid.UUID, file multipart.File, header *multipart.FileHeader) (*profile.AvatarResponse, error)
	GetNotificationPrefs(ctx context.Context, userID uuid.UUID) (*profile.NotificationPrefsResponse, error)
	UpdateNotificationPrefs(ctx context.Context, userID uuid.UUID, req profile.UpdateNotificationPrefsRequest) (*profile.NotificationPrefsResponse, error)
})(nil)
