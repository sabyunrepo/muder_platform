-- +goose Up
ALTER TABLE theme_media
  ADD CONSTRAINT theme_media_theme_id_id_unique UNIQUE (theme_id, id);

ALTER TABLE themes
  ADD COLUMN cover_image_media_id UUID,
  ADD CONSTRAINT themes_cover_image_media_same_theme_fk
    FOREIGN KEY (id, cover_image_media_id)
    REFERENCES theme_media(theme_id, id)
    ON DELETE SET NULL (cover_image_media_id);

ALTER TABLE theme_maps
  ADD COLUMN image_media_id UUID,
  ADD CONSTRAINT theme_maps_image_media_same_theme_fk
    FOREIGN KEY (theme_id, image_media_id)
    REFERENCES theme_media(theme_id, id)
    ON DELETE SET NULL (image_media_id);

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
  DROP CONSTRAINT IF EXISTS theme_maps_image_media_same_theme_fk,
  DROP COLUMN IF EXISTS image_media_id;

ALTER TABLE themes
  DROP CONSTRAINT IF EXISTS themes_cover_image_media_same_theme_fk,
  DROP COLUMN IF EXISTS cover_image_media_id;

ALTER TABLE theme_media
  DROP CONSTRAINT IF EXISTS theme_media_theme_id_id_unique;
