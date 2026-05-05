-- +goose Up
ALTER TABLE theme_media DROP CONSTRAINT valid_media_type;
ALTER TABLE theme_media ADD CONSTRAINT valid_media_type CHECK (type IN ('BGM', 'SFX', 'VOICE', 'VIDEO', 'DOCUMENT', 'IMAGE'));

-- +goose Down
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM theme_media WHERE type = 'IMAGE') THEN
    RAISE EXCEPTION 'Cannot downgrade: IMAGE media exists';
  END IF;
END $$;

ALTER TABLE theme_media DROP CONSTRAINT valid_media_type;
ALTER TABLE theme_media ADD CONSTRAINT valid_media_type CHECK (type IN ('BGM', 'SFX', 'VOICE', 'VIDEO', 'DOCUMENT'));
