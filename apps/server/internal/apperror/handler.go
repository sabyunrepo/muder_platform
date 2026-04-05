package apperror

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/rs/zerolog"
)

// problemResponse is the RFC 9457 Problem Details JSON structure.
type problemResponse struct {
	Type     string `json:"type"`
	Title    string `json:"title"`
	Status   int    `json:"status"`
	Detail   string `json:"detail"`
	Code     string `json:"code"`
	Instance string `json:"instance,omitempty"`
}

// WriteError writes an error as an RFC 9457 Problem Details JSON response.
// If the error is an *AppError, its fields are used directly.
// Otherwise, a generic 500 Internal Server Error is returned.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	logger := zerolog.Ctx(r.Context())

	var appErr *AppError
	if !errors.As(err, &appErr) {
		appErr = Internal("an unexpected error occurred")
		logger.Error().Err(err).Msg("unhandled error")
	} else if appErr.Status >= 500 {
		logger.Error().Err(err).Str("code", appErr.Code).Msg(appErr.Title)
	} else {
		logger.Warn().Str("code", appErr.Code).Msg(appErr.Detail)
	}

	typeURI := appErr.Type
	if typeURI == "" {
		typeURI = "about:blank"
	}

	resp := problemResponse{
		Type:     typeURI,
		Title:    appErr.Title,
		Status:   appErr.Status,
		Detail:   appErr.Detail,
		Code:     appErr.Code,
		Instance: appErr.Instance,
	}

	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(appErr.Status)

	if encErr := json.NewEncoder(w).Encode(resp); encErr != nil {
		logger.Error().Err(encErr).Msg("failed to encode error response")
	}
}
