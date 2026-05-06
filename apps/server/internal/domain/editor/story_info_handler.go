package editor

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/auditlog"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

type StoryInfoHandler struct {
	svc    StoryInfoService
	audit  auditlog.Logger
	logger zerolog.Logger
}

func NewStoryInfoHandler(svc StoryInfoService, audit auditlog.Logger, logger zerolog.Logger) *StoryInfoHandler {
	if audit == nil {
		audit = auditlog.NoOpLogger{}
	}
	return &StoryInfoHandler{
		svc:    svc,
		audit:  audit,
		logger: logger.With().Str("handler", "editor.story_info").Logger(),
	}
}

func (h *StoryInfoHandler) recordAudit(ctx context.Context, action auditlog.AuditAction, actor uuid.UUID, payload map[string]any) {
	if actor == uuid.Nil {
		return
	}
	var raw json.RawMessage
	if len(payload) > 0 {
		b, err := json.Marshal(payload)
		if err != nil {
			h.logger.Warn().Err(err).Str("action", string(action)).Msg("auditlog payload marshal failed")
			return
		}
		raw = b
	}
	uid := actor
	evt := auditlog.AuditEvent{
		ActorID: &uid,
		UserID:  &uid,
		Action:  action,
		Payload: raw,
	}
	if err := h.audit.Append(ctx, evt); err != nil {
		h.logger.Warn().Err(err).Str("action", string(action)).Msg("auditlog append failed")
	}
}

func (h *StoryInfoHandler) ListStoryInfos(w http.ResponseWriter, r *http.Request) {
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

func (h *StoryInfoHandler) CreateStoryInfo(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	themeID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req CreateStoryInfoRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.Create(r.Context(), creatorID, themeID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	h.recordAudit(r.Context(), auditlog.ActionEditorStoryInfoCreate, creatorID, map[string]any{
		"theme_id":      themeID.String(),
		"story_info_id": resp.ID.String(),
	})
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

func (h *StoryInfoHandler) UpdateStoryInfo(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	infoID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	var req UpdateStoryInfoRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	resp, err := h.svc.Update(r.Context(), creatorID, infoID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	h.recordAudit(r.Context(), auditlog.ActionEditorStoryInfoUpdate, creatorID, map[string]any{
		"theme_id":      resp.ThemeID.String(),
		"story_info_id": resp.ID.String(),
	})
	httputil.WriteJSON(w, http.StatusOK, resp)
}

func (h *StoryInfoHandler) DeleteStoryInfo(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	infoID, err := parseUUID(r, "id")
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	themeID, err := h.svc.Delete(r.Context(), creatorID, infoID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	h.recordAudit(r.Context(), auditlog.ActionEditorStoryInfoDelete, creatorID, map[string]any{
		"theme_id":      themeID.String(),
		"story_info_id": infoID.String(),
	})
	w.WriteHeader(http.StatusNoContent)
}
