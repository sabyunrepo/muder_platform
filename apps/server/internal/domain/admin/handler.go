package admin

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/auditlog"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// Handler handles admin HTTP endpoints.
//
// Phase 19 PR-6: writes to auditlog.Logger on mutating endpoints
// (role change, theme force-unpublish, room force-close) so that each
// moderator action leaves an identity-bound audit trail attributable
// to the admin's user_id (actor) and the affected user/theme/room.
type Handler struct {
	svc    Service
	audit  auditlog.Logger
	logger zerolog.Logger
}

// NewHandler creates a new admin handler. If audit is nil the handler
// silently substitutes auditlog.NoOpLogger{} so tests without a DB can
// still exercise the HTTP path.
func NewHandler(svc Service, audit auditlog.Logger, logger zerolog.Logger) *Handler {
	if audit == nil {
		audit = auditlog.NoOpLogger{}
	}
	return &Handler{
		svc:    svc,
		audit:  audit,
		logger: logger.With().Str("handler", "admin").Logger(),
	}
}

// recordAudit appends an admin audit entry. actor is the moderator; target
// (optional) is the affected user UUID. payload is marshalled to JSON and
// kept small — only the fields a reviewer genuinely needs later.
func (h *Handler) recordAudit(ctx context.Context, action auditlog.AuditAction, actor, target *uuid.UUID, payload map[string]any) {
	var raw json.RawMessage
	if len(payload) > 0 {
		if b, err := json.Marshal(payload); err == nil {
			raw = b
		} else {
			h.logger.Warn().Err(err).Str("action", string(action)).Msg("auditlog payload marshal failed")
		}
	}
	// If no explicit target is provided, pin UserID to the actor so the row
	// satisfies the identity CHECK (session_id IS NOT NULL OR user_id IS NOT
	// NULL). Mirrors the same fallback in review_handler.go.
	effectiveTarget := target
	if effectiveTarget == nil && actor != nil {
		effectiveTarget = actor
	}
	evt := auditlog.AuditEvent{
		ActorID: actor,
		UserID:  effectiveTarget,
		Action:  action,
		Payload: raw,
	}
	if err := h.audit.Append(ctx, evt); err != nil {
		h.logger.Warn().Err(err).Str("action", string(action)).Msg("auditlog append failed")
	}
}

// actor extracts the moderator's user id from the request context.
// Returns nil when the context lacks an auth UUID — the audit entry then
// records a system-level actor (admin routes are middleware-guarded, so
// this should not occur in production, but the fallback avoids panics in
// unit tests that skip the middleware).
func actor(ctx context.Context) *uuid.UUID {
	uid := middleware.UserIDFrom(ctx)
	if uid == uuid.Nil {
		return nil
	}
	return &uid
}

// ListUsers handles GET /admin/users.
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	pg := httputil.ParsePagination(r, 20, 100)

	users, err := h.svc.ListUsers(r.Context(), pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, users)
}

// GetUser handles GET /admin/users/{id}.
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid user ID"))
		return
	}

	user, err := h.svc.GetUser(r.Context(), userID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, user)
}

// UpdateUserRole handles PUT /admin/users/{id}/role.
func (h *Handler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid user ID"))
		return
	}

	var req UpdateRoleRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	user, err := h.svc.UpdateUserRole(r.Context(), userID, req.Role)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	h.recordAudit(r.Context(), auditlog.ActionAdminRoleChange, actor(r.Context()), &userID,
		map[string]any{"new_role": req.Role})
	httputil.WriteJSON(w, http.StatusOK, user)
}

// ListAllThemes handles GET /admin/themes.
func (h *Handler) ListAllThemes(w http.ResponseWriter, r *http.Request) {
	pg := httputil.ParsePagination(r, 20, 100)

	themes, err := h.svc.ListAllThemes(r.Context(), pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, themes)
}

// ForceUnpublishTheme handles POST /admin/themes/{id}/unpublish.
func (h *Handler) ForceUnpublishTheme(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	themeID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid theme ID"))
		return
	}

	theme, err := h.svc.ForceUnpublishTheme(r.Context(), themeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	h.recordAudit(r.Context(), auditlog.ActionAdminForceUnpublishTheme, actor(r.Context()), nil,
		map[string]any{"theme_id": themeID.String()})
	httputil.WriteJSON(w, http.StatusOK, theme)
}

// ListAllRooms handles GET /admin/rooms.
func (h *Handler) ListAllRooms(w http.ResponseWriter, r *http.Request) {
	pg := httputil.ParsePagination(r, 20, 100)

	rooms, err := h.svc.ListAllRooms(r.Context(), pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, rooms)
}

// ForceCloseRoom handles POST /admin/rooms/{id}/close.
func (h *Handler) ForceCloseRoom(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	roomID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	if err := h.svc.ForceCloseRoom(r.Context(), roomID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	h.recordAudit(r.Context(), auditlog.ActionAdminForceCloseRoom, actor(r.Context()), nil,
		map[string]any{"room_id": roomID.String()})
	w.WriteHeader(http.StatusNoContent)
}
