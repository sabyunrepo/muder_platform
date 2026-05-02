-- +goose Up
ALTER TABLE theme_contents
  DROP CONSTRAINT IF EXISTS valid_content_key;

ALTER TABLE theme_contents
  ADD CONSTRAINT valid_content_key
  CHECK (key ~ '^(story|rules|epilogue|role:[a-z0-9_-]{1,50}|role_sheet:[a-zA-Z0-9_-]{1,64})$');

-- +goose Down
ALTER TABLE theme_contents
  DROP CONSTRAINT IF EXISTS valid_content_key;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM theme_contents
    WHERE key ~ '^role_sheet:'
  ) THEN
    RAISE EXCEPTION 'Cannot downgrade: role_sheet data exists in theme_contents';
  END IF;
END $$;

ALTER TABLE theme_contents
  ADD CONSTRAINT valid_content_key
  CHECK (key ~ '^(story|rules|epilogue|role:[a-z0-9_-]{1,50})$');
