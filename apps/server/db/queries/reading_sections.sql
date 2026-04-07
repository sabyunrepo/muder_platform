-- ============================================================
-- Reading Sections
-- ============================================================

-- name: ListReadingSectionsByTheme :many
SELECT * FROM reading_sections WHERE theme_id = $1 ORDER BY sort_order, created_at;

-- name: GetReadingSection :one
SELECT * FROM reading_sections WHERE id = $1;

-- name: GetReadingSectionWithOwner :one
SELECT rs.* FROM reading_sections rs
JOIN themes t ON rs.theme_id = t.id
WHERE rs.id = $1 AND t.creator_id = $2;

-- name: CreateReadingSection :one
INSERT INTO reading_sections (theme_id, name, bgm_media_id, lines, sort_order)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateReadingSection :one
UPDATE reading_sections
SET name = $2,
    bgm_media_id = $3,
    lines = $4,
    sort_order = $5,
    version = version + 1,
    updated_at = NOW()
WHERE id = $1 AND version = $6
RETURNING *;

-- name: DeleteReadingSectionWithOwner :execrows
DELETE FROM reading_sections rs USING themes t
WHERE rs.id = $1 AND rs.theme_id = t.id AND t.creator_id = $2;

-- name: FindMediaReferencesInReadingSections :many
-- Returns reading sections that reference the given media as bgm_media_id
-- OR inside any line's VoiceMediaID (PascalCase key — matches engine struct serialization).
SELECT DISTINCT rs.id, rs.name FROM reading_sections rs
WHERE rs.theme_id = sqlc.arg('theme_id')
  AND (
    rs.bgm_media_id = sqlc.arg('media_id')::uuid
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(rs.lines) AS line
      WHERE line->>'VoiceMediaID' = sqlc.arg('media_id')::text
    )
  );
