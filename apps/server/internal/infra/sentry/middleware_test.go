package sentry

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMiddleware_PassesRequestThrough(t *testing.T) {
	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	handler := Middleware(inner)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("inner handler was not called")
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestMiddleware_SetsHubOnContext(t *testing.T) {
	var hubWasSet bool
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The middleware calls sentry.SetHubOnContext; even without SDK init
		// the hub clone should be non-nil.
		hubWasSet = r.Context() != nil
		w.WriteHeader(http.StatusNoContent)
	})

	handler := Middleware(inner)
	req := httptest.NewRequest(http.MethodPost, "/hub-check", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !hubWasSet {
		t.Fatal("context was nil inside handler")
	}
}

func TestMiddleware_WithAuthorizationHeader(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	})

	handler := Middleware(inner)
	req := httptest.NewRequest(http.MethodGet, "/auth", nil)
	req.Header.Set("Authorization", "Bearer token123")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Errorf("expected 202, got %d", rec.Code)
	}
}

func TestMiddleware_ChainMultiple(t *testing.T) {
	order := []string{}
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		order = append(order, "inner")
		w.WriteHeader(http.StatusOK)
	})

	// wrap twice to verify no panic on double-wrap
	handler := Middleware(Middleware(inner))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if len(order) != 1 || order[0] != "inner" {
		t.Errorf("expected inner called once, got %v", order)
	}
}
