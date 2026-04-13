-- +goose Up
ALTER TABLE theme_clues
  ADD COLUMN is_usable     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN use_effect    TEXT,
  ADD COLUMN use_target    TEXT,
  ADD COLUMN use_consumed  BOOLEAN NOT NULL DEFAULT TRUE;

-- +goose Down
ALTER TABLE theme_clues
  DROP COLUMN IF EXISTS use_consumed,
  DROP COLUMN IF EXISTS use_target,
  DROP COLUMN IF EXISTS use_effect,
  DROP COLUMN IF EXISTS is_usable;
