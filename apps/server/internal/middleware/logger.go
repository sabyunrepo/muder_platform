package middleware

import (
	"bufio"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/rs/zerolog"
)

// responseWriter wraps http.ResponseWriter to capture the status code
// and track whether headers have been sent to the client.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    int
	headerSent bool
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
}

func (rw *responseWriter) WriteHeader(code int) {
	if rw.headerSent {
		return
	}
	rw.headerSent = true
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.headerSent {
		rw.headerSent = true
	}
	n, err := rw.ResponseWriter.Write(b)
	rw.written += n
	return n, err
}

// Unwrap returns the underlying http.ResponseWriter, enabling
// middleware that wraps responseWriter to access the original writer.
func (rw *responseWriter) Unwrap() http.ResponseWriter {
	return rw.ResponseWriter
}

// Flush implements http.Flusher, required for SSE streaming.
func (rw *responseWriter) Flush() {
	if f, ok := rw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Hijack implements http.Hijacker, required for WebSocket upgrades.
func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if h, ok := rw.ResponseWriter.(http.Hijacker); ok {
		return h.Hijack()
	}
	return nil, nil, fmt.Errorf("underlying ResponseWriter does not implement http.Hijacker")
}

// Logger is a zerolog HTTP middleware that logs each request with its
// method, path, status, duration, and request ID.
func Logger(logger zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rw := newResponseWriter(w)

			// Inject logger into request context for downstream use.
			ctx := logger.With().
				Str("request_id", GetRequestID(r.Context())).
				Logger().
				WithContext(r.Context())

			next.ServeHTTP(rw, r.WithContext(ctx))

			duration := time.Since(start)

			var event *zerolog.Event
			switch {
			case rw.statusCode >= 500:
				event = logger.Error()
			case rw.statusCode >= 400:
				event = logger.Warn()
			default:
				event = logger.Info()
			}

			event.
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Int("status", rw.statusCode).
				Int("bytes", rw.written).
				Dur("duration", duration).
				Str("request_id", GetRequestID(r.Context())).
				Msg("request completed")
		})
	}
}
