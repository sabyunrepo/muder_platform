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
  content_format,
  image_media_id,
  related_character_ids,
  related_clue_ids,
  related_location_ids,
  sort_order
)
SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
FROM themes t
WHERE t.id = $1 AND t.creator_id = $10
RETURNING *;

-- name: UpdateStoryInfo :one
UPDATE story_infos
SET title = $2,
    body = $3,
    content_format = $4,
    image_media_id = $5,
    related_character_ids = $6,
    related_clue_ids = $7,
    related_location_ids = $8,
    sort_order = $9,
    version = story_infos.version + 1,
    updated_at = NOW()
FROM themes t
WHERE story_infos.id = $1
  AND story_infos.theme_id = t.id
  AND t.creator_id = $11
  AND story_infos.version = $10
RETURNING story_infos.*;

-- name: DeleteStoryInfoWithOwner :one
DELETE FROM story_infos si USING themes t
WHERE si.id = $1 AND si.theme_id = t.id AND t.creator_id = $2
RETURNING si.theme_id;

-- name: DeleteStoryInfoMediaRefs :exec
DELETE FROM story_info_media_refs
WHERE story_info_id = $1;

-- name: CreateStoryInfoMediaRef :exec
INSERT INTO story_info_media_refs (
  story_info_id,
  media_id,
  usage,
  sort_order
)
VALUES ($1, $2, $3, $4);
