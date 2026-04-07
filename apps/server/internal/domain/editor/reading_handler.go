package editor

import (
	"net/http"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// ReadingHandler exposes editor reading-section endpoints.
type ReadingHandler struct {
	svc ReadingService
}

// NewReadingHandler constructs a ReadingHandler.
func NewReadingHandler(svc ReadingService) *ReadingHandler {
	return &ReadingHandler{svc: svc}
}

// ListReadingSections handles GET /editor/themes/{id}/reading-sections.
func (h *ReadingHandler) ListReadingSections(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.List(r.Context(), creatorID, themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// CreateReadingSection handles POST /editor/themes/{id}/reading-sections.
func (h *ReadingHandler) CreateReadingSection(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	var req CreateReadingSectionRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.Create(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// UpdateReadingSection handles PATCH /editor/reading-sections/{id}.
func (h *ReadingHandler) UpdateReadingSection(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	sectionID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	var req UpdateReadingSectionRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.Update(r.Context(), creatorID, sectionID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// DeleteReadingSection handles DELETE /editor/reading-sections/{id}.
func (h *ReadingHandler) DeleteReadingSection(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	sectionID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	if err := h.svc.Delete(r.Context(), creatorID, sectionID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
