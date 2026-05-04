package apperror

import (
	"fmt"
	"net/http"
)

// AppError represents an application error following RFC 9457 Problem Details.
//
// Extensions carries RFC 9457 "extension members": caller-specific fields that
// surface inside the Problem Details body without being part of the standard
// envelope. Use WithExtensions to attach (e.g. {"current_version": 42} on an
// optimistic-lock 409). Extensions never leak into the Error() string.
type AppError struct {
	Type       string         `json:"type"`
	Code       string         `json:"code"`
	Status     int            `json:"status"`
	Title      string         `json:"title"`
	Detail     string         `json:"detail"`
	Instance   string         `json:"instance,omitempty"`
	Params     map[string]any `json:"params,omitempty"`
	Errors     []FieldError   `json:"errors,omitempty"`
	Extensions map[string]any `json:"extensions,omitempty"`
	Internal   error          `json:"-"`
}

// Error implements the error interface.
func (e *AppError) Error() string {
	return fmt.Sprintf("[%s] %s: %s", e.Code, e.Title, e.Detail)
}

// New creates a new AppError with the given code, status, and detail message.
// The Type field defaults to "about:blank" per RFC 9457.
func New(code string, status int, detail string) *AppError {
	return &AppError{
		Type:   "about:blank",
		Code:   code,
		Status: status,
		Title:  http.StatusText(status),
		Detail: detail,
	}
}

// WithType returns a copy of the error with a custom type URI.
func (e *AppError) WithType(typeURI string) *AppError {
	copied := *e
	copied.Type = typeURI
	return &copied
}

// WithInstance returns a copy of the error with the instance field set.
func (e *AppError) WithInstance(instance string) *AppError {
	copied := *e
	copied.Instance = instance
	return &copied
}

// NotFound creates a 404 Not Found error.
func NotFound(detail string) *AppError {
	return New(ErrNotFound, http.StatusNotFound, detail)
}

// BadRequest creates a 400 Bad Request error.
func BadRequest(detail string) *AppError {
	return New(ErrBadRequest, http.StatusBadRequest, detail)
}

// Unauthorized creates a 401 Unauthorized error.
func Unauthorized(detail string) *AppError {
	return New(ErrUnauthorized, http.StatusUnauthorized, detail)
}

// Forbidden creates a 403 Forbidden error.
func Forbidden(detail string) *AppError {
	return New(ErrForbidden, http.StatusForbidden, detail)
}

// Internal creates a 500 Internal Server Error.
func Internal(detail string) *AppError {
	return New(ErrInternal, http.StatusInternalServerError, detail)
}

// Validation creates a 422 Unprocessable Entity error with field-level errors.
func Validation(detail string, errs []FieldError) *AppError {
	return &AppError{
		Type:   "about:blank",
		Code:   ErrValidation,
		Status: http.StatusUnprocessableEntity,
		Title:  http.StatusText(http.StatusUnprocessableEntity),
		Detail: detail,
		Errors: errs,
	}
}

// Conflict creates a 409 Conflict error.
func Conflict(detail string) *AppError {
	return New(ErrConflict, http.StatusConflict, detail)
}

// Timeout creates a 408 Request Timeout error.
func Timeout(detail string) *AppError {
	return New(ErrTimeout, http.StatusRequestTimeout, detail)
}

// MethodNotAllowed creates a 405 Method Not Allowed error.
func MethodNotAllowed(detail string) *AppError {
	return New(ErrMethodNotAllowed, http.StatusMethodNotAllowed, detail)
}

// Unwrap supports errors.Is/As chain traversal.
func (e *AppError) Unwrap() error {
	return e.Internal
}

// Wrap returns a copy of the error with the original error preserved.
func (e *AppError) Wrap(err error) *AppError {
	copied := *e
	copied.Internal = err
	return &copied
}

// WithParams returns a copy of the error with i18n parameters attached.
// The map is deep-copied to prevent shared mutation.
func (e *AppError) WithParams(params map[string]any) *AppError {
	copied := *e
	if len(params) > 0 {
		copied.Params = make(map[string]any, len(params))
		for k, v := range params {
			copied.Params[k] = v
		}
	}
	return &copied
}

// WithErrors returns a copy of the error with field-level validation errors attached.
// The slice is deep-copied to prevent shared mutation.
func (e *AppError) WithErrors(errs []FieldError) *AppError {
	copied := *e
	if len(errs) > 0 {
		copied.Errors = make([]FieldError, len(errs))
		copy(copied.Errors, errs)
	}
	return &copied
}

// WithExtensions returns a copy of the error with MMP extension metadata
// attached. Extensions surface under the "extensions" field in the Problem
// Details response body, enabling caller-specific metadata such as
// {"current_version": 42} on optimistic-lock conflicts. The map is deep-copied
// to prevent shared mutation across goroutines.
func (e *AppError) WithExtensions(ext map[string]any) *AppError {
	copied := *e
	if len(ext) > 0 {
		copied.Extensions = make(map[string]any, len(ext))
		for k, v := range ext {
			copied.Extensions[k] = v
		}
	}
	return &copied
}
