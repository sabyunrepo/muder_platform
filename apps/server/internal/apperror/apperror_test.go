package apperror

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
)

func TestNew(t *testing.T) {
	err := New("TEST_CODE", http.StatusTeapot, "test detail")

	if err.Type != "about:blank" {
		t.Errorf("Type = %q, want %q", err.Type, "about:blank")
	}
	if err.Code != "TEST_CODE" {
		t.Errorf("Code = %q, want %q", err.Code, "TEST_CODE")
	}
	if err.Status != http.StatusTeapot {
		t.Errorf("Status = %d, want %d", err.Status, http.StatusTeapot)
	}
	if err.Title != http.StatusText(http.StatusTeapot) {
		t.Errorf("Title = %q, want %q", err.Title, http.StatusText(http.StatusTeapot))
	}
	if err.Detail != "test detail" {
		t.Errorf("Detail = %q, want %q", err.Detail, "test detail")
	}
}

func TestAppError_Wrap_Unwrap(t *testing.T) {
	cause := fmt.Errorf("database connection failed")
	appErr := Internal("something went wrong").Wrap(cause)

	// errors.Is should find the cause
	if !errors.Is(appErr, cause) {
		t.Error("errors.Is did not find wrapped cause")
	}

	// errors.As should unwrap to *AppError
	var target *AppError
	if !errors.As(appErr, &target) {
		t.Error("errors.As did not find *AppError")
	}
	if target.Code != ErrInternal {
		t.Errorf("Code = %q, want %q", target.Code, ErrInternal)
	}

	// Unwrap should return the cause
	if appErr.Unwrap() != cause {
		t.Error("Unwrap did not return original cause")
	}

	// Unwrap on error without Internal should return nil
	plain := NotFound("x")
	if plain.Unwrap() != nil {
		t.Error("Unwrap on plain error should return nil")
	}
}

func TestAppError_WithParams(t *testing.T) {
	params := map[string]any{"max": 100, "field": "name"}
	err := BadRequest("too long").WithParams(params)

	if err.Params == nil {
		t.Fatal("Params is nil")
	}
	if err.Params["max"] != 100 {
		t.Errorf("Params[max] = %v, want 100", err.Params["max"])
	}
	if err.Params["field"] != "name" {
		t.Errorf("Params[field] = %v, want name", err.Params["field"])
	}
}

func TestAppError_WithErrors(t *testing.T) {
	fieldErrors := []FieldError{
		{Field: "email", Message: "invalid format", Code: "INVALID_EMAIL"},
		{Field: "age", Message: "must be positive", Code: "INVALID_AGE"},
	}
	err := BadRequest("validation failed").WithErrors(fieldErrors)

	if len(err.Errors) != 2 {
		t.Fatalf("len(Errors) = %d, want 2", len(err.Errors))
	}
	if err.Errors[0].Field != "email" {
		t.Errorf("Errors[0].Field = %q, want %q", err.Errors[0].Field, "email")
	}
	if err.Errors[1].Code != "INVALID_AGE" {
		t.Errorf("Errors[1].Code = %q, want %q", err.Errors[1].Code, "INVALID_AGE")
	}
}

func TestValidation(t *testing.T) {
	fieldErrors := []FieldError{
		{Field: "username", Message: "required", Code: "REQUIRED"},
	}
	err := Validation("input validation failed", fieldErrors)

	if err.Code != ErrValidation {
		t.Errorf("Code = %q, want %q", err.Code, ErrValidation)
	}
	if err.Status != http.StatusUnprocessableEntity {
		t.Errorf("Status = %d, want %d", err.Status, http.StatusUnprocessableEntity)
	}
	if len(err.Errors) != 1 {
		t.Fatalf("len(Errors) = %d, want 1", len(err.Errors))
	}
	if err.Errors[0].Field != "username" {
		t.Errorf("Errors[0].Field = %q, want %q", err.Errors[0].Field, "username")
	}
}

func TestAppError_Immutability(t *testing.T) {
	original := BadRequest("original")

	// WithParams should not mutate original
	_ = original.WithParams(map[string]any{"key": "value"})
	if original.Params != nil {
		t.Error("WithParams mutated original")
	}

	// WithErrors should not mutate original
	_ = original.WithErrors([]FieldError{{Field: "f", Message: "m", Code: "c"}})
	if original.Errors != nil {
		t.Error("WithErrors mutated original")
	}

	// Wrap should not mutate original
	_ = original.Wrap(fmt.Errorf("cause"))
	if original.Internal != nil {
		t.Error("Wrap mutated original")
	}

	// WithType should not mutate original
	_ = original.WithType("urn:custom")
	if original.Type != "about:blank" {
		t.Error("WithType mutated original")
	}

	// WithInstance should not mutate original
	_ = original.WithInstance("/api/test")
	if original.Instance != "" {
		t.Error("WithInstance mutated original")
	}
}

func TestAppError_Error(t *testing.T) {
	err := New("TEST_CODE", http.StatusBadRequest, "something broke")
	expected := "[TEST_CODE] Bad Request: something broke"
	if err.Error() != expected {
		t.Errorf("Error() = %q, want %q", err.Error(), expected)
	}
}

func TestConflict(t *testing.T) {
	err := Conflict("resource already exists")
	if err.Code != ErrConflict {
		t.Errorf("Code = %q, want %q", err.Code, ErrConflict)
	}
	if err.Status != http.StatusConflict {
		t.Errorf("Status = %d, want %d", err.Status, http.StatusConflict)
	}
}

func TestTimeout(t *testing.T) {
	err := Timeout("request timed out")
	if err.Code != ErrTimeout {
		t.Errorf("Code = %q, want %q", err.Code, ErrTimeout)
	}
	if err.Status != http.StatusRequestTimeout {
		t.Errorf("Status = %d, want %d", err.Status, http.StatusRequestTimeout)
	}
}
