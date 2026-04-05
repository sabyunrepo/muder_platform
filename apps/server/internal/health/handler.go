package health

import (
	"context"
	"encoding/json"
	"net/http"
)

// CheckFunc is a health check function. Returns nil if healthy.
type CheckFunc func(ctx context.Context) error

// response is the JSON payload for health check endpoints.
type response struct {
	Status string `json:"status"`
}

// Handler provides HTTP handlers for health and readiness checks.
type Handler struct {
	checkers []CheckFunc
}

// NewHandler creates a health Handler with optional check functions.
func NewHandler(checkers ...CheckFunc) *Handler {
	return &Handler{checkers: checkers}
}

// Health returns 200 OK if the server is alive (liveness probe).
// GET /health
func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(response{Status: "ok"})
}

// Ready returns 200 OK if all check functions pass (readiness probe).
// GET /ready
func (h *Handler) Ready(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	for _, check := range h.checkers {
		if err := check(r.Context()); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(response{Status: "unavailable"})
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(response{Status: "ready"})
}
