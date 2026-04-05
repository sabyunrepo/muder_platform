package editor

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// Handler handles editor HTTP endpoints for theme creators.
type Handler struct {
	svc Service
}

// NewHandler creates a new editor handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// ListMyThemes handles GET /editor/themes.
func (h *Handler) ListMyThemes(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())

	themes, err := h.svc.ListMyThemes(r.Context(), creatorID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, themes)
}

// CreateTheme handles POST /editor/themes.
func (h *Handler) CreateTheme(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())

	var req CreateThemeRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.CreateTheme(r.Context(), creatorID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// UpdateTheme handles PUT /editor/themes/{id}.
func (h *Handler) UpdateTheme(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	var req UpdateThemeRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.UpdateTheme(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// DeleteTheme handles DELETE /editor/themes/{id}.
func (h *Handler) DeleteTheme(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	if err := h.svc.DeleteTheme(r.Context(), creatorID, themeID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PublishTheme handles POST /editor/themes/{id}/publish.
func (h *Handler) PublishTheme(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.PublishTheme(r.Context(), creatorID, themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// UnpublishTheme handles POST /editor/themes/{id}/unpublish.
func (h *Handler) UnpublishTheme(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.UnpublishTheme(r.Context(), creatorID, themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// CreateCharacter handles POST /editor/themes/{id}/characters.
func (h *Handler) CreateCharacter(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	var req CreateCharacterRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.CreateCharacter(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// UpdateCharacter handles PUT /editor/characters/{id}.
func (h *Handler) UpdateCharacter(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	charID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	var req UpdateCharacterRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.UpdateCharacter(r.Context(), creatorID, charID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// DeleteCharacter handles DELETE /editor/characters/{id}.
func (h *Handler) DeleteCharacter(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	charID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	if err := h.svc.DeleteCharacter(r.Context(), creatorID, charID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UpdateConfigJson handles PUT /editor/themes/{id}/config.
func (h *Handler) UpdateConfigJson(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1 MB limit
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("failed to read request body"))
		return
	}
	if !json.Valid(body) {
		apperror.WriteError(w, r, apperror.BadRequest("request body must be valid JSON"))
		return
	}

	resp, err := h.svc.UpdateConfigJson(r.Context(), creatorID, themeID, json.RawMessage(body))
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
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
