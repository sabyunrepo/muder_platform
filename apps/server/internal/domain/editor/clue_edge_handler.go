package editor

import (
	"encoding/json"
	"net/http"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/auditlog"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// GetClueEdges handles GET /editor/themes/{id}/clue-edges.
func (h *Handler) GetClueEdges(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	edges, err := h.svc.GetClueEdges(r.Context(), creatorID, themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, edges)
}

// ReplaceClueEdges handles PUT /editor/themes/{id}/clue-edges.
func (h *Handler) ReplaceClueEdges(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB cap
	var reqs []ClueEdgeGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid JSON: "+err.Error()))
		return
	}

	edges, err := h.svc.ReplaceClueEdges(r.Context(), creatorID, themeID, reqs)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	// D-SEC-1 audit: record which creator rewrote which theme's clue graph
	// and how many edge groups were persisted (not the payload itself — the
	// graph snapshot lives in theme versioning).
	h.recordAudit(r.Context(), auditlog.ActionEditorClueEdgesReplace, creatorID,
		map[string]any{
			"theme_id":     themeID.String(),
			"group_count":  len(reqs),
			"result_count": len(edges),
		})
	httputil.WriteJSON(w, http.StatusOK, edges)
}
