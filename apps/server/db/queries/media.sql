-- ============================================================
-- Media
-- ============================================================

-- name: ListMediaByTheme :many
SELECT * FROM theme_media WHERE theme_id = $1 ORDER BY sort_order, created_at;

-- name: ListMediaByThemeAndType :many
SELECT * FROM theme_media WHERE theme_id = $1 AND type = $2 ORDER BY sort_order, created_at;

-- name: ListMediaByThemeAndCategory :many
SELECT * FROM theme_media
WHERE theme_id = sqlc.arg('theme_id')
  AND category_id = sqlc.arg('category_id')
ORDER BY sort_order, created_at;

-- name: ListMediaByThemeTypeAndCategory :many
SELECT * FROM theme_media
WHERE theme_id = sqlc.arg('theme_id')
  AND type = sqlc.arg('type')
  AND category_id = sqlc.arg('category_id')
ORDER BY sort_order, created_at;

-- name: GetMedia :one
SELECT * FROM theme_media WHERE id = $1;

-- name: GetMediaForSession :one
SELECT m.*
FROM theme_media m
JOIN game_sessions s ON s.theme_id = m.theme_id
WHERE s.id = sqlc.arg('session_id')
  AND m.id = sqlc.arg('media_id');

-- name: CreateMedia :one
INSERT INTO theme_media (theme_id, name, type, source_type, url, storage_key, duration, file_size, mime_type, tags, sort_order, category_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- name: UpdateMedia :one
UPDATE theme_media SET name = $2, type = $3, duration = $4, tags = $5, sort_order = $6, category_id = $7, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateMediaFileWithOwner :one
UPDATE theme_media m
SET source_type = 'FILE',
    url = NULL,
    storage_key = $3,
    file_size = $4,
    mime_type = $5,
    duration = NULL,
    updated_at = NOW()
FROM themes t
WHERE m.id = $1 AND m.theme_id = t.id AND t.creator_id = $2
RETURNING m.*;

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
-- Media Categories
-- ============================================================

-- name: ListMediaCategoriesByTheme :many
SELECT * FROM theme_media_categories
WHERE theme_id = $1
ORDER BY sort_order, created_at;

-- name: GetMediaCategoryWithOwner :one
SELECT c.* FROM theme_media_categories c
JOIN themes t ON c.theme_id = t.id
WHERE c.id = $1 AND t.creator_id = $2;

-- name: CreateMediaCategory :one
INSERT INTO theme_media_categories (theme_id, name, sort_order)
SELECT $1, $2, $3
FROM themes t
WHERE t.id = $1 AND t.creator_id = $4
RETURNING *;

-- name: UpdateMediaCategory :one
UPDATE theme_media_categories c
SET name = $2, sort_order = $3, updated_at = NOW()
FROM themes t
WHERE c.id = $1 AND c.theme_id = t.id AND t.creator_id = $4
RETURNING c.*;

-- name: DeleteMediaCategoryWithOwner :execrows
DELETE FROM theme_media_categories c USING themes t
WHERE c.id = $1 AND c.theme_id = t.id AND t.creator_id = $2;

-- ============================================================
-- Media Replacement Uploads
-- ============================================================

-- name: CreateMediaReplacementUpload :one
INSERT INTO theme_media_replacement_uploads (media_id, storage_key, file_size, mime_type)
SELECT $1, $2, $3, $4
FROM theme_media m
JOIN themes t ON m.theme_id = t.id
WHERE m.id = $1 AND t.creator_id = $5
RETURNING *;

-- name: GetMediaReplacementUploadWithOwner :one
SELECT r.* FROM theme_media_replacement_uploads r
JOIN theme_media m ON r.media_id = m.id
JOIN themes t ON m.theme_id = t.id
WHERE r.id = $1 AND t.creator_id = $2;

-- name: DeleteMediaReplacementUpload :exec
DELETE FROM theme_media_replacement_uploads WHERE id = $1;

-- ============================================================
-- Media Reference Cleanup
-- ============================================================

-- name: ClearReadingSectionMediaReferencesWithOwner :execrows
UPDATE reading_sections rs
SET bgm_media_id = CASE
      WHEN rs.bgm_media_id = sqlc.arg('media_id')::uuid THEN NULL
      ELSE rs.bgm_media_id
    END,
    lines = COALESCE((
      SELECT jsonb_agg(
        line
          - CASE WHEN line->>'VoiceMediaID' = sqlc.arg('media_id')::text THEN 'VoiceMediaID' ELSE '__noop__' END
          - CASE WHEN line->>'ImageMediaID' = sqlc.arg('media_id')::text THEN 'ImageMediaID' ELSE '__noop__' END
        ORDER BY ord
      )
      FROM jsonb_array_elements(rs.lines) WITH ORDINALITY AS elem(line, ord)
    ), '[]'::jsonb),
    version = rs.version + 1,
    updated_at = NOW()
FROM themes t
WHERE rs.theme_id = t.id
  AND t.creator_id = sqlc.arg('creator_id')
  AND rs.theme_id = sqlc.arg('theme_id')
  AND (
    rs.bgm_media_id = sqlc.arg('media_id')::uuid
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(rs.lines) AS line
      WHERE line->>'VoiceMediaID' = sqlc.arg('media_id')::text
         OR line->>'ImageMediaID' = sqlc.arg('media_id')::text
    )
  );

-- name: ClearRoleSheetMediaReferencesWithOwner :execrows
UPDATE theme_contents c
SET body = jsonb_set(
      regexp_replace(
        c.body,
        '"media_id"\s*:\s*"' || sqlc.arg('media_id')::text || '"',
        '"media_id":null',
        'g'
      )::jsonb,
      '{images,image_media_ids}',
      COALESCE((
        SELECT jsonb_agg(page_id ORDER BY ord)
        FROM jsonb_array_elements_text(
          COALESCE(
            regexp_replace(
              c.body,
              '"media_id"\s*:\s*"' || sqlc.arg('media_id')::text || '"',
              '"media_id":null',
              'g'
            )::jsonb #> '{images,image_media_ids}',
            '[]'::jsonb
          )
        ) WITH ORDINALITY AS elem(page_id, ord)
        WHERE page_id <> sqlc.arg('media_id')::text
      ), '[]'::jsonb),
      true
    )::text,
    updated_at = NOW()
FROM themes t
WHERE c.theme_id = t.id
  AND t.creator_id = sqlc.arg('creator_id')
  AND c.theme_id = sqlc.arg('theme_id')
  AND c.key ~ '^role_sheet:'
  AND c.body ~ sqlc.arg('media_id')::text;

-- name: ClearCharacterAliasIconMediaReferencesWithOwner :execrows
UPDATE theme_characters c
SET alias_rules = regexp_replace(
      c.alias_rules::text,
      '"display_icon_media_id"\s*:\s*"' || sqlc.arg('media_id')::text || '"',
      '"display_icon_media_id":null',
      'g'
    )::jsonb,
    updated_at = NOW()
FROM themes t
WHERE c.theme_id = t.id
  AND t.creator_id = sqlc.arg('creator_id')
  AND c.theme_id = sqlc.arg('theme_id')
  AND c.alias_rules::text ~ ('"display_icon_media_id"\s*:\s*"' || sqlc.arg('media_id')::text || '"');

-- name: ClearThemeCoverMediaReferencesWithOwner :execrows
UPDATE themes
SET cover_image_media_id = NULL,
    updated_at = NOW()
WHERE id = sqlc.arg('theme_id')
  AND creator_id = sqlc.arg('creator_id')
  AND cover_image_media_id = sqlc.arg('media_id');

-- name: ClearMapMediaReferencesWithOwner :execrows
UPDATE theme_maps m
SET image_media_id = NULL
FROM themes t
WHERE m.theme_id = t.id
  AND t.creator_id = sqlc.arg('creator_id')
  AND m.theme_id = sqlc.arg('theme_id')
  AND m.image_media_id = sqlc.arg('media_id');

-- name: FindRoleSheetReferencesForMedia :many
SELECT id, key, body
FROM theme_contents
WHERE theme_id = $1
  AND key ~ '^role_sheet:'
  AND body ~ $2;

-- name: FindCharacterAliasIconReferencesForMedia :many
SELECT id, name
FROM theme_characters
WHERE theme_id = sqlc.arg('theme_id')
  AND alias_rules::text ~ ('"display_icon_media_id"\s*:\s*"' || sqlc.arg('media_id')::text || '"');

-- name: FindThemeCoverReferencesForMedia :many
SELECT id, title
FROM themes
WHERE id = sqlc.arg('theme_id')
  AND cover_image_media_id = sqlc.arg('media_id');

-- name: FindMapReferencesForMedia :many
SELECT id, name
FROM theme_maps
WHERE theme_id = sqlc.arg('theme_id')
  AND image_media_id = sqlc.arg('media_id');

-- ============================================================
-- Media (Batch)
-- ============================================================

-- name: ListMediaByIDs :many
SELECT * FROM theme_media WHERE id = ANY($1::uuid[]);
