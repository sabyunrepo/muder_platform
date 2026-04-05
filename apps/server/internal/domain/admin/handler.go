package admin

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
)

// Handler handles admin HTTP endpoints.
type Handler struct {
	svc Service
}

// NewHandler creates a new admin handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// ListUsers handles GET /admin/users.
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	pg := httputil.ParsePagination(r, 20, 100)

	users, err := h.svc.ListUsers(r.Context(), pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, users)
}

// GetUser handles GET /admin/users/{id}.
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid user ID"))
		return
	}

	user, err := h.svc.GetUser(r.Context(), userID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, user)
}

// UpdateUserRole handles PUT /admin/users/{id}/role.
func (h *Handler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid user ID"))
		return
	}

	var req UpdateRoleRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	user, err := h.svc.UpdateUserRole(r.Context(), userID, req.Role)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, user)
}

// ListAllThemes handles GET /admin/themes.
func (h *Handler) ListAllThemes(w http.ResponseWriter, r *http.Request) {
	pg := httputil.ParsePagination(r, 20, 100)

	themes, err := h.svc.ListAllThemes(r.Context(), pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, themes)
}

// ForceUnpublishTheme handles POST /admin/themes/{id}/unpublish.
func (h *Handler) ForceUnpublishTheme(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	themeID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid theme ID"))
		return
	}

	theme, err := h.svc.ForceUnpublishTheme(r.Context(), themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, theme)
}

// ListAllRooms handles GET /admin/rooms.
func (h *Handler) ListAllRooms(w http.ResponseWriter, r *http.Request) {
	pg := httputil.ParsePagination(r, 20, 100)

	rooms, err := h.svc.ListAllRooms(r.Context(), pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, rooms)
}

// ForceCloseRoom handles POST /admin/rooms/{id}/close.
func (h *Handler) ForceCloseRoom(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	roomID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	if err := h.svc.ForceCloseRoom(r.Context(), roomID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
