// Hand-written sqlc-style code for creator.sql queries.
// Will be replaced by sqlc generate when available.
// source: creator.sql

package db

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ═══════════════════════════════════════════════════════════════════
// Creator Earnings
// ═══════════════════════════════════════════════════════════════════

const createEarning = `-- name: CreateEarning :one
INSERT INTO creator_earnings (creator_id, theme_id, purchase_id, total_coins, creator_share_coins, platform_share_coins)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, creator_id, theme_id, purchase_id, total_coins, creator_share_coins, platform_share_coins, settled, settlement_id, created_at
`

type CreateEarningParams struct {
	CreatorID         uuid.UUID `json:"creator_id"`
	ThemeID           uuid.UUID `json:"theme_id"`
	PurchaseID        uuid.UUID `json:"purchase_id"`
	TotalCoins        int32     `json:"total_coins"`
	CreatorShareCoins int32     `json:"creator_share_coins"`
	PlatformShareCoins int32    `json:"platform_share_coins"`
}

func (q *Queries) CreateEarning(ctx context.Context, arg CreateEarningParams) (CreatorEarning, error) {
	row := q.db.QueryRow(ctx, createEarning,
		arg.CreatorID,
		arg.ThemeID,
		arg.PurchaseID,
		arg.TotalCoins,
		arg.CreatorShareCoins,
		arg.PlatformShareCoins,
	)
	var i CreatorEarning
	err := row.Scan(
		&i.ID,
		&i.CreatorID,
		&i.ThemeID,
		&i.PurchaseID,
		&i.TotalCoins,
		&i.CreatorShareCoins,
		&i.PlatformShareCoins,
		&i.Settled,
		&i.SettlementID,
		&i.CreatedAt,
	)
	return i, err
}

const getEarningByPurchaseID = `-- name: GetEarningByPurchaseID :one
SELECT id, creator_id, theme_id, purchase_id, total_coins, creator_share_coins, platform_share_coins, settled, settlement_id, created_at
FROM creator_earnings WHERE purchase_id = $1
`

func (q *Queries) GetEarningByPurchaseID(ctx context.Context, purchaseID uuid.UUID) (CreatorEarning, error) {
	row := q.db.QueryRow(ctx, getEarningByPurchaseID, purchaseID)
	var i CreatorEarning
	err := row.Scan(
		&i.ID,
		&i.CreatorID,
		&i.ThemeID,
		&i.PurchaseID,
		&i.TotalCoins,
		&i.CreatorShareCoins,
		&i.PlatformShareCoins,
		&i.Settled,
		&i.SettlementID,
		&i.CreatedAt,
	)
	return i, err
}

const deleteEarningByPurchase = `-- name: DeleteEarningByPurchase :exec
DELETE FROM creator_earnings WHERE purchase_id = $1
`

func (q *Queries) DeleteEarningByPurchase(ctx context.Context, purchaseID uuid.UUID) error {
	_, err := q.db.Exec(ctx, deleteEarningByPurchase, purchaseID)
	return err
}

const listEarningsByCreator = `-- name: ListEarningsByCreator :many
SELECT ce.id, ce.creator_id, ce.theme_id, ce.purchase_id, ce.total_coins, ce.creator_share_coins, ce.platform_share_coins, ce.settled, ce.settlement_id, ce.created_at, t.title AS theme_title
FROM creator_earnings ce
JOIN themes t ON ce.theme_id = t.id
WHERE ce.creator_id = $1
ORDER BY ce.created_at DESC
LIMIT $2 OFFSET $3
`

type ListEarningsByCreatorRow struct {
	ID                 uuid.UUID   `json:"id"`
	CreatorID          uuid.UUID   `json:"creator_id"`
	ThemeID            uuid.UUID   `json:"theme_id"`
	PurchaseID         uuid.UUID   `json:"purchase_id"`
	TotalCoins         int32       `json:"total_coins"`
	CreatorShareCoins  int32       `json:"creator_share_coins"`
	PlatformShareCoins int32       `json:"platform_share_coins"`
	Settled            bool        `json:"settled"`
	SettlementID       pgtype.UUID `json:"settlement_id"`
	CreatedAt          time.Time   `json:"created_at"`
	ThemeTitle         string      `json:"theme_title"`
}

func (q *Queries) ListEarningsByCreator(ctx context.Context, creatorID uuid.UUID, limit, offset int32) ([]ListEarningsByCreatorRow, error) {
	rows, err := q.db.Query(ctx, listEarningsByCreator, creatorID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListEarningsByCreatorRow
	for rows.Next() {
		var i ListEarningsByCreatorRow
		if err := rows.Scan(
			&i.ID,
			&i.CreatorID,
			&i.ThemeID,
			&i.PurchaseID,
			&i.TotalCoins,
			&i.CreatorShareCoins,
			&i.PlatformShareCoins,
			&i.Settled,
			&i.SettlementID,
			&i.CreatedAt,
			&i.ThemeTitle,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const countEarningsByCreator = `-- name: CountEarningsByCreator :one
SELECT COUNT(*) FROM creator_earnings WHERE creator_id = $1
`

func (q *Queries) CountEarningsByCreator(ctx context.Context, creatorID uuid.UUID) (int64, error) {
	row := q.db.QueryRow(ctx, countEarningsByCreator, creatorID)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const getCreatorDashboard = `-- name: GetCreatorDashboard :one
SELECT
    COALESCE(SUM(creator_share_coins), 0)::bigint AS total_earnings,
    COALESCE(SUM(CASE WHEN settled = false THEN creator_share_coins ELSE 0 END), 0)::bigint AS unsettled,
    COUNT(*)::bigint AS total_sales
FROM creator_earnings
WHERE creator_id = $1
`

type GetCreatorDashboardRow struct {
	TotalEarnings int64 `json:"total_earnings"`
	Unsettled     int64 `json:"unsettled"`
	TotalSales    int64 `json:"total_sales"`
}

func (q *Queries) GetCreatorDashboard(ctx context.Context, creatorID uuid.UUID) (GetCreatorDashboardRow, error) {
	row := q.db.QueryRow(ctx, getCreatorDashboard, creatorID)
	var i GetCreatorDashboardRow
	err := row.Scan(&i.TotalEarnings, &i.Unsettled, &i.TotalSales)
	return i, err
}

const getThemeDailyStats = `-- name: GetThemeDailyStats :many
SELECT
    DATE(ce.created_at) AS stat_date,
    COUNT(*)::bigint AS sales_count,
    COALESCE(SUM(ce.creator_share_coins), 0)::bigint AS daily_earnings
FROM creator_earnings ce
WHERE ce.theme_id = $1
  AND ce.creator_id = $2
  AND ce.created_at >= $3
  AND ce.created_at < $4
GROUP BY DATE(ce.created_at)
ORDER BY stat_date
`

type GetThemeDailyStatsRow struct {
	StatDate      time.Time `json:"stat_date"`
	SalesCount    int64     `json:"sales_count"`
	DailyEarnings int64     `json:"daily_earnings"`
}

func (q *Queries) GetThemeDailyStats(ctx context.Context, themeID, creatorID uuid.UUID, from, to time.Time) ([]GetThemeDailyStatsRow, error) {
	rows, err := q.db.Query(ctx, getThemeDailyStats, themeID, creatorID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []GetThemeDailyStatsRow
	for rows.Next() {
		var i GetThemeDailyStatsRow
		if err := rows.Scan(&i.StatDate, &i.SalesCount, &i.DailyEarnings); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const collectUnsettledEarnings = `-- name: CollectUnsettledEarnings :many
SELECT
    ce.creator_id,
    COALESCE(SUM(ce.creator_share_coins), 0)::bigint AS total_creator_coins,
    COUNT(*)::bigint AS earnings_count
FROM creator_earnings ce
JOIN theme_purchases tp ON ce.purchase_id = tp.id
WHERE ce.settled = false
  AND tp.created_at < NOW() - INTERVAL '7 days'
GROUP BY ce.creator_id
HAVING SUM(ce.creator_share_coins) > 0
`

type CollectUnsettledEarningsRow struct {
	CreatorID        uuid.UUID `json:"creator_id"`
	TotalCreatorCoins int64    `json:"total_creator_coins"`
	EarningsCount    int64     `json:"earnings_count"`
}

func (q *Queries) CollectUnsettledEarnings(ctx context.Context) ([]CollectUnsettledEarningsRow, error) {
	rows, err := q.db.Query(ctx, collectUnsettledEarnings)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []CollectUnsettledEarningsRow
	for rows.Next() {
		var i CollectUnsettledEarningsRow
		if err := rows.Scan(&i.CreatorID, &i.TotalCreatorCoins, &i.EarningsCount); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const settleEarnings = `-- name: SettleEarnings :exec
UPDATE creator_earnings SET settled = true, settlement_id = $2
WHERE creator_id = $1
  AND settled = false
  AND purchase_id IN (
      SELECT tp.id FROM theme_purchases tp
      WHERE tp.created_at < NOW() - INTERVAL '7 days'
  )
`

func (q *Queries) SettleEarnings(ctx context.Context, creatorID uuid.UUID, settlementID uuid.UUID) error {
	_, err := q.db.Exec(ctx, settleEarnings, creatorID, settlementID)
	return err
}

const unsettleEarningsBySettlement = `-- name: UnsettleEarningsBySettlement :exec
UPDATE creator_earnings SET settled = false, settlement_id = NULL
WHERE settlement_id = $1
`

func (q *Queries) UnsettleEarningsBySettlement(ctx context.Context, settlementID uuid.UUID) error {
	_, err := q.db.Exec(ctx, unsettleEarningsBySettlement, settlementID)
	return err
}

// ═══════════════════════════════════════════════════════════════════
// Settlements
// ═══════════════════════════════════════════════════════════════════

const createSettlement = `-- name: CreateSettlement :one
INSERT INTO settlements (creator_id, period_start, period_end, total_coins, total_krw, tax_type, tax_rate, tax_amount, net_amount)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, creator_id, period_start, period_end, total_coins, total_krw, tax_type, tax_rate, tax_amount, net_amount, status, approved_by, approved_at, paid_out_at, created_at, updated_at
`

type CreateSettlementParams struct {
	CreatorID   uuid.UUID `json:"creator_id"`
	PeriodStart string    `json:"period_start"`
	PeriodEnd   string    `json:"period_end"`
	TotalCoins  int32     `json:"total_coins"`
	TotalKRW    int32     `json:"total_krw"`
	TaxType     string    `json:"tax_type"`
	TaxRate     float64   `json:"tax_rate"`
	TaxAmount   int32     `json:"tax_amount"`
	NetAmount   int32     `json:"net_amount"`
}

func (q *Queries) CreateSettlement(ctx context.Context, arg CreateSettlementParams) (Settlement, error) {
	row := q.db.QueryRow(ctx, createSettlement,
		arg.CreatorID,
		arg.PeriodStart,
		arg.PeriodEnd,
		arg.TotalCoins,
		arg.TotalKRW,
		arg.TaxType,
		arg.TaxRate,
		arg.TaxAmount,
		arg.NetAmount,
	)
	var i Settlement
	err := row.Scan(
		&i.ID,
		&i.CreatorID,
		&i.PeriodStart,
		&i.PeriodEnd,
		&i.TotalCoins,
		&i.TotalKRW,
		&i.TaxType,
		&i.TaxRate,
		&i.TaxAmount,
		&i.NetAmount,
		&i.Status,
		&i.ApprovedBy,
		&i.ApprovedAt,
		&i.PaidOutAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const getSettlement = `-- name: GetSettlement :one
SELECT id, creator_id, period_start, period_end, total_coins, total_krw, tax_type, tax_rate, tax_amount, net_amount, status, approved_by, approved_at, paid_out_at, created_at, updated_at
FROM settlements WHERE id = $1
`

func (q *Queries) GetSettlement(ctx context.Context, id uuid.UUID) (Settlement, error) {
	row := q.db.QueryRow(ctx, getSettlement, id)
	var i Settlement
	err := row.Scan(
		&i.ID,
		&i.CreatorID,
		&i.PeriodStart,
		&i.PeriodEnd,
		&i.TotalCoins,
		&i.TotalKRW,
		&i.TaxType,
		&i.TaxRate,
		&i.TaxAmount,
		&i.NetAmount,
		&i.Status,
		&i.ApprovedBy,
		&i.ApprovedAt,
		&i.PaidOutAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const approveSettlement = `-- name: ApproveSettlement :one
UPDATE settlements
SET status = 'APPROVED', approved_by = $2, approved_at = NOW()
WHERE id = $1 AND status = 'CALCULATED'
RETURNING id, creator_id, period_start, period_end, total_coins, total_krw, tax_type, tax_rate, tax_amount, net_amount, status, approved_by, approved_at, paid_out_at, created_at, updated_at
`

func (q *Queries) ApproveSettlement(ctx context.Context, id, approvedBy uuid.UUID) (Settlement, error) {
	row := q.db.QueryRow(ctx, approveSettlement, id, approvedBy)
	var i Settlement
	err := row.Scan(
		&i.ID,
		&i.CreatorID,
		&i.PeriodStart,
		&i.PeriodEnd,
		&i.TotalCoins,
		&i.TotalKRW,
		&i.TaxType,
		&i.TaxRate,
		&i.TaxAmount,
		&i.NetAmount,
		&i.Status,
		&i.ApprovedBy,
		&i.ApprovedAt,
		&i.PaidOutAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const payoutSettlement = `-- name: PayoutSettlement :one
UPDATE settlements
SET status = 'PAID_OUT', paid_out_at = NOW()
WHERE id = $1 AND status = 'APPROVED'
RETURNING id, creator_id, period_start, period_end, total_coins, total_krw, tax_type, tax_rate, tax_amount, net_amount, status, approved_by, approved_at, paid_out_at, created_at, updated_at
`

func (q *Queries) PayoutSettlement(ctx context.Context, id uuid.UUID) (Settlement, error) {
	row := q.db.QueryRow(ctx, payoutSettlement, id)
	var i Settlement
	err := row.Scan(
		&i.ID,
		&i.CreatorID,
		&i.PeriodStart,
		&i.PeriodEnd,
		&i.TotalCoins,
		&i.TotalKRW,
		&i.TaxType,
		&i.TaxRate,
		&i.TaxAmount,
		&i.NetAmount,
		&i.Status,
		&i.ApprovedBy,
		&i.ApprovedAt,
		&i.PaidOutAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const cancelSettlement = `-- name: CancelSettlement :one
UPDATE settlements
SET status = 'CANCELLED'
WHERE id = $1 AND status IN ('CALCULATED', 'APPROVED')
RETURNING id, creator_id, period_start, period_end, total_coins, total_krw, tax_type, tax_rate, tax_amount, net_amount, status, approved_by, approved_at, paid_out_at, created_at, updated_at
`

func (q *Queries) CancelSettlement(ctx context.Context, id uuid.UUID) (Settlement, error) {
	row := q.db.QueryRow(ctx, cancelSettlement, id)
	var i Settlement
	err := row.Scan(
		&i.ID,
		&i.CreatorID,
		&i.PeriodStart,
		&i.PeriodEnd,
		&i.TotalCoins,
		&i.TotalKRW,
		&i.TaxType,
		&i.TaxRate,
		&i.TaxAmount,
		&i.NetAmount,
		&i.Status,
		&i.ApprovedBy,
		&i.ApprovedAt,
		&i.PaidOutAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const listSettlementsByCreator = `-- name: ListSettlementsByCreator :many
SELECT id, creator_id, period_start, period_end, total_coins, total_krw, tax_type, tax_rate, tax_amount, net_amount, status, approved_by, approved_at, paid_out_at, created_at, updated_at
FROM settlements
WHERE creator_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
`

func (q *Queries) ListSettlementsByCreator(ctx context.Context, creatorID uuid.UUID, limit, offset int32) ([]Settlement, error) {
	rows, err := q.db.Query(ctx, listSettlementsByCreator, creatorID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []Settlement
	for rows.Next() {
		var i Settlement
		if err := rows.Scan(
			&i.ID,
			&i.CreatorID,
			&i.PeriodStart,
			&i.PeriodEnd,
			&i.TotalCoins,
			&i.TotalKRW,
			&i.TaxType,
			&i.TaxRate,
			&i.TaxAmount,
			&i.NetAmount,
			&i.Status,
			&i.ApprovedBy,
			&i.ApprovedAt,
			&i.PaidOutAt,
			&i.CreatedAt,
			&i.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const countSettlementsByCreator = `-- name: CountSettlementsByCreator :one
SELECT COUNT(*) FROM settlements WHERE creator_id = $1
`

func (q *Queries) CountSettlementsByCreator(ctx context.Context, creatorID uuid.UUID) (int64, error) {
	row := q.db.QueryRow(ctx, countSettlementsByCreator, creatorID)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const listSettlementsByStatus = `-- name: ListSettlementsByStatus :many
SELECT s.id, s.creator_id, s.period_start, s.period_end, s.total_coins, s.total_krw, s.tax_type, s.tax_rate, s.tax_amount, s.net_amount, s.status, s.approved_by, s.approved_at, s.paid_out_at, s.created_at, s.updated_at, u.nickname AS creator_nickname
FROM settlements s
JOIN users u ON s.creator_id = u.id
WHERE ($1::varchar = '' OR s.status = $1)
ORDER BY s.created_at DESC
LIMIT $2 OFFSET $3
`

type ListSettlementsByStatusRow struct {
	Settlement
	CreatorNickname string `json:"creator_nickname"`
}

func (q *Queries) ListSettlementsByStatus(ctx context.Context, status string, limit, offset int32) ([]ListSettlementsByStatusRow, error) {
	rows, err := q.db.Query(ctx, listSettlementsByStatus, status, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ListSettlementsByStatusRow
	for rows.Next() {
		var i ListSettlementsByStatusRow
		if err := rows.Scan(
			&i.ID,
			&i.CreatorID,
			&i.PeriodStart,
			&i.PeriodEnd,
			&i.TotalCoins,
			&i.TotalKRW,
			&i.TaxType,
			&i.TaxRate,
			&i.TaxAmount,
			&i.NetAmount,
			&i.Status,
			&i.ApprovedBy,
			&i.ApprovedAt,
			&i.PaidOutAt,
			&i.CreatedAt,
			&i.UpdatedAt,
			&i.CreatorNickname,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

const countSettlementsByStatus = `-- name: CountSettlementsByStatus :one
SELECT COUNT(*) FROM settlements
WHERE ($1::varchar = '' OR status = $1)
`

func (q *Queries) CountSettlementsByStatus(ctx context.Context, status string) (int64, error) {
	row := q.db.QueryRow(ctx, countSettlementsByStatus, status)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const getPlatformRevenue = `-- name: GetPlatformRevenue :one
SELECT
    COALESCE(SUM(total_coins), 0)::bigint AS total_coins,
    COALESCE(SUM(total_krw), 0)::bigint AS total_krw,
    COALESCE(SUM(tax_amount), 0)::bigint AS total_tax,
    COALESCE(SUM(net_amount), 0)::bigint AS total_net,
    COUNT(*)::bigint AS settlement_count
FROM settlements
WHERE status = 'PAID_OUT'
`

type GetPlatformRevenueRow struct {
	TotalCoins      int64 `json:"total_coins"`
	TotalKRW        int64 `json:"total_krw"`
	TotalTax        int64 `json:"total_tax"`
	TotalNet        int64 `json:"total_net"`
	SettlementCount int64 `json:"settlement_count"`
}

func (q *Queries) GetPlatformRevenue(ctx context.Context) (GetPlatformRevenueRow, error) {
	row := q.db.QueryRow(ctx, getPlatformRevenue)
	var i GetPlatformRevenueRow
	err := row.Scan(&i.TotalCoins, &i.TotalKRW, &i.TotalTax, &i.TotalNet, &i.SettlementCount)
	return i, err
}
