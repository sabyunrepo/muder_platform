package coin

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// Handler handles coin-related HTTP endpoints.
type Handler struct {
	svc CoinService
}

// NewHandler creates a new coin handler.
func NewHandler(svc CoinService) *Handler {
	return &Handler{svc: svc}
}

// GetBalance handles GET /api/v1/coins/balance.
func (h *Handler) GetBalance(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	resp, err := h.svc.GetBalance(r.Context(), userID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// ListTransactions handles GET /api/v1/coins/transactions.
func (h *Handler) ListTransactions(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	txType := r.URL.Query().Get("type")
	pg := httputil.ParsePagination(r, 20, 100)

	items, total, err := h.svc.ListTransactions(r.Context(), userID, txType, pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, TransactionListResponse{
		Items: items,
		Total: total,
	})
}

// PurchaseTheme handles POST /api/v1/coins/purchase-theme.
func (h *Handler) PurchaseTheme(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req PurchaseThemeReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.PurchaseTheme(r.Context(), userID, req.ThemeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// RefundTheme handles POST /api/v1/coins/refund-theme.
func (h *Handler) RefundTheme(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req RefundThemeReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	if err := h.svc.RefundTheme(r.Context(), userID, req.PurchaseID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "refunded"})
}

// ListPurchasedThemes handles GET /api/v1/coins/purchased-themes.
func (h *Handler) ListPurchasedThemes(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	pg := httputil.ParsePagination(r, 20, 100)

	items, total, err := h.svc.ListPurchasedThemes(r.Context(), userID, pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, PurchasedThemeListResponse{
		Items: items,
		Total: total,
	})
}
