package health

import (
	"encoding/json"
	"net/http"
)

// response is the JSON payload for health check endpoints.
type response struct {
	Status string `json:"status"`
}

// Handler provides HTTP handlers for health and readiness checks.
type Handler struct{}

// NewHandler creates a new health Handler.
func NewHandler() *Handler {
	return &Handler{}
}

// Health returns 200 OK if the server is alive.
// GET /health
func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(response{Status: "ok"})
}

// Ready returns 200 OK if the server is ready to accept traffic.
// This endpoint can be extended to check database and Redis connectivity.
// GET /ready
func (h *Handler) Ready(w http.ResponseWriter, _ *http.Request) {
	// TODO(phase-2): check DB and Redis connectivity
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(response{Status: "ready"})
}
