-- +goose Up

CREATE TABLE theme_media_categories (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id   UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    name       VARCHAR(80) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT theme_media_categories_theme_id_id_unique UNIQUE (theme_id, id)
);

CREATE UNIQUE INDEX idx_theme_media_categories_theme_lower_name
  ON theme_media_categories(theme_id, lower(name));

CREATE INDEX idx_theme_media_categories_theme_sort
  ON theme_media_categories(theme_id, sort_order, created_at);

ALTER TABLE theme_media
  ADD COLUMN category_id UUID,
  ADD CONSTRAINT theme_media_category_same_theme_fk
    FOREIGN KEY (theme_id, category_id)
    REFERENCES theme_media_categories(theme_id, id)
    ON DELETE SET NULL;

CREATE INDEX idx_theme_media_category
  ON theme_media(theme_id, category_id, sort_order, created_at);

CREATE TABLE theme_media_replacement_uploads (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_id    UUID NOT NULL REFERENCES theme_media(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    file_size   BIGINT NOT NULL,
    mime_type   VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_theme_media_replacements_media
  ON theme_media_replacement_uploads(media_id, created_at);

-- +goose Down
DROP INDEX IF EXISTS idx_theme_media_replacements_media;
DROP TABLE IF EXISTS theme_media_replacement_uploads;

DROP INDEX IF EXISTS idx_theme_media_category;
ALTER TABLE theme_media
  DROP CONSTRAINT IF EXISTS theme_media_category_same_theme_fk,
  DROP COLUMN IF EXISTS category_id;

DROP INDEX IF EXISTS idx_theme_media_categories_theme_sort;
DROP INDEX IF EXISTS idx_theme_media_categories_theme_lower_name;
DROP TABLE IF EXISTS theme_media_categories;
