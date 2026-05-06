-- ============================================================
-- Story Infos
-- ============================================================

-- name: ListStoryInfosByTheme :many
SELECT si.* FROM story_infos si
JOIN themes t ON si.theme_id = t.id
WHERE si.theme_id = $1 AND t.creator_id = $2
ORDER BY si.sort_order, si.created_at;

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
SELECT $1, $2, $3, $4, $5, $6, $7, $8
FROM themes t
WHERE t.id = $1 AND t.creator_id = $9
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
FROM themes t
WHERE story_infos.id = $1
  AND story_infos.theme_id = t.id
  AND t.creator_id = $10
  AND story_infos.version = $9
RETURNING story_infos.*;

-- name: DeleteStoryInfoWithOwner :one
DELETE FROM story_infos si USING themes t
WHERE si.id = $1 AND si.theme_id = t.id AND t.creator_id = $2
RETURNING si.theme_id;
