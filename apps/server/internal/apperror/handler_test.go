package apperror

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
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

func TestWriteError_WithParams(t *testing.T) {
	appErr := BadRequest("invalid player count").
		WithParams(map[string]any{"min": 4, "max": 10})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/test", nil)

	WriteError(rec, req, appErr)

	res := rec.Result()
	defer res.Body.Close()

	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	params, ok := body["params"].(map[string]any)
	if !ok {
		t.Fatal("expected params in response")
	}
	if params["min"] != float64(4) {
		t.Errorf("expected params.min=4, got %v", params["min"])
	}
	if params["max"] != float64(10) {
		t.Errorf("expected params.max=10, got %v", params["max"])
	}
}

func TestWriteError_WithRequestIDAndRegistryMetadata(t *testing.T) {
	appErr := New(ErrEditorConfigVersionMismatch, http.StatusConflict, "stale editor config")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/editor/config", nil)
	req.Header.Set("X-Request-ID", "req-123")

	WriteError(rec, req, appErr)

	res := rec.Result()
	defer res.Body.Close()

	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body["request_id"] != "req-123" {
		t.Errorf("request_id = %v, want req-123", body["request_id"])
	}
	if body["correlation_id"] != "req-123" {
		t.Errorf("correlation_id = %v, want req-123", body["correlation_id"])
	}
	assertRFC3339Timestamp(t, body["timestamp"])
	if body["severity"] != string(SeverityHigh) {
		t.Errorf("severity = %v, want %s", body["severity"], SeverityHigh)
	}
	if body["retryable"] != false {
		t.Errorf("retryable = %v, want false", body["retryable"])
	}
	if body["user_action"] != "reload_or_merge" {
		t.Errorf("user_action = %v, want reload_or_merge", body["user_action"])
	}
}

func TestWriteError_UsesResponseRequestIDFromMiddleware(t *testing.T) {
	appErr := BadRequest("invalid input")

	rec := httptest.NewRecorder()
	rec.Header().Set("X-Request-ID", "middleware-generated")
	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	req.Header.Set("X-Request-ID", "client-provided")

	WriteError(rec, req, appErr)

	res := rec.Result()
	defer res.Body.Close()

	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body["request_id"] != "middleware-generated" {
		t.Errorf("request_id = %v, want middleware-generated", body["request_id"])
	}
	if body["correlation_id"] != "middleware-generated" {
		t.Errorf("correlation_id = %v, want middleware-generated", body["correlation_id"])
	}
}

func TestWriteError_UnknownCodeUsesStatusFallback(t *testing.T) {
	appErr := New("CUSTOM_UPSTREAM_TIMEOUT", http.StatusBadGateway, "upstream failed")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Request-ID", "client-req")

	WriteError(rec, req, appErr)

	res := rec.Result()
	defer res.Body.Close()

	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body["request_id"] != "client-req" {
		t.Errorf("request_id = %v, want client-req", body["request_id"])
	}
	if body["severity"] != string(SeverityHigh) {
		t.Errorf("severity = %v, want %s", body["severity"], SeverityHigh)
	}
	if body["retryable"] != true {
		t.Errorf("retryable = %v, want true", body["retryable"])
	}
	if body["user_action"] != "retry_later" {
		t.Errorf("user_action = %v, want retry_later", body["user_action"])
	}
}

func TestWriteError_WithFieldErrors(t *testing.T) {
	errs := []FieldError{
		{Field: "name", Message: "required", Code: "REQUIRED"},
		{Field: "email", Message: "invalid format", Code: "INVALID_FORMAT"},
	}
	appErr := Validation("validation failed", errs)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/test", nil)

	WriteError(rec, req, appErr)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("expected status 422, got %d", res.StatusCode)
	}

	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	errList, ok := body["errors"].([]any)
	if !ok {
		t.Fatal("expected errors array in response")
	}
	if len(errList) != 2 {
		t.Errorf("expected 2 field errors, got %d", len(errList))
	}

	first := errList[0].(map[string]any)
	if first["field"] != "name" {
		t.Errorf("expected first error field 'name', got %q", first["field"])
	}
}

func TestWriteError_DevMode_DebugInfo(t *testing.T) {
	SetDevMode(true)
	defer SetDevMode(false)

	cause := errors.New("connection refused")
	appErr := Internal("database error").Wrap(cause)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	WriteError(rec, req, appErr)

	res := rec.Result()
	defer res.Body.Close()

	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	debug, ok := body["debug"].(map[string]any)
	if !ok {
		t.Fatal("expected debug info in dev mode response")
	}
	if debug["internal"] != "connection refused" {
		t.Errorf("expected internal 'connection refused', got %q", debug["internal"])
	}

	// In dev mode, 5xx detail should NOT be masked.
	if body["detail"] != "database error" {
		t.Errorf("expected original detail in dev mode, got %q", body["detail"])
	}
}

func TestWriteError_ProdMode_MaskedDetail(t *testing.T) {
	SetDevMode(false)
	defer SetDevMode(false)

	appErr := Internal("sensitive database info leaked")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	WriteError(rec, req, appErr)

	res := rec.Result()
	defer res.Body.Close()

	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body["detail"] != "an unexpected error occurred" {
		t.Errorf("expected masked detail in prod mode, got %q", body["detail"])
	}

	// No debug info in production.
	if body["debug"] != nil {
		t.Error("expected no debug info in prod mode")
	}
}

func TestWriteError_WrappedError_Logging(t *testing.T) {
	cause := errors.New("pg: connection timeout")
	appErr := Internal("database unavailable").Wrap(cause)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	// This test verifies the wrapped error path executes without panic.
	// The Internal field should be used for logging (verified by no panic).
	WriteError(rec, req, appErr)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", res.StatusCode)
	}

	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body["code"] != ErrInternal {
		t.Errorf("expected code %q, got %v", ErrInternal, body["code"])
	}
}

func assertRFC3339Timestamp(t *testing.T, value any) {
	t.Helper()

	raw, ok := value.(string)
	if !ok || raw == "" {
		t.Fatalf("timestamp = %v, want non-empty RFC3339 timestamp", value)
	}
	if _, err := time.Parse(time.RFC3339Nano, raw); err != nil {
		t.Fatalf("timestamp = %q, want RFC3339Nano: %v", raw, err)
	}
}
