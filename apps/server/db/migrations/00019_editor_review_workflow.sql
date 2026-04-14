-- +goose Up

-- themes: review workflow fields
ALTER TABLE themes ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);

-- users: trusted creator flag (skips review queue on publish)
ALTER TABLE users ADD COLUMN IF NOT EXISTS trusted_creator BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE themes DROP COLUMN IF EXISTS reviewed_by;
ALTER TABLE themes DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE themes DROP COLUMN IF EXISTS review_note;
ALTER TABLE users DROP COLUMN IF EXISTS trusted_creator;
