-- +goose Up
ALTER TABLE theme_characters
  ADD COLUMN is_playable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN show_in_intro BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN can_speak_in_reading BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN is_voting_candidate BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE theme_characters
SET is_voting_candidate = FALSE
WHERE mystery_role = 'detective';

CREATE INDEX idx_theme_characters_visibility
  ON theme_characters(theme_id, is_playable, show_in_intro, is_voting_candidate);

-- +goose Down
DROP INDEX IF EXISTS idx_theme_characters_visibility;

ALTER TABLE theme_characters
  DROP COLUMN IF EXISTS is_voting_candidate,
  DROP COLUMN IF EXISTS can_speak_in_reading,
  DROP COLUMN IF EXISTS show_in_intro,
  DROP COLUMN IF EXISTS is_playable;
