package middleware

import (
	"net/http"
	"strings"

	"github.com/go-chi/cors"
)

// CORS returns a configured CORS middleware.
// In development mode it allows all origins (without credentials);
// in production it restricts to the comma-separated allowed origins
// and enables credentials.
func CORS(isDev bool, originsCSV string) func(http.Handler) http.Handler {
	opts := cors.Options{
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowedHeaders: []string{
			"Accept",
			"Authorization",
			"Content-Type",
			"X-Request-ID",
		},
		ExposedHeaders: []string{"X-Request-ID"},
		MaxAge:         300,
	}

	if isDev {
		opts.AllowedOrigins = []string{"*"}
		opts.AllowCredentials = false
	} else {
		origins := parseOrigins(originsCSV)
		opts.AllowedOrigins = origins
		opts.AllowCredentials = true
	}

	return cors.Handler(opts)
}

// parseOrigins splits a comma-separated origin string into a trimmed slice,
// filtering out empty entries.
func parseOrigins(csv string) []string {
	var origins []string
	for _, o := range strings.Split(csv, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}
