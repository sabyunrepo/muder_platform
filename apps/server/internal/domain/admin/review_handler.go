package admin

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// ReviewHandler handles admin theme review endpoints.
type ReviewHandler struct {
	q      *db.Queries
	logger zerolog.Logger
}

// NewReviewHandler creates a new ReviewHandler.
func NewReviewHandler(q *db.Queries, logger zerolog.Logger) *ReviewHandler {
	return &ReviewHandler{
		q:      q,
		logger: logger.With().Str("handler", "admin.review").Logger(),
	}
}

// ReviewActionRequest is the request body for approve/reject/suspend actions.
type ReviewActionRequest struct {
	Note string `json:"note"`
}

// SetTrustedCreatorRequest is the request body for setting trusted creator status.
type SetTrustedCreatorRequest struct {
	Trusted bool `json:"trusted"`
}

// ListPendingReviews handles GET /admin/reviews.
func (h *ReviewHandler) ListPendingReviews(w http.ResponseWriter, r *http.Request) {
	themes, err := h.q.ListPendingReviewThemes(r.Context())
	if err != nil {
		h.logger.Error().Err(err).Msg("failed to list pending review themes")
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, themes)
}

// ApproveTheme handles POST /admin/reviews/{id}/approve.
func (h *ReviewHandler) ApproveTheme(w http.ResponseWriter, r *http.Request) {
	themeID, err := parseThemeID(r)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	adminID := middleware.UserIDFrom(r.Context())

	var req ReviewActionRequest
	// Note is optional for approval; ignore body parse error
	_ = httputil.ReadJSON(r, &req)

	theme, err := h.q.ApproveTheme(r.Context(), db.ApproveThemeParams{
		ID:         themeID,
		ReviewedBy: pgtype.UUID{Bytes: adminID, Valid: true},
		ReviewNote: toPgtypeText(req.Note),
	})
	if err != nil {
		h.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to approve theme")
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, theme)
}

// RejectTheme handles POST /admin/reviews/{id}/reject.
func (h *ReviewHandler) RejectTheme(w http.ResponseWriter, r *http.Request) {
	themeID, err := parseThemeID(r)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	adminID := middleware.UserIDFrom(r.Context())

	var req ReviewActionRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	if req.Note == "" {
		apperror.WriteError(w, r, apperror.BadRequest("review note is required for rejection"))
		return
	}

	theme, err := h.q.RejectTheme(r.Context(), db.RejectThemeParams{
		ID:         themeID,
		ReviewedBy: pgtype.UUID{Bytes: adminID, Valid: true},
		ReviewNote: pgtype.Text{String: req.Note, Valid: true},
	})
	if err != nil {
		h.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to reject theme")
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, theme)
}

// SuspendTheme handles POST /admin/reviews/{id}/suspend.
func (h *ReviewHandler) SuspendTheme(w http.ResponseWriter, r *http.Request) {
	themeID, err := parseThemeID(r)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	adminID := middleware.UserIDFrom(r.Context())

	var req ReviewActionRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	if req.Note == "" {
		apperror.WriteError(w, r, apperror.BadRequest("review note is required for suspension"))
		return
	}

	theme, err := h.q.SuspendTheme(r.Context(), db.SuspendThemeParams{
		ID:         themeID,
		ReviewedBy: pgtype.UUID{Bytes: adminID, Valid: true},
		ReviewNote: pgtype.Text{String: req.Note, Valid: true},
	})
	if err != nil {
		h.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to suspend theme")
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, theme)
}

// SetTrustedCreator handles PUT /admin/users/{id}/trusted-creator.
func (h *ReviewHandler) SetTrustedCreator(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid user ID"))
		return
	}

	var req SetTrustedCreatorRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	if err := h.q.SetUserTrustedCreator(r.Context(), db.SetUserTrustedCreatorParams{
		ID:             userID,
		TrustedCreator: req.Trusted,
	}); err != nil {
		h.logger.Error().Err(err).Str("user_id", userID.String()).Msg("failed to set trusted creator")
		apperror.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// parseThemeID extracts and parses the {id} URL parameter as a UUID.
func parseThemeID(r *http.Request) (uuid.UUID, error) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return uuid.UUID{}, apperror.BadRequest("invalid theme ID")
	}
	return id, nil
}

// toPgtypeText converts a string to pgtype.Text, treating empty string as invalid (NULL).
func toPgtypeText(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: s, Valid: true}
}
