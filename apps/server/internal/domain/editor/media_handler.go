package editor

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// MediaHandler handles editor media HTTP endpoints (audio uploads + YouTube embeds).
type MediaHandler struct {
	svc MediaService
}

// NewMediaHandler creates a new editor media handler.
func NewMediaHandler(svc MediaService) *MediaHandler {
	return &MediaHandler{svc: svc}
}

// ListMedia handles GET /editor/themes/{id}/media?type=BGM.
func (h *MediaHandler) ListMedia(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	mediaType := r.URL.Query().Get("type")
	var categoryID *uuid.UUID
	if rawCategoryID := r.URL.Query().Get("category_id"); rawCategoryID != "" {
		parsed, parseErr := uuid.Parse(rawCategoryID)
		if parseErr != nil {
			apperror.WriteError(w, r, apperror.BadRequest("invalid category_id"))
			return
		}
		categoryID = &parsed
	}

	resp, err := h.svc.ListMedia(r.Context(), creatorID, themeID, mediaType, categoryID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// ListCategories handles GET /editor/themes/{id}/media/categories.
func (h *MediaHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.ListCategories(r.Context(), creatorID, themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// CreateCategory handles POST /editor/themes/{id}/media/categories.
func (h *MediaHandler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req MediaCategoryRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.CreateCategory(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// UpdateCategory handles PATCH /editor/media/categories/{id}.
func (h *MediaHandler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	categoryID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req MediaCategoryRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.UpdateCategory(r.Context(), creatorID, categoryID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// DeleteCategory handles DELETE /editor/media/categories/{id}.
func (h *MediaHandler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	categoryID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	if err := h.svc.DeleteCategory(r.Context(), creatorID, categoryID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// RequestUpload handles POST /editor/themes/{id}/media/upload-url.
func (h *MediaHandler) RequestUpload(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	var req RequestMediaUploadRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.RequestUpload(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// ConfirmUpload handles POST /editor/themes/{id}/media/confirm.
func (h *MediaHandler) ConfirmUpload(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	var req ConfirmUploadRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.ConfirmUpload(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// CreateYouTube handles POST /editor/themes/{id}/media/youtube.
func (h *MediaHandler) CreateYouTube(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	var req CreateMediaYouTubeRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.CreateYouTube(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// UpdateMedia handles PATCH /editor/media/{id}.
func (h *MediaHandler) UpdateMedia(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	mediaID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	var req UpdateMediaRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.UpdateMedia(r.Context(), creatorID, mediaID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// DeleteMedia handles DELETE /editor/media/{id}.
func (h *MediaHandler) DeleteMedia(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	mediaID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	if err := h.svc.DeleteMedia(r.Context(), creatorID, mediaID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PreviewDeleteMedia handles GET /editor/media/{id}/references.
func (h *MediaHandler) PreviewDeleteMedia(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	mediaID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.PreviewDeleteMedia(r.Context(), creatorID, mediaID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// RequestReplacementUpload handles POST /editor/media/{id}/replace-upload-url.
func (h *MediaHandler) RequestReplacementUpload(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	mediaID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req RequestMediaReplacementUploadRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.RequestReplacementUpload(r.Context(), creatorID, mediaID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// ConfirmReplacementUpload handles POST /editor/media/{id}/replace-confirm.
func (h *MediaHandler) ConfirmReplacementUpload(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	mediaID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req ConfirmUploadRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.ConfirmReplacementUpload(r.Context(), creatorID, mediaID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// GetDownloadURL handles GET /editor/media/{id}/download-url.
func (h *MediaHandler) GetDownloadURL(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	mediaID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.GetEditorMediaDownloadURL(r.Context(), creatorID, mediaID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}
