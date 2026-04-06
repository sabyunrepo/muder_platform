package payment

import (
	"io"
	"net/http"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// Handler handles payment HTTP endpoints.
type Handler struct {
	svc      PaymentService
	provider PaymentProvider
}

// NewHandler creates a new payment handler.
func NewHandler(svc PaymentService, provider PaymentProvider) *Handler {
	return &Handler{svc: svc, provider: provider}
}

// ListPackages handles GET /api/v1/payments/packages.
func (h *Handler) ListPackages(w http.ResponseWriter, r *http.Request) {
	platform := r.URL.Query().Get("platform")
	if platform == "" {
		platform = "WEB"
	}

	// H3: Validate platform parameter.
	if platform != "WEB" && platform != "MOBILE" {
		apperror.WriteError(w, r, apperror.BadRequest("invalid platform: must be WEB or MOBILE"))
		return
	}

	packages, err := h.svc.ListPackages(r.Context(), platform)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, packages)
}

// CreatePayment handles POST /api/v1/payments/create.
func (h *Handler) CreatePayment(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req CreatePaymentReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.CreatePayment(r.Context(), userID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// ConfirmPayment handles POST /api/v1/payments/confirm.
func (h *Handler) ConfirmPayment(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req ConfirmPaymentReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.ConfirmPayment(r.Context(), userID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// HandleWebhook handles POST /api/v1/payments/webhook.
// This endpoint should be placed outside JWT middleware [S2].
// Signature verification is delegated to the provider.
func (h *Handler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	// Limit body to 1 MB to prevent abuse.
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("failed to read webhook body"))
		return
	}
	defer r.Body.Close()

	if _, err := h.provider.HandleWebhook(r.Context(), r.Header, body); err != nil {
		apperror.WriteError(w, r, apperror.New(
			apperror.ErrPaymentWebhookInvalid,
			http.StatusBadRequest,
			"webhook verification failed",
		))
		return
	}

	w.WriteHeader(http.StatusOK)
}

// GetPaymentHistory handles GET /api/v1/payments/history.
func (h *Handler) GetPaymentHistory(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	pg := httputil.ParsePagination(r, 20, 100)

	data, total, err := h.svc.GetPaymentHistory(r.Context(), userID, pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"data":  data,
		"total": total,
	})
}
