package apperror

import (
	"fmt"
	"net/http"
)

// AppError represents an application error following RFC 9457 Problem Details.
type AppError struct {
	Type     string `json:"type"`
	Code     string `json:"code"`
	Status   int    `json:"status"`
	Title    string `json:"title"`
	Detail   string `json:"detail"`
	Instance string `json:"instance,omitempty"`
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
