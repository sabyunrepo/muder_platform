package middleware

import (
	"net/http"
	"runtime/debug"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/rs/zerolog"
)

// Recovery is a middleware that recovers from panics, logs the stack trace,
// and returns a 500 Internal Server Error as an RFC 9457 Problem Details response.
// If the response headers have already been sent, writing a new status is
// impossible, so only the connection is closed.
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				logger := zerolog.Ctx(r.Context())
				logger.Error().
					Interface("panic", rec).
					Str("stack", string(debug.Stack())).
					Msg("panic recovered")

				// If headers were already sent, we cannot write a new
				// status code. Close the connection instead.
				if rw, ok := w.(*responseWriter); ok && rw.headerSent {
					if hj, ok2 := rw.ResponseWriter.(http.Hijacker); ok2 {
						conn, _, _ := hj.Hijack()
						if conn != nil {
							_ = conn.Close()
						}
					}
					return
				}

				apperror.WriteError(w, r, apperror.Internal("internal server error"))
			}
		}()

		next.ServeHTTP(w, r)
	})
}
