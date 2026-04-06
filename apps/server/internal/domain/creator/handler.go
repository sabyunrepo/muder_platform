package creator

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// Handler handles creator HTTP endpoints.
type Handler struct {
	svc CreatorService
}

// NewHandler creates a new creator handler.
func NewHandler(svc CreatorService) *Handler {
	return &Handler{svc: svc}
}

// GetDashboard handles GET /api/v1/creator/dashboard.
func (h *Handler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	if creatorID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	resp, err := h.svc.GetDashboard(r.Context(), creatorID)
	if err != nil {
		apperror.WriteError(w, r, apperror.Internal("failed to get dashboard"))
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// GetThemeStats handles GET /api/v1/creator/themes/{id}/stats.
func (h *Handler) GetThemeStats(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	if creatorID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	themeID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid theme ID"))
		return
	}

	// Parse date range from query params (default: last 30 days).
	now := time.Now()
	from := now.AddDate(0, 0, -30)
	to := now

	if v := r.URL.Query().Get("from"); v != "" {
		parsed, err := time.Parse("2006-01-02", v)
		if err != nil {
			apperror.WriteError(w, r, apperror.BadRequest("invalid from date, expected YYYY-MM-DD"))
			return
		}
		from = parsed
	}
	if v := r.URL.Query().Get("to"); v != "" {
		parsed, err := time.Parse("2006-01-02", v)
		if err != nil {
			apperror.WriteError(w, r, apperror.BadRequest("invalid to date, expected YYYY-MM-DD"))
			return
		}
		// Include the entire end day.
		to = parsed.Add(24*time.Hour - time.Nanosecond)
	}

	resp, err := h.svc.GetThemeStats(r.Context(), creatorID, themeID, from, to)
	if err != nil {
		apperror.WriteError(w, r, apperror.Internal("failed to get theme stats"))
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// ListEarnings handles GET /api/v1/creator/earnings.
func (h *Handler) ListEarnings(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	if creatorID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	pg := httputil.ParsePagination(r, 20, 100)

	earnings, total, err := h.svc.ListEarnings(r.Context(), creatorID, pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, apperror.Internal("failed to list earnings"))
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"earnings": earnings,
		"total":    total,
	})
}

// ListSettlements handles GET /api/v1/creator/settlements.
func (h *Handler) ListSettlements(w http.ResponseWriter, r *http.Request) {
	creatorID := middleware.UserIDFrom(r.Context())
	if creatorID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	pg := httputil.ParsePagination(r, 20, 100)

	settlements, total, err := h.svc.ListSettlements(r.Context(), creatorID, pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, apperror.Internal("failed to list settlements"))
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"settlements": settlements,
		"total":       total,
	})
}
