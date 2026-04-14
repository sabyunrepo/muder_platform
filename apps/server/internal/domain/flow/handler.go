package flow

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// Handler handles flow HTTP endpoints.
type Handler struct {
	svc Service
}

// NewHandler creates a new flow handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// GetFlow handles GET /editor/themes/{id}/flow.
func (h *Handler) GetFlow(w http.ResponseWriter, r *http.Request) {
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	graph, err := h.svc.GetFlow(r.Context(), themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, graph)
}

// SaveFlow handles PUT /editor/themes/{id}/flow.
func (h *Handler) SaveFlow(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req SaveFlowRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	graph, err := h.svc.SaveFlow(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, graph)
}

// CreateNode handles POST /editor/themes/{id}/flow/nodes.
func (h *Handler) CreateNode(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req CreateNodeRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	node, err := h.svc.CreateNode(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, node)
}

// UpdateNode handles PATCH /editor/themes/{id}/flow/nodes/{nodeId}.
func (h *Handler) UpdateNode(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	nodeID, err := parseUUID(r, "nodeId")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req UpdateNodeRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	node, err := h.svc.UpdateNode(r.Context(), creatorID, nodeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, node)
}

// DeleteNode handles DELETE /editor/themes/{id}/flow/nodes/{nodeId}.
func (h *Handler) DeleteNode(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	nodeID, err := parseUUID(r, "nodeId")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	if err := h.svc.DeleteNode(r.Context(), creatorID, nodeID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// CreateEdge handles POST /editor/themes/{id}/flow/edges.
func (h *Handler) CreateEdge(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req CreateEdgeRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	edge, err := h.svc.CreateEdge(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, edge)
}

// UpdateEdge handles PATCH /editor/themes/{id}/flow/edges/{edgeId}.
func (h *Handler) UpdateEdge(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	edgeID, err := parseUUID(r, "edgeId")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req UpdateEdgeRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	edge, err := h.svc.UpdateEdge(r.Context(), creatorID, edgeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, edge)
}

// DeleteEdge handles DELETE /editor/themes/{id}/flow/edges/{edgeId}.
func (h *Handler) DeleteEdge(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	edgeID, err := parseUUID(r, "edgeId")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	if err := h.svc.DeleteEdge(r.Context(), creatorID, edgeID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// MigrateFlow handles POST /editor/themes/{id}/flow/migrate.
func (h *Handler) MigrateFlow(w http.ResponseWriter, r *http.Request) {
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req MigrateFlowRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	if err := h.svc.MigratePhases(r.Context(), themeID, req.Phases); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// parseUUID extracts and parses a UUID from a chi URL parameter.
func parseUUID(r *http.Request, param string) (uuid.UUID, error) {
	s := chi.URLParam(r, param)
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, apperror.BadRequest("invalid " + param + " format")
	}
	return id, nil
}
