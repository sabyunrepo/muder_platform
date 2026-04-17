-- +goose Up
ALTER TABLE theme_clues DROP COLUMN IF EXISTS clue_type;

-- +goose Down
-- WARNING: irreversible data loss. Down restores the column with its default
-- 'normal' for every row; original per-row values (weapon / evidence / alibi
-- / etc.) cannot be recovered. Coordinate with a DB backup before running.
ALTER TABLE theme_clues ADD COLUMN clue_type VARCHAR(20) NOT NULL DEFAULT 'normal';
