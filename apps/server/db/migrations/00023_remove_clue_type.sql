-- +goose Up
ALTER TABLE theme_clues DROP COLUMN IF EXISTS clue_type;

-- +goose Down
ALTER TABLE theme_clues ADD COLUMN clue_type VARCHAR(20) NOT NULL DEFAULT 'normal';
