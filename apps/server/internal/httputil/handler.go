package httputil

import (
	"net/http"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/rs/zerolog"
)

// HandlerFunc is an HTTP handler that returns an error.
// If the returned error is non-nil, apperror.WriteError converts it
// to an RFC 9457 Problem Details JSON response automatically.
type HandlerFunc func(w http.ResponseWriter, r *http.Request) error

// WrapHandler converts a HandlerFunc into a standard http.HandlerFunc.
// When the handler returns a non-nil error, the error is written as an
// RFC 9457 response via apperror.WriteError. If the handler has already
// written to the response, the error is logged but not written again.
func WrapHandler(h HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sw := &statusWriter{ResponseWriter: w}
		if err := h(sw, r); err != nil {
			if sw.written {
				zerolog.Ctx(r.Context()).Error().Err(err).
					Msg("error after response already written")
				return
			}
			apperror.WriteError(w, r, err)
		}
	}
}

// statusWriter wraps http.ResponseWriter to track whether a response has been written.
type statusWriter struct {
	http.ResponseWriter
	written bool
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.written = true
	sw.ResponseWriter.WriteHeader(code)
}

func (sw *statusWriter) Write(b []byte) (int, error) {
	sw.written = true
	return sw.ResponseWriter.Write(b)
}
