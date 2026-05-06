-- +goose Up
ALTER TABLE themes
  ADD COLUMN cover_image_media_id UUID REFERENCES theme_media(id) ON DELETE SET NULL;

ALTER TABLE theme_maps
  ADD COLUMN image_media_id UUID REFERENCES theme_media(id) ON DELETE SET NULL;

CREATE INDEX idx_themes_cover_image_media
  ON themes(cover_image_media_id)
  WHERE cover_image_media_id IS NOT NULL;

CREATE INDEX idx_theme_maps_image_media
  ON theme_maps(image_media_id)
  WHERE image_media_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_theme_maps_image_media;
DROP INDEX IF EXISTS idx_themes_cover_image_media;

ALTER TABLE theme_maps
  DROP COLUMN IF EXISTS image_media_id;

ALTER TABLE themes
  DROP COLUMN IF EXISTS cover_image_media_id;
