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

// GetTheme handles GET /editor/themes/{id}.
func (h *Handler) GetTheme(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.GetTheme(r.Context(), creatorID, themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
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

// ListCharacters handles GET /editor/themes/{id}/characters.
func (h *Handler) ListCharacters(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	chars, err := h.svc.ListCharacters(r.Context(), creatorID, themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, chars)
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

// ListMaps handles GET /editor/themes/{id}/maps.
func (h *Handler) ListMaps(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	maps, err := h.svc.ListMaps(r.Context(), creatorID, themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, maps)
}

// CreateMap handles POST /editor/themes/{id}/maps.
func (h *Handler) CreateMap(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req CreateMapRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.CreateMap(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// UpdateMap handles PUT /editor/maps/{id}.
func (h *Handler) UpdateMap(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	mapID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req UpdateMapRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.UpdateMap(r.Context(), creatorID, mapID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// DeleteMap handles DELETE /editor/maps/{id}.
func (h *Handler) DeleteMap(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	mapID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	if err := h.svc.DeleteMap(r.Context(), creatorID, mapID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListLocations handles GET /editor/themes/{id}/locations.
func (h *Handler) ListLocations(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	locs, err := h.svc.ListLocations(r.Context(), creatorID, themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, locs)
}

// CreateLocation handles POST /editor/themes/{id}/maps/{mapId}/locations.
func (h *Handler) CreateLocation(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	mapID, err := parseUUID(r, "mapId")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req CreateLocationRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.CreateLocation(r.Context(), creatorID, themeID, mapID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// UpdateLocation handles PUT /editor/locations/{id}.
func (h *Handler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	locID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req UpdateLocationRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.UpdateLocation(r.Context(), creatorID, locID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// DeleteLocation handles DELETE /editor/locations/{id}.
func (h *Handler) DeleteLocation(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	locID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	if err := h.svc.DeleteLocation(r.Context(), creatorID, locID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListClues handles GET /editor/themes/{id}/clues.
func (h *Handler) ListClues(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	clues, err := h.svc.ListClues(r.Context(), creatorID, themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, clues)
}

// CreateClue handles POST /editor/themes/{id}/clues.
func (h *Handler) CreateClue(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req CreateClueRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.CreateClue(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// UpdateClue handles PUT /editor/clues/{id}.
func (h *Handler) UpdateClue(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	clueID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req UpdateClueRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.UpdateClue(r.Context(), creatorID, clueID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// DeleteClue handles DELETE /editor/clues/{id}.
func (h *Handler) DeleteClue(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	clueID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	if err := h.svc.DeleteClue(r.Context(), creatorID, clueID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetContent handles GET /editor/themes/{id}/content/{key}.
func (h *Handler) GetContent(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	key := chi.URLParam(r, "key")
	if !validContentKeyRe.MatchString(key) {
		apperror.WriteError(w, r, apperror.BadRequest("invalid content key format"))
		return
	}
	resp, err := h.svc.GetContent(r.Context(), creatorID, themeID, key)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// UpsertContent handles PUT /editor/themes/{id}/content/{key}.
func (h *Handler) UpsertContent(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	key := chi.URLParam(r, "key")
	if !validContentKeyRe.MatchString(key) {
		apperror.WriteError(w, r, apperror.BadRequest("invalid content key format"))
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<17) // 128KB limit
	var req UpsertContentRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.UpsertContent(r.Context(), creatorID, themeID, key, req.Body)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// ValidateTheme handles POST /editor/themes/{id}/validate.
func (h *Handler) ValidateTheme(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.ValidateTheme(r.Context(), creatorID, themeID)
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
