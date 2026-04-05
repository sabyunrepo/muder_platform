-- name: GetTheme :one
SELECT * FROM themes WHERE id = $1;

-- name: GetThemeBySlug :one
SELECT * FROM themes WHERE slug = $1;

-- name: ListThemesByCreator :many
SELECT * FROM themes WHERE creator_id = $1 ORDER BY created_at DESC;

-- name: ListPublishedThemes :many
SELECT * FROM themes WHERE status = 'PUBLISHED' ORDER BY published_at DESC LIMIT $1 OFFSET $2;

-- name: CreateTheme :one
INSERT INTO themes (creator_id, title, slug, description, cover_image, min_players, max_players, duration_min, price, config_json)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: UpdateThemeStatus :one
UPDATE themes SET status = $2, published_at = CASE WHEN $2 = 'PUBLISHED' THEN NOW() ELSE published_at END, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetThemeCharacters :many
SELECT * FROM theme_characters WHERE theme_id = $1 ORDER BY sort_order;

-- name: CreateThemeCharacter :one
INSERT INTO theme_characters (theme_id, name, description, image_url, is_culprit, sort_order)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;
