package profile

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// Handler handles profile HTTP endpoints.
type Handler struct {
	svc Service
}

// NewHandler creates a new profile handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// GetProfile handles GET /profile (authenticated).
func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	resp, err := h.svc.GetProfile(r.Context(), userID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// UpdateProfile handles PUT /profile (authenticated).
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req UpdateProfileRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.UpdateProfile(r.Context(), userID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// GetPublicProfile handles GET /users/{id} (public).
func (h *Handler) GetPublicProfile(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid user ID"))
		return
	}

	resp, err := h.svc.GetPublicProfile(r.Context(), userID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}
