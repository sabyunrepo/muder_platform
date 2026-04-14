package editor

import (
	"encoding/json"
	"net/http"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// GetClueRelations handles GET /editor/themes/{id}/clue-relations.
func (h *Handler) GetClueRelations(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	relations, err := h.svc.GetClueRelations(r.Context(), creatorID, themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, relations)
}

// ReplaceClueRelations handles PUT /editor/themes/{id}/clue-relations.
func (h *Handler) ReplaceClueRelations(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB cap
	var reqs []ClueRelationRequest
	if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid JSON: "+err.Error()))
		return
	}

	relations, err := h.svc.ReplaceClueRelations(r.Context(), creatorID, themeID, reqs)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, relations)
}
