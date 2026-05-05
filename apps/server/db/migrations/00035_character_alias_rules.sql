-- +goose Up
ALTER TABLE theme_characters
  ADD COLUMN alias_rules JSONB NOT NULL DEFAULT '[]'::jsonb;

-- +goose Down
ALTER TABLE theme_characters
  DROP COLUMN IF EXISTS alias_rules;
