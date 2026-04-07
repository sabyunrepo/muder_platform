-- +goose Up

CREATE TABLE reading_sections (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id     UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    name         VARCHAR(200) NOT NULL,
    bgm_media_id UUID REFERENCES theme_media(id) ON DELETE SET NULL,
    lines        JSONB NOT NULL DEFAULT '[]',
    sort_order   INT NOT NULL DEFAULT 0,
    version      INT NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reading_sections_theme ON reading_sections(theme_id, sort_order);

-- +goose Down
DROP TABLE IF EXISTS reading_sections;
