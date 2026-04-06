-- ═══════════════════════════════════════════════════════════════════
-- Coin Balance
-- ═══════════════════════════════════════════════════════════════════

-- name: GetUserForCoinUpdate :one
SELECT id, coin_balance_base, coin_balance_bonus FROM users WHERE id = $1 FOR UPDATE;

-- name: AddCoinBalance :exec
UPDATE users
SET coin_balance_base = coin_balance_base + $2, coin_balance_bonus = coin_balance_bonus + $3
WHERE id = $1;

-- name: GetCoinBalance :one
SELECT coin_balance_base, coin_balance_bonus FROM users WHERE id = $1;

-- ═══════════════════════════════════════════════════════════════════
-- Coin Transactions
-- ═══════════════════════════════════════════════════════════════════

-- name: CreateCoinTransaction :one
INSERT INTO coin_transactions (user_id, type, base_amount, bonus_amount, balance_after_base, balance_after_bonus, reference_type, reference_id, description)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ListCoinTransactions :many
SELECT * FROM coin_transactions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListCoinTransactionsByType :many
SELECT * FROM coin_transactions
WHERE user_id = $1 AND type = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: CountCoinTransactions :one
SELECT COUNT(*) FROM coin_transactions WHERE user_id = $1;

-- name: CountCoinTransactionsByType :one
SELECT COUNT(*) FROM coin_transactions WHERE user_id = $1 AND type = $2;

-- ═══════════════════════════════════════════════════════════════════
-- Theme Purchases
-- ═══════════════════════════════════════════════════════════════════

-- name: CreateThemePurchase :one
INSERT INTO theme_purchases (user_id, theme_id, coin_price, base_coins_used, bonus_coins_used, refundable_until)
VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')
RETURNING *;

-- name: GetThemePurchase :one
SELECT * FROM theme_purchases WHERE id = $1;

-- name: GetThemePurchaseByUserTheme :one
SELECT * FROM theme_purchases WHERE user_id = $1 AND theme_id = $2;

-- name: GetThemePurchaseForRefund :one
SELECT * FROM theme_purchases WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: RefundThemePurchase :one
UPDATE theme_purchases
SET status = 'REFUNDED', refunded_at = NOW()
WHERE id = $1 AND status = 'COMPLETED'
RETURNING *;

-- name: MarkThemePlayed :exec
UPDATE theme_purchases SET has_played = true
WHERE user_id = $1 AND theme_id = $2 AND status = 'COMPLETED';

-- name: ListPurchasedThemes :many
SELECT tp.*, t.title AS theme_title, t.slug AS theme_slug, t.cover_image AS theme_cover_image
FROM theme_purchases tp
JOIN themes t ON tp.theme_id = t.id
WHERE tp.user_id = $1 AND tp.status = 'COMPLETED'
ORDER BY tp.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPurchasedThemes :one
SELECT COUNT(*) FROM theme_purchases
WHERE user_id = $1 AND status = 'COMPLETED';

-- name: CountRecentRefunds :one
SELECT COUNT(*) FROM theme_purchases
WHERE user_id = $1 AND status = 'REFUNDED' AND refunded_at > NOW() - INTERVAL '30 days';
