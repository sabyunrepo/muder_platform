-- ═══════════════════════════════════════════════════════════════════
-- Coin Packages
-- ═══════════════════════════════════════════════════════════════════

-- name: ListActivePackages :many
SELECT * FROM coin_packages
WHERE is_active = true AND platform = $1
ORDER BY sort_order;

-- name: GetPackageByID :one
SELECT * FROM coin_packages WHERE id = $1;

-- name: CreatePackage :one
INSERT INTO coin_packages (platform, name, price_krw, base_coins, bonus_coins, sort_order, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdatePackage :one
UPDATE coin_packages
SET name = $2, price_krw = $3, base_coins = $4, bonus_coins = $5, sort_order = $6, is_active = $7
WHERE id = $1
RETURNING *;

-- ═══════════════════════════════════════════════════════════════════
-- Payments
-- ═══════════════════════════════════════════════════════════════════

-- name: CreatePayment :one
INSERT INTO payments (user_id, package_id, idempotency_key, provider, amount_krw, base_coins, bonus_coins)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetPaymentByID :one
SELECT * FROM payments WHERE id = $1;

-- name: GetPaymentByIdempotencyKey :one
SELECT * FROM payments WHERE idempotency_key = $1;

-- name: ConfirmPayment :one
UPDATE payments
SET status = 'CONFIRMED', payment_key = $2, confirmed_at = NOW()
WHERE id = $1 AND status = 'PENDING'
RETURNING *;

-- name: FailPayment :exec
UPDATE payments SET status = 'FAILED'
WHERE id = $1 AND status = 'PENDING';

-- name: ListPaymentsByUser :many
SELECT * FROM payments
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPaymentsByUser :one
SELECT COUNT(*) FROM payments WHERE user_id = $1;
