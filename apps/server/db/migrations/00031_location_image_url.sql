-- +goose Up
ALTER TABLE theme_locations
  ADD COLUMN image_url TEXT;

-- +goose Down
ALTER TABLE theme_locations
  DROP COLUMN IF EXISTS image_url;
