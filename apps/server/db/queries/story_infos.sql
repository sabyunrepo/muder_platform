-- ============================================================
-- Story Infos
-- ============================================================

-- name: ListStoryInfosByTheme :many
SELECT * FROM story_infos WHERE theme_id = $1 ORDER BY sort_order, created_at;

-- name: GetStoryInfoWithOwner :one
SELECT si.* FROM story_infos si
JOIN themes t ON si.theme_id = t.id
WHERE si.id = $1 AND t.creator_id = $2;

-- name: CreateStoryInfo :one
INSERT INTO story_infos (
  theme_id,
  title,
  body,
  image_media_id,
  related_character_ids,
  related_clue_ids,
  related_location_ids,
  sort_order
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateStoryInfo :one
UPDATE story_infos
SET title = $2,
    body = $3,
    image_media_id = $4,
    related_character_ids = $5,
    related_clue_ids = $6,
    related_location_ids = $7,
    sort_order = $8,
    version = version + 1,
    updated_at = NOW()
WHERE id = $1 AND version = $9
RETURNING *;

-- name: DeleteStoryInfoWithOwner :execrows
DELETE FROM story_infos si USING themes t
WHERE si.id = $1 AND si.theme_id = t.id AND t.creator_id = $2;
