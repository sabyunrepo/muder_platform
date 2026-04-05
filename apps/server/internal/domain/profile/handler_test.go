package profile

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
	getProfileFn    func(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error)
	getPublicFn     func(ctx context.Context, userID uuid.UUID) (*PublicProfileResponse, error)
	updateProfileFn func(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*ProfileResponse, error)
}

func (m *mockService) GetProfile(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error) {
	return m.getProfileFn(ctx, userID)
}

func (m *mockService) GetPublicProfile(ctx context.Context, userID uuid.UUID) (*PublicProfileResponse, error) {
	return m.getPublicFn(ctx, userID)
}

func (m *mockService) UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*ProfileResponse, error) {
	return m.updateProfileFn(ctx, userID, req)
}

func withUserID(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, middleware.UserIDKey, userID)
}

func TestGetProfile_Success(t *testing.T) {
	uid := uuid.New()
	email := "test@example.com"
	mock := &mockService{
		getProfileFn: func(_ context.Context, id uuid.UUID) (*ProfileResponse, error) {
			if id != uid {
				t.Fatalf("expected userID %v, got %v", uid, id)
			}
			return &ProfileResponse{
				ID:          uid,
				Nickname:    "tester",
				Email:       &email,
				Role:        "PLAYER",
				CoinBalance: 100,
			}, nil
		},
	}

	h := NewHandler(mock)
	req := httptest.NewRequest(http.MethodGet, "/profile", nil)
	req = req.WithContext(withUserID(req.Context(), uid))
	rec := httptest.NewRecorder()

	h.GetProfile(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var resp ProfileResponse
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
	uid := uuid.New()
	mock := &mockService{
		getProfileFn: func(_ context.Context, _ uuid.UUID) (*ProfileResponse, error) {
			return nil, apperror.NotFound("user not found")
		},
	}

	h := NewHandler(mock)
	req := httptest.NewRequest(http.MethodGet, "/profile", nil)
	req = req.WithContext(withUserID(req.Context(), uid))
	rec := httptest.NewRecorder()

	h.GetProfile(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", rec.Code)
	}
}

func TestUpdateProfile_Success(t *testing.T) {
	uid := uuid.New()
	avatar := "https://example.com/avatar.png"
	mock := &mockService{
		updateProfileFn: func(_ context.Context, id uuid.UUID, r UpdateProfileRequest) (*ProfileResponse, error) {
			if id != uid {
				t.Fatalf("expected userID %v, got %v", uid, id)
			}
			return &ProfileResponse{
				ID:          uid,
				Nickname:    r.Nickname,
				AvatarURL:   r.AvatarURL,
				Role:        "PLAYER",
				CoinBalance: 50,
			}, nil
		},
	}

	body, _ := json.Marshal(map[string]string{
		"nickname":   "newname",
		"avatar_url": avatar,
	})

	h := NewHandler(mock)
	req := httptest.NewRequest(http.MethodPut, "/profile", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(withUserID(req.Context(), uid))
	rec := httptest.NewRecorder()

	h.UpdateProfile(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var resp ProfileResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Nickname != "newname" {
		t.Errorf("expected nickname 'newname', got %q", resp.Nickname)
	}
}

func TestUpdateProfile_InvalidBody(t *testing.T) {
	uid := uuid.New()
	mock := &mockService{}

	// nickname too short (min=2)
	body, _ := json.Marshal(map[string]string{
		"nickname": "x",
	})

	h := NewHandler(mock)
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
	uid := uuid.New()
	mock := &mockService{
		getPublicFn: func(_ context.Context, id uuid.UUID) (*PublicProfileResponse, error) {
			return &PublicProfileResponse{
				ID:       id,
				Nickname: "publicuser",
			}, nil
		},
	}

	h := NewHandler(mock)

	// Use chi router to inject URL param
	r := chi.NewRouter()
	r.Get("/users/{id}", h.GetPublicProfile)

	req := httptest.NewRequest(http.MethodGet, "/users/"+uid.String(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var resp PublicProfileResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Nickname != "publicuser" {
		t.Errorf("expected nickname 'publicuser', got %q", resp.Nickname)
	}
}

func TestGetPublicProfile_InvalidUUID(t *testing.T) {
	mock := &mockService{}
	h := NewHandler(mock)

	r := chi.NewRouter()
	r.Get("/users/{id}", h.GetPublicProfile)

	req := httptest.NewRequest(http.MethodGet, "/users/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}
}
