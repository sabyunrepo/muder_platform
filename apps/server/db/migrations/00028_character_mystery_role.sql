-- +goose Up
ALTER TABLE theme_characters
  ADD COLUMN mystery_role VARCHAR(20) NOT NULL DEFAULT 'suspect';

UPDATE theme_characters
SET mystery_role = CASE WHEN is_culprit THEN 'culprit' ELSE 'suspect' END;

ALTER TABLE theme_characters
  ADD CONSTRAINT valid_character_mystery_role
  CHECK (mystery_role IN ('suspect', 'culprit', 'accomplice', 'detective'));

CREATE INDEX idx_theme_characters_mystery_role
  ON theme_characters(theme_id, mystery_role);

-- +goose Down
DROP INDEX IF EXISTS idx_theme_characters_mystery_role;

ALTER TABLE theme_characters
  DROP CONSTRAINT IF EXISTS valid_character_mystery_role;

ALTER TABLE theme_characters
  DROP COLUMN IF EXISTS mystery_role;
