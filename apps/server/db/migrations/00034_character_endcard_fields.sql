-- +goose Up
ALTER TABLE theme_characters
  ADD COLUMN endcard_title TEXT,
  ADD COLUMN endcard_body TEXT,
  ADD COLUMN endcard_image_url TEXT;

-- +goose Down
ALTER TABLE theme_characters
  DROP COLUMN IF EXISTS endcard_image_url,
  DROP COLUMN IF EXISTS endcard_body,
  DROP COLUMN IF EXISTS endcard_title;
