package apperror

import (
	"encoding/json"
	"errors"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/rs/zerolog"
	"go.opentelemetry.io/otel/trace"
)

// problemResponse is the RFC 9457 Problem Details JSON structure.
type problemResponse struct {
	Type       string         `json:"type"`
	Title      string         `json:"title"`
	Status     int            `json:"status"`
	Detail     string         `json:"detail"`
	Code       string         `json:"code"`
	Instance   string         `json:"instance,omitempty"`
	Params     map[string]any `json:"params,omitempty"`
	Errors     []FieldError   `json:"errors,omitempty"`
	Extensions map[string]any `json:"extensions,omitempty"`
	TraceID    string         `json:"trace_id,omitempty"`
	RequestID  string         `json:"request_id,omitempty"`
	// CorrelationID mirrors request_id for clients and logs that use correlation terminology.
	CorrelationID string     `json:"correlation_id,omitempty"`
	Timestamp     string     `json:"timestamp"`
	Severity      Severity   `json:"severity,omitempty"`
	Retryable     bool       `json:"retryable"`
	UserAction    string     `json:"user_action,omitempty"`
	Debug         *debugInfo `json:"debug,omitempty"`
}

// debugInfo holds development-only diagnostic information.
type debugInfo struct {
	Internal string `json:"internal,omitempty"`
	Stack    string `json:"stack,omitempty"`
}

// devMode controls whether debug information is included in error responses.
// Uses atomic.Bool for concurrent safety (safe to call SetDevMode during tests).
var devMode atomic.Bool

// SetDevMode enables or disables development mode for error responses.
func SetDevMode(dev bool) {
	devMode.Store(dev)
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
		// 5xx: log with internal cause if available
		logEvent := logger.Error().Str("code", appErr.Code)
		if appErr.Internal != nil {
			logEvent = logEvent.Err(appErr.Internal)
		} else {
			logEvent = logEvent.Err(err)
		}
		logEvent.Msg(appErr.Title)
	} else {
		logger.Warn().Str("code", appErr.Code).Msg(appErr.Detail)
	}

	// Capture 5xx errors to Sentry if configured.
	if appErr.Status >= 500 {
		if hub := sentry.GetHubFromContext(r.Context()); hub != nil {
			hub.WithScope(func(scope *sentry.Scope) {
				scope.SetTag("error.code", appErr.Code)
				if appErr.Internal != nil {
					hub.CaptureException(appErr.Internal)
				} else {
					hub.CaptureException(err)
				}
			})
		}
	}

	typeURI := appErr.Type
	if typeURI == "" {
		typeURI = "about:blank"
	}

	defn := definitionForResponse(appErr)
	requestID := requestIDFrom(w, r)
	resp := problemResponse{
		Type:          typeURI,
		Title:         appErr.Title,
		Status:        appErr.Status,
		Detail:        appErr.Detail,
		Code:          appErr.Code,
		Instance:      appErr.Instance,
		Params:        appErr.Params,
		Errors:        appErr.Errors,
		Extensions:    appErr.Extensions,
		RequestID:     requestID,
		CorrelationID: requestID,
		Timestamp:     time.Now().UTC().Format(time.RFC3339Nano),
		Severity:      defn.Severity,
		Retryable:     defn.Retryable,
		UserAction:    defn.UserAction,
	}

	// Include trace_id in error response if OTel is active.
	span := trace.SpanFromContext(r.Context())
	if sc := span.SpanContext(); sc.IsValid() {
		resp.TraceID = sc.TraceID().String()
	}

	// Mask 5xx details in production to prevent internal info leakage.
	isDev := devMode.Load()
	if !isDev && resp.Status >= 500 {
		resp.Detail = "an unexpected error occurred"
	}

	// Include debug info only in development mode.
	if isDev && appErr.Internal != nil {
		resp.Debug = &debugInfo{
			Internal: appErr.Internal.Error(),
		}
	}

	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(appErr.Status)

	if encErr := json.NewEncoder(w).Encode(resp); encErr != nil {
		logger.Error().Err(encErr).Msg("failed to encode error response")
	}
}

func requestIDFrom(w http.ResponseWriter, r *http.Request) string {
	if id := w.Header().Get("X-Request-ID"); id != "" {
		return id
	}
	return r.Header.Get("X-Request-ID")
}
