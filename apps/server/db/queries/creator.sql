-- ═══════════════════════════════════════════════════════════════════
-- Creator Earnings
-- ═══════════════════════════════════════════════════════════════════

-- name: CreateEarning :one
INSERT INTO creator_earnings (creator_id, theme_id, purchase_id, total_coins, creator_share_coins, platform_share_coins)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetEarningByPurchaseID :one
SELECT * FROM creator_earnings WHERE purchase_id = $1;

-- name: DeleteEarningByPurchase :exec
DELETE FROM creator_earnings WHERE purchase_id = $1;

-- name: ListEarningsByCreator :many
SELECT ce.*, t.title AS theme_title
FROM creator_earnings ce
JOIN themes t ON ce.theme_id = t.id
WHERE ce.creator_id = $1
ORDER BY ce.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountEarningsByCreator :one
SELECT COUNT(*) FROM creator_earnings WHERE creator_id = $1;

-- name: GetCreatorDashboard :one
SELECT
    COALESCE(SUM(creator_share_coins), 0)::bigint AS total_earnings,
    COALESCE(SUM(CASE WHEN settled = false THEN creator_share_coins ELSE 0 END), 0)::bigint AS unsettled,
    COUNT(*)::bigint AS total_sales
FROM creator_earnings
WHERE creator_id = $1;

-- name: GetThemeDailyStats :many
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
ORDER BY stat_date;

-- name: CollectUnsettledEarnings :many
SELECT
    ce.creator_id,
    COALESCE(SUM(ce.creator_share_coins), 0)::bigint AS total_creator_coins,
    COUNT(*)::bigint AS earnings_count
FROM creator_earnings ce
JOIN theme_purchases tp ON ce.purchase_id = tp.id
WHERE ce.settled = false
  AND tp.created_at < NOW() - INTERVAL '7 days'
GROUP BY ce.creator_id
HAVING SUM(ce.creator_share_coins) > 0;

-- name: SettleEarnings :exec
UPDATE creator_earnings SET settled = true, settlement_id = $2
WHERE creator_id = $1
  AND settled = false
  AND purchase_id IN (
      SELECT tp.id FROM theme_purchases tp
      WHERE tp.created_at < NOW() - INTERVAL '7 days'
  );

-- name: UnsettleEarningsBySettlement :exec
UPDATE creator_earnings SET settled = false, settlement_id = NULL
WHERE settlement_id = $1;

-- ═══════════════════════════════════════════════════════════════════
-- Settlements
-- ═══════════════════════════════════════════════════════════════════

-- name: CreateSettlement :one
INSERT INTO settlements (creator_id, period_start, period_end, total_coins, total_krw, tax_type, tax_rate, tax_amount, net_amount)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetSettlement :one
SELECT * FROM settlements WHERE id = $1;

-- name: ApproveSettlement :one
UPDATE settlements
SET status = 'APPROVED', approved_by = $2, approved_at = NOW()
WHERE id = $1 AND status = 'CALCULATED'
RETURNING *;

-- name: PayoutSettlement :one
UPDATE settlements
SET status = 'PAID_OUT', paid_out_at = NOW()
WHERE id = $1 AND status = 'APPROVED'
RETURNING *;

-- name: CancelSettlement :one
UPDATE settlements
SET status = 'CANCELLED'
WHERE id = $1 AND status IN ('CALCULATED', 'APPROVED')
RETURNING *;

-- name: ListSettlementsByCreator :many
SELECT * FROM settlements
WHERE creator_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountSettlementsByCreator :one
SELECT COUNT(*) FROM settlements WHERE creator_id = $1;

-- name: ListSettlementsByStatus :many
SELECT s.id, s.creator_id, s.period_start, s.period_end, s.total_coins, s.total_krw, s.tax_type, s.tax_rate, s.tax_amount, s.net_amount, s.status, s.approved_by, s.approved_at, s.paid_out_at, s.created_at, s.updated_at, u.nickname AS creator_nickname
FROM settlements s
JOIN users u ON s.creator_id = u.id
WHERE ($1::varchar = '' OR s.status = $1)
ORDER BY s.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountSettlementsByStatus :one
SELECT COUNT(*) FROM settlements
WHERE ($1::varchar = '' OR status = $1);

-- name: GetPlatformRevenue :one
SELECT
    COALESCE(SUM(total_coins), 0)::bigint AS total_coins,
    COALESCE(SUM(total_krw), 0)::bigint AS total_krw,
    COALESCE(SUM(tax_amount), 0)::bigint AS total_tax,
    COALESCE(SUM(net_amount), 0)::bigint AS total_net,
    COUNT(*)::bigint AS settlement_count
FROM settlements
WHERE status = 'PAID_OUT';
