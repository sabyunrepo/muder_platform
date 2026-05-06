-- ============================================================
-- Maps
-- ============================================================

-- name: ListMapsByTheme :many
SELECT * FROM theme_maps WHERE theme_id = $1 ORDER BY sort_order;

-- name: GetMap :one
SELECT * FROM theme_maps WHERE id = $1;

-- name: CreateMap :one
INSERT INTO theme_maps (theme_id, name, image_url, sort_order)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateMap :one
UPDATE theme_maps SET name = $2, image_url = $3, sort_order = $4
WHERE id = $1
RETURNING *;

-- name: DeleteMap :exec
DELETE FROM theme_maps WHERE id = $1;

-- name: CountMapsByTheme :one
SELECT count(*) FROM theme_maps WHERE theme_id = $1;

-- ============================================================
-- Locations
-- ============================================================

-- name: ListLocationsByMap :many
SELECT * FROM theme_locations WHERE map_id = $1 ORDER BY sort_order;

-- name: ListLocationsByTheme :many
SELECT * FROM theme_locations WHERE theme_id = $1 ORDER BY sort_order;

-- name: GetLocation :one
SELECT * FROM theme_locations WHERE id = $1;

-- name: CreateLocation :one
INSERT INTO theme_locations (theme_id, map_id, name, restricted_characters, sort_order, from_round, until_round, image_url, image_media_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateLocation :one
UPDATE theme_locations
SET name = $2, restricted_characters = $3, sort_order = $4, from_round = $5, until_round = $6, image_url = $7, image_media_id = $8
WHERE id = $1
RETURNING *;

-- name: DeleteLocation :exec
DELETE FROM theme_locations WHERE id = $1;

-- name: CountLocationsByMap :one
SELECT count(*) FROM theme_locations WHERE map_id = $1;

-- ============================================================
-- Clues
-- ============================================================

-- name: ListCluesByTheme :many
SELECT * FROM theme_clues WHERE theme_id = $1 ORDER BY sort_order;

-- name: ListCluesByLocation :many
SELECT * FROM theme_clues WHERE location_id = $1 ORDER BY sort_order;

-- name: GetClue :one
SELECT * FROM theme_clues WHERE id = $1;

-- name: CreateClue :one
INSERT INTO theme_clues (theme_id, location_id, name, description, image_url, image_media_id, is_common, level, sort_order, is_usable, use_effect, use_target, use_consumed, reveal_round, hide_round)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
RETURNING *;

-- name: UpdateClue :one
UPDATE theme_clues
SET location_id = $2, name = $3, description = $4, image_url = $5, image_media_id = $6, is_common = $7, level = $8, sort_order = $9, is_usable = $10, use_effect = $11, use_target = $12, use_consumed = $13, reveal_round = $14, hide_round = $15
WHERE id = $1
RETURNING *;

-- name: DeleteClue :exec
DELETE FROM theme_clues WHERE id = $1;

-- name: CountCluesByTheme :one
SELECT count(*) FROM theme_clues WHERE theme_id = $1;

-- ============================================================
-- Contents
-- ============================================================

-- name: GetContent :one
SELECT * FROM theme_contents WHERE theme_id = $1 AND key = $2;

-- name: UpsertContent :one
INSERT INTO theme_contents (theme_id, key, body, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (theme_id, key) DO UPDATE SET body = EXCLUDED.body, updated_at = NOW()
RETURNING *;

-- name: ListContentsByTheme :many
SELECT * FROM theme_contents WHERE theme_id = $1 ORDER BY key;

-- name: DeleteContent :exec
DELETE FROM theme_contents WHERE theme_id = $1 AND key = $2;

-- ============================================================
-- Ownership verification (JOIN-based, single query)
-- ============================================================

-- name: GetMapWithOwner :one
SELECT m.* FROM theme_maps m
JOIN themes t ON m.theme_id = t.id
WHERE m.id = $1 AND t.creator_id = $2;

-- name: GetLocationWithOwner :one
SELECT l.* FROM theme_locations l
JOIN themes t ON l.theme_id = t.id
WHERE l.id = $1 AND t.creator_id = $2;

-- name: GetClueWithOwner :one
SELECT c.* FROM theme_clues c
JOIN themes t ON c.theme_id = t.id
WHERE c.id = $1 AND t.creator_id = $2;

-- name: DeleteMapWithOwner :execrows
DELETE FROM theme_maps m USING themes t
WHERE m.id = $1 AND m.theme_id = t.id AND t.creator_id = $2;

-- name: DeleteLocationWithOwner :execrows
DELETE FROM theme_locations l USING themes t
WHERE l.id = $1 AND l.theme_id = t.id AND t.creator_id = $2;

-- name: DeleteClueWithOwner :execrows
DELETE FROM theme_clues c USING themes t
WHERE c.id = $1 AND c.theme_id = t.id AND t.creator_id = $2;
