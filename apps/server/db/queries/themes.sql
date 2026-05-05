-- name: GetTheme :one
SELECT * FROM themes WHERE id = $1;

-- name: GetThemeBySlug :one
SELECT * FROM themes WHERE slug = $1;

-- name: ListThemesByCreator :many
SELECT id, title, status, min_players, max_players, coin_price, version, created_at
FROM themes WHERE creator_id = $1 ORDER BY created_at DESC;

-- name: ListPublishedThemes :many
SELECT * FROM themes WHERE status = 'PUBLISHED' ORDER BY published_at DESC LIMIT $1 OFFSET $2;

-- name: CreateTheme :one
INSERT INTO themes (creator_id, title, slug, description, cover_image, min_players, max_players, duration_min, price, coin_price, config_json)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: UpdateThemeStatus :one
UPDATE themes SET status = $2, published_at = CASE WHEN $2 = 'PUBLISHED' THEN NOW() ELSE published_at END, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetThemeCharacters :many
SELECT * FROM theme_characters WHERE theme_id = $1 ORDER BY sort_order;

-- name: CreateThemeCharacter :one
INSERT INTO theme_characters (
  theme_id, name, description, image_url, is_culprit, mystery_role, sort_order,
  is_playable, show_in_intro, can_speak_in_reading, is_voting_candidate,
  endcard_title, endcard_body, endcard_image_url, alias_rules
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
RETURNING *;

-- name: UpdateTheme :one
UPDATE themes SET title = $2, slug = $3, description = $4, cover_image = $5,
  min_players = $6, max_players = $7, duration_min = $8, price = $9, coin_price = $10,
  version = version + 1, updated_at = NOW()
WHERE id = $1 AND version = $11
RETURNING *;

-- name: DeleteTheme :exec
DELETE FROM themes WHERE id = $1;

-- name: UpdateThemeConfigJson :one
UPDATE themes SET config_json = $2, version = version + 1, updated_at = NOW()
WHERE id = $1 AND version = $3
RETURNING *;

-- name: GetThemeCharacter :one
SELECT * FROM theme_characters WHERE id = $1;

-- name: UpdateThemeCharacter :one
UPDATE theme_characters SET
  name = $2,
  description = $3,
  image_url = $4,
  is_culprit = $5,
  mystery_role = $6,
  sort_order = $7,
  is_playable = $8,
  show_in_intro = $9,
  can_speak_in_reading = $10,
  is_voting_candidate = $11,
  endcard_title = $12,
  endcard_body = $13,
  endcard_image_url = $14,
  alias_rules = $15
WHERE id = $1
RETURNING *;

-- name: DeleteThemeCharacter :exec
DELETE FROM theme_characters WHERE id = $1;

-- name: CountThemeCharacters :one
SELECT count(*) FROM theme_characters WHERE theme_id = $1;

-- name: ListAllThemes :many
SELECT * FROM themes ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: ListAllRooms :many
SELECT * FROM rooms ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: UpdateThemeCoverImage :exec
UPDATE themes SET cover_image = $2, updated_at = NOW() WHERE id = $1;
