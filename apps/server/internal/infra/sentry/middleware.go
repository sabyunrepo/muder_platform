package sentry

import (
	"net/http"

	"github.com/getsentry/sentry-go"
)

// Middleware creates a Sentry hub for each request and recovers panics.
// Use after middleware.RequestID so the hub has request context.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hub := sentry.GetHubFromContext(r.Context())
		if hub == nil {
			hub = sentry.CurrentHub().Clone()
		}
		hub.Scope().SetRequest(r)
		ctx := sentry.SetHubOnContext(r.Context(), hub)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
