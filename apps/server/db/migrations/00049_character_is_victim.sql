-- +goose Up
ALTER TABLE theme_characters
  ADD COLUMN is_victim BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE theme_characters
  DROP COLUMN IF EXISTS is_victim;
