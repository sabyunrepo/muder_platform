-- +goose Up

ALTER TABLE theme_locations
  ADD COLUMN public_description TEXT,
  ADD COLUMN entry_message TEXT,
  ADD COLUMN parent_location_id UUID REFERENCES theme_locations(id) ON DELETE SET NULL;

WITH meta AS (
  SELECT
    t.id AS theme_id,
    entry.key::uuid AS location_id,
    entry.value AS value
  FROM themes t
  CROSS JOIN LATERAL jsonb_each(t.config_json -> 'locationMeta') AS entry(key, value)
  WHERE jsonb_typeof(t.config_json -> 'locationMeta') = 'object'
    AND entry.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
normalized AS (
  SELECT
    m.theme_id,
    m.location_id,
    NULLIF(m.value ->> 'publicDescription', '') AS public_description,
    NULLIF(m.value ->> 'entryMessage', '') AS entry_message,
    CASE
      WHEN (m.value ->> 'parentLocationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (m.value ->> 'parentLocationId')::uuid
      ELSE NULL
    END AS candidate_parent_location_id
  FROM meta m
)
UPDATE theme_locations l
SET
  public_description = n.public_description,
  entry_message = n.entry_message,
  parent_location_id = CASE
    WHEN p.id IS NOT NULL AND p.id <> l.id THEN p.id
    ELSE NULL
  END
FROM normalized n
LEFT JOIN theme_locations p
  ON p.id = n.candidate_parent_location_id
 AND p.theme_id = n.theme_id
 AND p.map_id = (SELECT map_id FROM theme_locations WHERE id = n.location_id)
WHERE l.id = n.location_id
  AND l.theme_id = n.theme_id;

CREATE INDEX idx_theme_locations_parent
  ON theme_locations(parent_location_id)
  WHERE parent_location_id IS NOT NULL;

-- +goose Down

DROP INDEX IF EXISTS idx_theme_locations_parent;

ALTER TABLE theme_locations
  DROP COLUMN IF EXISTS parent_location_id,
  DROP COLUMN IF EXISTS entry_message,
  DROP COLUMN IF EXISTS public_description;
