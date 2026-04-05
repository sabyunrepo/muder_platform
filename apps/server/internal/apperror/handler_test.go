package apperror

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteError_AppError(t *testing.T) {
	appErr := New(ErrNotFound, http.StatusNotFound, "resource not found")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	WriteError(rec, req, appErr)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", res.StatusCode)
	}

	ct := res.Header.Get("Content-Type")
	if ct != "application/problem+json" {
		t.Errorf("expected Content-Type application/problem+json, got %q", ct)
	}

	var body problemResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Type != "about:blank" {
		t.Errorf("expected type 'about:blank', got %q", body.Type)
	}
	if body.Status != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", body.Status)
	}
	if body.Code != ErrNotFound {
		t.Errorf("expected code %q, got %q", ErrNotFound, body.Code)
	}
	if body.Detail != "resource not found" {
		t.Errorf("expected detail 'resource not found', got %q", body.Detail)
	}
	if body.Title != "Not Found" {
		t.Errorf("expected title 'Not Found', got %q", body.Title)
	}
}

func TestWriteError_CustomType(t *testing.T) {
	appErr := New(ErrGameFull, http.StatusConflict, "game is full").
		WithType("https://mmp.example.com/errors/game-full")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/join", nil)

	WriteError(rec, req, appErr)

	res := rec.Result()
	defer res.Body.Close()

	var body problemResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Type != "https://mmp.example.com/errors/game-full" {
		t.Errorf("expected custom type URI, got %q", body.Type)
	}
	if body.Code != ErrGameFull {
		t.Errorf("expected code %q, got %q", ErrGameFull, body.Code)
	}
}

func TestWriteError_GenericError(t *testing.T) {
	genericErr := http.ErrBodyNotAllowed // just any non-AppError

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	WriteError(rec, req, genericErr)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", res.StatusCode)
	}

	var body problemResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Code != ErrInternal {
		t.Errorf("expected code %q, got %q", ErrInternal, body.Code)
	}
}

func TestWriteError_WithInstance(t *testing.T) {
	appErr := New(ErrBadRequest, http.StatusBadRequest, "invalid input").
		WithInstance("/api/v1/games/123")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/games/123", nil)

	WriteError(rec, req, appErr)

	res := rec.Result()
	defer res.Body.Close()

	var body problemResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Instance != "/api/v1/games/123" {
		t.Errorf("expected instance '/api/v1/games/123', got %q", body.Instance)
	}
}
