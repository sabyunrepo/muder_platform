package creator

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// AdminHandler handles admin-only creator/settlement endpoints.
type AdminHandler struct {
	queries  *db.Queries
	pool     *pgxpool.Pool
	pipeline *SettlementPipeline
	logger   zerolog.Logger
}

// NewAdminHandler creates a new admin handler.
func NewAdminHandler(queries *db.Queries, pool *pgxpool.Pool, pipeline *SettlementPipeline, logger zerolog.Logger) *AdminHandler {
	return &AdminHandler{
		queries:  queries,
		pool:     pool,
		pipeline: pipeline,
		logger:   logger.With().Str("domain", "creator.admin").Logger(),
	}
}

// ListAllSettlements handles GET /api/v1/admin/settlements.
func (h *AdminHandler) ListAllSettlements(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	pg := httputil.ParsePagination(r, 20, 100)

	rows, err := h.queries.ListSettlementsByStatus(r.Context(), status, pg.Limit, pg.Offset)
	if err != nil {
		h.logger.Error().Err(err).Msg("failed to list settlements")
		apperror.WriteError(w, r, apperror.Internal("failed to list settlements"))
		return
	}

	total, err := h.queries.CountSettlementsByStatus(r.Context(), status)
	if err != nil {
		h.logger.Error().Err(err).Msg("failed to count settlements")
		apperror.WriteError(w, r, apperror.Internal("failed to count settlements"))
		return
	}

	result := make([]AdminSettlementResponse, 0, len(rows))
	for _, row := range rows {
		result = append(result, AdminSettlementResponse{
			SettlementResponse: toSettlementResponse(row.Settlement),
			CreatorID:          row.CreatorID,
			CreatorNickname:    row.CreatorNickname,
		})
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"settlements": result,
		"total":       total,
	})
}

// ApproveSettlement handles PATCH /api/v1/admin/settlements/{id}/approve.
func (h *AdminHandler) ApproveSettlement(w http.ResponseWriter, r *http.Request) {
	adminID := middleware.UserIDFrom(r.Context())
	if adminID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	settlementID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid settlement ID"))
		return
	}

	settlement, err := h.queries.ApproveSettlement(r.Context(), settlementID, adminID)
	if err != nil {
		h.logger.Error().Err(err).Str("settlement_id", settlementID.String()).Msg("failed to approve settlement")
		apperror.WriteError(w, r, apperror.New(apperror.ErrSettlementInvalidStatus, http.StatusConflict, "settlement cannot be approved (invalid status)"))
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toSettlementResponse(settlement))
}

// PayoutSettlement handles PATCH /api/v1/admin/settlements/{id}/payout.
func (h *AdminHandler) PayoutSettlement(w http.ResponseWriter, r *http.Request) {
	settlementID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid settlement ID"))
		return
	}

	settlement, err := h.queries.PayoutSettlement(r.Context(), settlementID)
	if err != nil {
		h.logger.Error().Err(err).Str("settlement_id", settlementID.String()).Msg("failed to payout settlement")
		apperror.WriteError(w, r, apperror.New(apperror.ErrSettlementInvalidStatus, http.StatusConflict, "settlement cannot be paid out (invalid status)"))
		return
	}

	httputil.WriteJSON(w, http.StatusOK, toSettlementResponse(settlement))
}

// CancelSettlement handles PATCH /api/v1/admin/settlements/{id}/cancel.
// Cancels the settlement and restores earnings to unsettled state [S8].
func (h *AdminHandler) CancelSettlement(w http.ResponseWriter, r *http.Request) {
	settlementID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid settlement ID"))
		return
	}

	if err := h.pipeline.CancelAndRestore(r.Context(), settlementID); err != nil {
		h.logger.Error().Err(err).Str("settlement_id", settlementID.String()).Msg("failed to cancel settlement")
		apperror.WriteError(w, r, apperror.New(apperror.ErrSettlementInvalidStatus, http.StatusConflict, "settlement cannot be cancelled"))
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

// GetRevenue handles GET /api/v1/admin/revenue.
func (h *AdminHandler) GetRevenue(w http.ResponseWriter, r *http.Request) {
	row, err := h.queries.GetPlatformRevenue(r.Context())
	if err != nil {
		h.logger.Error().Err(err).Msg("failed to get platform revenue")
		apperror.WriteError(w, r, apperror.Internal("failed to get platform revenue"))
		return
	}

	httputil.WriteJSON(w, http.StatusOK, RevenueResponse{
		TotalCoins:      row.TotalCoins,
		TotalKRW:        row.TotalKRW,
		TotalTax:        row.TotalTax,
		TotalNet:        row.TotalNet,
		SettlementCount: row.SettlementCount,
	})
}

// GrantCoins handles POST /api/v1/admin/coins/grant.
// Grants coins to a user via a transactional DB operation.
func (h *AdminHandler) GrantCoins(w http.ResponseWriter, r *http.Request) {
	var req GrantCoinsReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		h.logger.Error().Err(err).Msg("failed to begin transaction")
		apperror.WriteError(w, r, apperror.Internal("failed to grant coins"))
		return
	}
	defer tx.Rollback(r.Context()) //nolint:errcheck

	qtx := h.queries.WithTx(tx)

	// Lock user row for update.
	user, err := qtx.GetUserForCoinUpdate(r.Context(), req.UserID)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", req.UserID.String()).Msg("user not found for coin grant")
		apperror.WriteError(w, r, apperror.NotFound("user not found"))
		return
	}

	// Add coin balance.
	if err := qtx.AddCoinBalance(r.Context(), db.AddCoinBalanceParams{
		ID:               req.UserID,
		CoinBalanceBase:  int64(req.BaseCoins),
		CoinBalanceBonus: int64(req.BonusCoins),
	}); err != nil {
		h.logger.Error().Err(err).Msg("failed to add coin balance")
		apperror.WriteError(w, r, apperror.Internal("failed to grant coins"))
		return
	}

	// Record transaction.
	refType := "ADMIN_GRANT"
	desc := req.Description
	_, err = qtx.CreateCoinTransaction(r.Context(), db.CreateCoinTransactionParams{
		UserID:            req.UserID,
		Type:              "ADMIN_GRANT",
		BaseAmount:        req.BaseCoins,
		BonusAmount:       req.BonusCoins,
		BalanceAfterBase:  user.CoinBalanceBase + int64(req.BaseCoins),
		BalanceAfterBonus: user.CoinBalanceBonus + int64(req.BonusCoins),
		ReferenceType:     &refType,
		Description:       &desc,
	})
	if err != nil {
		h.logger.Error().Err(err).Msg("failed to create coin transaction")
		apperror.WriteError(w, r, apperror.Internal("failed to grant coins"))
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		h.logger.Error().Err(err).Msg("failed to commit coin grant transaction")
		apperror.WriteError(w, r, apperror.Internal("failed to grant coins"))
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"user_id":    req.UserID,
		"base_coins": req.BaseCoins,
		"bonus_coins": req.BonusCoins,
		"description": req.Description,
	})
}

// CreatePackage handles POST /api/v1/admin/packages.
func (h *AdminHandler) CreatePackage(w http.ResponseWriter, r *http.Request) {
	var req CreatePackageReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	pkg, err := h.queries.CreatePackage(r.Context(), db.CreatePackageParams{
		Platform:   req.Platform,
		Name:       req.Name,
		PriceKrw:   req.PriceKRW,
		BaseCoins:  req.BaseCoins,
		BonusCoins: req.BonusCoins,
		SortOrder:  req.SortOrder,
		IsActive:   req.IsActive,
	})
	if err != nil {
		h.logger.Error().Err(err).Msg("failed to create package")
		apperror.WriteError(w, r, apperror.Internal("failed to create package"))
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, pkg)
}

// UpdatePackage handles PATCH /api/v1/admin/packages/{id}.
func (h *AdminHandler) UpdatePackage(w http.ResponseWriter, r *http.Request) {
	pkgID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid package ID"))
		return
	}

	var req UpdatePackageReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	pkg, err := h.queries.UpdatePackage(r.Context(), db.UpdatePackageParams{
		ID:         pkgID,
		Name:       req.Name,
		PriceKrw:   req.PriceKRW,
		BaseCoins:  req.BaseCoins,
		BonusCoins: req.BonusCoins,
		SortOrder:  req.SortOrder,
		IsActive:   req.IsActive,
	})
	if err != nil {
		h.logger.Error().Err(err).Str("package_id", pkgID.String()).Msg("failed to update package")
		apperror.WriteError(w, r, apperror.Internal("failed to update package"))
		return
	}

	httputil.WriteJSON(w, http.StatusOK, pkg)
}

// RunSettlement handles POST /api/v1/admin/settlements/run.
func (h *AdminHandler) RunSettlement(w http.ResponseWriter, r *http.Request) {
	if err := h.pipeline.RunWeekly(r.Context()); err != nil {
		h.logger.Error().Err(err).Msg("manual settlement run failed")
		apperror.WriteError(w, r, apperror.Internal("settlement run failed: "+err.Error()))
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "completed"})
}
