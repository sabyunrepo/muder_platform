-- ============================================================
-- Media
-- ============================================================

-- name: ListMediaByTheme :many
SELECT * FROM theme_media WHERE theme_id = $1 ORDER BY sort_order, created_at;

-- name: ListMediaByThemeAndType :many
SELECT * FROM theme_media WHERE theme_id = $1 AND type = $2 ORDER BY sort_order, created_at;

-- name: GetMedia :one
SELECT * FROM theme_media WHERE id = $1;

-- name: CreateMedia :one
INSERT INTO theme_media (theme_id, name, type, source_type, url, storage_key, duration, file_size, mime_type, tags, sort_order)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: UpdateMedia :one
UPDATE theme_media SET name = $2, type = $3, duration = $4, tags = $5, sort_order = $6, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteMedia :exec
DELETE FROM theme_media WHERE id = $1;

-- name: CountMediaByTheme :one
SELECT count(*) FROM theme_media WHERE theme_id = $1;

-- name: SumMediaSizeByTheme :one
SELECT COALESCE(sum(file_size), 0)::BIGINT FROM theme_media WHERE theme_id = $1;

-- name: SumMediaSizeByCreator :one
SELECT COALESCE(sum(m.file_size), 0)::BIGINT FROM theme_media m
JOIN themes t ON m.theme_id = t.id
WHERE t.creator_id = $1;

-- ============================================================
-- Media (Owner-verified)
-- ============================================================

-- name: GetMediaWithOwner :one
SELECT m.* FROM theme_media m
JOIN themes t ON m.theme_id = t.id
WHERE m.id = $1 AND t.creator_id = $2;

-- name: DeleteMediaWithOwner :execrows
DELETE FROM theme_media m USING themes t
WHERE m.id = $1 AND m.theme_id = t.id AND t.creator_id = $2;

-- ============================================================
-- Media (Batch)
-- ============================================================

-- name: ListMediaByIDs :many
SELECT * FROM theme_media WHERE id = ANY($1::uuid[]);
