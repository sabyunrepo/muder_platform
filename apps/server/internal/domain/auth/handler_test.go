package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/middleware"
)

// mockService implements Service for testing.
type mockService struct {
	callbackFn   func(ctx context.Context, provider, code, nickname string) (*TokenPair, error)
	refreshFn    func(ctx context.Context, refreshToken string) (*TokenPair, error)
	logoutFn     func(ctx context.Context, userID uuid.UUID) error
	getCurrentFn func(ctx context.Context, userID uuid.UUID) (*UserResponse, error)
}

func (m *mockService) OAuthCallback(ctx context.Context, provider, code, nickname string) (*TokenPair, error) {
	return m.callbackFn(ctx, provider, code, nickname)
}

func (m *mockService) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	return m.refreshFn(ctx, refreshToken)
}

func (m *mockService) Logout(ctx context.Context, userID uuid.UUID) error {
	return m.logoutFn(ctx, userID)
}

func (m *mockService) GetCurrentUser(ctx context.Context, userID uuid.UUID) (*UserResponse, error) {
	return m.getCurrentFn(ctx, userID)
}

func (m *mockService) Login(ctx context.Context, email, password string) (*TokenPair, error) {
	return nil, nil
}

func (m *mockService) Register(ctx context.Context, email, password, nickname string) (*TokenPair, error) {
	return nil, nil
}

func jsonBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	buf := new(bytes.Buffer)
	if err := json.NewEncoder(buf).Encode(v); err != nil {
		t.Fatalf("failed to encode json body: %v", err)
	}
	return buf
}

func withAuthContext(r *http.Request, userID uuid.UUID, role string) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID)
	ctx = context.WithValue(ctx, middleware.UserRoleKey, role)
	return r.WithContext(ctx)
}

func TestHandleCallback_Success(t *testing.T) {
	want := &TokenPair{
		AccessToken:  "access-token-123",
		RefreshToken: "refresh-token-456",
		ExpiresIn:    900,
	}

	mock := &mockService{
		callbackFn: func(_ context.Context, provider, code, nickname string) (*TokenPair, error) {
			if provider != "discord" {
				t.Errorf("expected provider discord, got %s", provider)
			}
			if code != "oauth-code" {
				t.Errorf("expected code oauth-code, got %s", code)
			}
			if nickname != "Player1" {
				t.Errorf("expected nickname Player1, got %s", nickname)
			}
			return want, nil
		},
	}

	h := NewHandler(mock)
	body := jsonBody(t, map[string]string{
		"provider": "discord",
		"code":     "oauth-code",
		"nickname": "Player1",
	})

	req := httptest.NewRequest(http.MethodPost, "/auth/callback", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.HandleCallback(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var got TokenPair
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.AccessToken != want.AccessToken {
		t.Errorf("access_token: want %s, got %s", want.AccessToken, got.AccessToken)
	}
	if got.RefreshToken != want.RefreshToken {
		t.Errorf("refresh_token: want %s, got %s", want.RefreshToken, got.RefreshToken)
	}
	if got.ExpiresIn != want.ExpiresIn {
		t.Errorf("expires_in: want %d, got %d", want.ExpiresIn, got.ExpiresIn)
	}
}

func TestHandleCallback_InvalidBody(t *testing.T) {
	mock := &mockService{}
	h := NewHandler(mock)

	// Empty body — should fail validation.
	body := jsonBody(t, map[string]string{})
	req := httptest.NewRequest(http.MethodPost, "/auth/callback", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.HandleCallback(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandleRefresh_Success(t *testing.T) {
	want := &TokenPair{
		AccessToken:  "new-access",
		RefreshToken: "new-refresh",
		ExpiresIn:    900,
	}

	mock := &mockService{
		refreshFn: func(_ context.Context, refreshToken string) (*TokenPair, error) {
			if refreshToken != "old-refresh" {
				t.Errorf("expected old-refresh, got %s", refreshToken)
			}
			return want, nil
		},
	}

	h := NewHandler(mock)
	body := jsonBody(t, map[string]string{"refresh_token": "old-refresh"})
	req := httptest.NewRequest(http.MethodPost, "/auth/refresh", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.HandleRefresh(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var got TokenPair
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.AccessToken != want.AccessToken {
		t.Errorf("access_token: want %s, got %s", want.AccessToken, got.AccessToken)
	}
}

func TestHandleRefresh_InvalidToken(t *testing.T) {
	mock := &mockService{
		refreshFn: func(_ context.Context, _ string) (*TokenPair, error) {
			return nil, apperror.Unauthorized("invalid or expired refresh token")
		},
	}

	h := NewHandler(mock)
	body := jsonBody(t, map[string]string{"refresh_token": "bad-token"})
	req := httptest.NewRequest(http.MethodPost, "/auth/refresh", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.HandleRefresh(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandleMe_Success(t *testing.T) {
	userID := uuid.New()
	email := "test@example.com"
	want := &UserResponse{
		ID:       userID,
		Nickname: "TestPlayer",
		Email:    &email,
		Role:     "PLAYER",
	}

	mock := &mockService{
		getCurrentFn: func(_ context.Context, id uuid.UUID) (*UserResponse, error) {
			if id != userID {
				t.Errorf("expected userID %s, got %s", userID, id)
			}
			return want, nil
		},
	}

	h := NewHandler(mock)
	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	req = withAuthContext(req, userID, "PLAYER")
	rec := httptest.NewRecorder()

	h.HandleMe(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var got UserResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.ID != want.ID {
		t.Errorf("id: want %s, got %s", want.ID, got.ID)
	}
	if got.Nickname != want.Nickname {
		t.Errorf("nickname: want %s, got %s", want.Nickname, got.Nickname)
	}
}

func TestHandleMe_Unauthenticated(t *testing.T) {
	mock := &mockService{}
	h := NewHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	rec := httptest.NewRecorder()

	h.HandleMe(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandleLogout_Success(t *testing.T) {
	userID := uuid.New()

	mock := &mockService{
		logoutFn: func(_ context.Context, id uuid.UUID) error {
			if id != userID {
				t.Errorf("expected userID %s, got %s", userID, id)
			}
			return nil
		},
	}

	h := NewHandler(mock)
	req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	req = withAuthContext(req, userID, "PLAYER")
	rec := httptest.NewRecorder()

	h.HandleLogout(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
