package voice

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// Handler handles voice HTTP endpoints.
type Handler struct {
	svc Service
}

// NewHandler creates a new voice handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// GetToken handles POST /api/v1/voice/token.
// It issues a LiveKit JWT for the authenticated user to join a voice room.
func (h *Handler) GetToken(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req TokenRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.GetToken(r.Context(), userID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}
