-- name: GetUser :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByProvider :one
SELECT * FROM users WHERE provider = $1 AND provider_id = $2;

-- name: CreateUser :one
INSERT INTO users (nickname, email, avatar_url, provider, provider_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateUser :one
UPDATE users SET nickname = $2, avatar_url = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateCoinBalance :one
UPDATE users SET coin_balance = coin_balance + $2, updated_at = NOW()
WHERE id = $1 AND coin_balance + $2 >= 0
RETURNING *;
