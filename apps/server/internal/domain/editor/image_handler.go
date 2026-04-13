package editor

import (
	"net/http"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// ImageHandler handles image upload HTTP endpoints for character avatars and
// clue images.
type ImageHandler struct {
	svc *ImageService
}

// NewImageHandler creates a new ImageHandler.
func NewImageHandler(svc *ImageService) *ImageHandler {
	return &ImageHandler{svc: svc}
}

// RequestUpload handles POST /editor/themes/{id}/images/upload-url.
// Body: { "target": "character"|"clue", "target_id": "uuid", "content_type": "image/png", "file_size": 12345 }
func (h *ImageHandler) RequestUpload(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	var req RequestImageUploadRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.RequestImageUpload(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// ConfirmUpload handles POST /editor/themes/{id}/images/confirm.
// Body: { "upload_key": "themes/xxx/characters/yyy/avatar.png" }
func (h *ImageHandler) ConfirmUpload(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	var req ConfirmImageUploadRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.ConfirmImageUpload(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}
