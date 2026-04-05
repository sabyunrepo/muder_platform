package httputil_test

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/rs/zerolog"
)

// withLogger injects a discard zerolog logger into the request context
// so that apperror.WriteError does not panic.
func withLogger(r *http.Request) *http.Request {
	logger := zerolog.New(io.Discard)
	return r.WithContext(logger.WithContext(r.Context()))
}

func TestWrapHandler_NilError(t *testing.T) {
	handler := httputil.WrapHandler(func(w http.ResponseWriter, r *http.Request) error {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
		return nil
	})

	r := withLogger(httptest.NewRequest(http.MethodGet, "/", nil))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", ct)
	}
	if body := w.Body.String(); body != `{"ok":true}` {
		t.Fatalf("unexpected body: %s", body)
	}
}

func TestWrapHandler_AppError(t *testing.T) {
	handler := httputil.WrapHandler(func(w http.ResponseWriter, r *http.Request) error {
		return apperror.NotFound("room not found")
	})

	r := withLogger(httptest.NewRequest(http.MethodGet, "/rooms/1", nil))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/problem+json" {
		t.Fatalf("expected Content-Type application/problem+json, got %q", ct)
	}

	var body map[string]any
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["code"] != "NOT_FOUND" {
		t.Fatalf("expected code NOT_FOUND, got %v", body["code"])
	}
	if body["detail"] != "room not found" {
		t.Fatalf("expected detail 'room not found', got %v", body["detail"])
	}
	if status, ok := body["status"].(float64); !ok || int(status) != 404 {
		t.Fatalf("expected status 404 in body, got %v", body["status"])
	}
}

func TestWrapHandler_GenericError(t *testing.T) {
	handler := httputil.WrapHandler(func(w http.ResponseWriter, r *http.Request) error {
		return errors.New("something went wrong")
	})

	r := withLogger(httptest.NewRequest(http.MethodGet, "/", nil))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/problem+json" {
		t.Fatalf("expected Content-Type application/problem+json, got %q", ct)
	}

	var body map[string]any
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	// Generic errors must not leak internal details.
	if body["detail"] != "an unexpected error occurred" {
		t.Fatalf("expected generic detail, got %v", body["detail"])
	}
	if body["code"] != "INTERNAL_ERROR" {
		t.Fatalf("expected code INTERNAL_ERROR, got %v", body["code"])
	}
}

func TestWrapHandler_WritesBeforeError(t *testing.T) {
	// When the handler has already written to the ResponseWriter before
	// returning an error, WrapHandler must not panic.
	handler := httputil.WrapHandler(func(w http.ResponseWriter, r *http.Request) error {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("partial"))
		return errors.New("late error")
	})

	r := withLogger(httptest.NewRequest(http.MethodGet, "/", nil))
	w := httptest.NewRecorder()

	// Must not panic.
	handler.ServeHTTP(w, r)

	// The first WriteHeader wins in httptest.ResponseRecorder,
	// so status remains 200 from the handler's explicit write.
	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 (first write wins), got %d", w.Code)
	}
}
