-- +goose Up

ALTER TABLE theme_locations
  ADD COLUMN image_media_id UUID REFERENCES theme_media(id) ON DELETE SET NULL;

CREATE INDEX idx_theme_locations_image_media
  ON theme_locations(image_media_id)
  WHERE image_media_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_theme_locations_image_media;

ALTER TABLE theme_locations
  DROP COLUMN IF EXISTS image_media_id;
