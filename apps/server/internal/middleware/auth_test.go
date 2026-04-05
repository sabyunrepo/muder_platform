package middleware_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/middleware"
)

const testSecret = "test-secret-key-for-hmac-256"

func makeToken(t *testing.T, claims jwt.MapClaims, secret string) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return signed
}

func TestAuth_ValidToken(t *testing.T) {
	userID := uuid.New()
	tokenStr := makeToken(t, jwt.MapClaims{
		"sub":  userID.String(),
		"role": "HOST",
		"exp":  jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}, testSecret)

	var gotID uuid.UUID
	var gotRole string
	handler := middleware.Auth(middleware.JWTConfig{Secret: []byte(testSecret)})(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotID = middleware.UserIDFrom(r.Context())
			gotRole = middleware.UserRoleFrom(r.Context())
			w.WriteHeader(http.StatusOK)
		}),
	)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if gotID != userID {
		t.Fatalf("expected userID %s, got %s", userID, gotID)
	}
	if gotRole != "HOST" {
		t.Fatalf("expected role HOST, got %s", gotRole)
	}
}

func TestAuth_DefaultRole(t *testing.T) {
	userID := uuid.New()
	tokenStr := makeToken(t, jwt.MapClaims{
		"sub": userID.String(),
		"exp": jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}, testSecret)

	var gotRole string
	handler := middleware.Auth(middleware.JWTConfig{Secret: []byte(testSecret)})(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotRole = middleware.UserRoleFrom(r.Context())
			w.WriteHeader(http.StatusOK)
		}),
	)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if gotRole != "PLAYER" {
		t.Fatalf("expected default role PLAYER, got %s", gotRole)
	}
}

func TestAuth_MissingHeader(t *testing.T) {
	handler := middleware.Auth(middleware.JWTConfig{Secret: []byte(testSecret)})(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatal("handler should not be called")
		}),
	)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestAuth_InvalidFormat(t *testing.T) {
	handler := middleware.Auth(middleware.JWTConfig{Secret: []byte(testSecret)})(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatal("handler should not be called")
		}),
	)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Basic abc123")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestAuth_ExpiredToken(t *testing.T) {
	tokenStr := makeToken(t, jwt.MapClaims{
		"sub": uuid.New().String(),
		"exp": jwt.NewNumericDate(time.Now().Add(-time.Hour)),
	}, testSecret)

	handler := middleware.Auth(middleware.JWTConfig{Secret: []byte(testSecret)})(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatal("handler should not be called")
		}),
	)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestAuth_InvalidSigningMethod(t *testing.T) {
	// Create a token signed with RSA but our middleware expects HMAC
	// We simulate this by signing with a different secret
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": uuid.New().String(),
		"exp": jwt.NewNumericDate(time.Now().Add(time.Hour)),
	})
	tokenStr, _ := token.SignedString([]byte("wrong-secret"))

	handler := middleware.Auth(middleware.JWTConfig{Secret: []byte(testSecret)})(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatal("handler should not be called")
		}),
	)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestRequireRole_Matching(t *testing.T) {
	userID := uuid.New()
	tokenStr := makeToken(t, jwt.MapClaims{
		"sub":  userID.String(),
		"role": "ADMIN",
		"exp":  jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}, testSecret)

	handler := middleware.Auth(middleware.JWTConfig{Secret: []byte(testSecret)})(
		middleware.RequireRole("ADMIN", "HOST")(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}),
		),
	)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestRequireRole_NonMatching(t *testing.T) {
	userID := uuid.New()
	tokenStr := makeToken(t, jwt.MapClaims{
		"sub":  userID.String(),
		"role": "PLAYER",
		"exp":  jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}, testSecret)

	handler := middleware.Auth(middleware.JWTConfig{Secret: []byte(testSecret)})(
		middleware.RequireRole("ADMIN")(
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				t.Fatal("handler should not be called")
			}),
		),
	)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode body: %v", err)
	}
	if body["code"] != "FORBIDDEN" {
		t.Fatalf("expected code FORBIDDEN, got %v", body["code"])
	}
}
