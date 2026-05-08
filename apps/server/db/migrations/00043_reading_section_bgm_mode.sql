-- +goose Up

ALTER TABLE reading_sections
ADD COLUMN bgm_mode VARCHAR(16) NOT NULL DEFAULT 'loop'
CHECK (bgm_mode IN ('loop', 'once'));

-- +goose Down
ALTER TABLE reading_sections
DROP COLUMN IF EXISTS bgm_mode;
