package theme

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
)

// Handler handles theme HTTP endpoints.
type Handler struct {
	svc Service
}

// NewHandler creates a new theme handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// ListPublished handles GET /themes.
func (h *Handler) ListPublished(w http.ResponseWriter, r *http.Request) {
	pg := httputil.ParsePagination(r, 20, 50)

	themes, err := h.svc.ListPublished(r.Context(), pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, themes)
}

// GetTheme handles GET /themes/{id}.
func (h *Handler) GetTheme(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	themeID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid theme ID"))
		return
	}

	resp, err := h.svc.GetTheme(r.Context(), themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// GetThemeBySlug handles GET /themes/slug/{slug}.
func (h *Handler) GetThemeBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		apperror.WriteError(w, r, apperror.BadRequest("slug is required"))
		return
	}

	resp, err := h.svc.GetThemeBySlug(r.Context(), slug)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// GetCharacters handles GET /themes/{id}/characters.
func (h *Handler) GetCharacters(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	themeID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid theme ID"))
		return
	}

	chars, err := h.svc.GetCharacters(r.Context(), themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, chars)
}
