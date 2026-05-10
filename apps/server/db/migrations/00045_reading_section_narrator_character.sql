-- +goose Up

ALTER TABLE reading_sections
ADD COLUMN narrator_character_id UUID REFERENCES theme_characters(id) ON DELETE SET NULL;

-- +goose Down

ALTER TABLE reading_sections
DROP COLUMN IF EXISTS narrator_character_id;
