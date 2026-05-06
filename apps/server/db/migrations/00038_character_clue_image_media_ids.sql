-- +goose Up
ALTER TABLE theme_characters
  ADD COLUMN image_media_id UUID REFERENCES theme_media(id) ON DELETE SET NULL,
  ADD COLUMN endcard_image_media_id UUID REFERENCES theme_media(id) ON DELETE SET NULL;

ALTER TABLE theme_clues
  ADD COLUMN image_media_id UUID REFERENCES theme_media(id) ON DELETE SET NULL;

CREATE INDEX idx_theme_characters_image_media
  ON theme_characters(image_media_id)
  WHERE image_media_id IS NOT NULL;

CREATE INDEX idx_theme_characters_endcard_image_media
  ON theme_characters(endcard_image_media_id)
  WHERE endcard_image_media_id IS NOT NULL;

CREATE INDEX idx_theme_clues_image_media
  ON theme_clues(image_media_id)
  WHERE image_media_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_theme_clues_image_media;
DROP INDEX IF EXISTS idx_theme_characters_endcard_image_media;
DROP INDEX IF EXISTS idx_theme_characters_image_media;

ALTER TABLE theme_clues
  DROP COLUMN IF EXISTS image_media_id;

ALTER TABLE theme_characters
  DROP COLUMN IF EXISTS endcard_image_media_id,
  DROP COLUMN IF EXISTS image_media_id;
