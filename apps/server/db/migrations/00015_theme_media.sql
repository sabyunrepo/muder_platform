-- +goose Up

CREATE TABLE theme_media (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    type        VARCHAR(10) NOT NULL,
    source_type VARCHAR(10) NOT NULL,
    url         TEXT,
    storage_key TEXT,
    duration    INT,
    file_size   BIGINT DEFAULT 0,
    mime_type   VARCHAR(50),
    tags        TEXT[] NOT NULL DEFAULT '{}',
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_media_type CHECK (type IN ('BGM', 'SFX', 'VOICE')),
    CONSTRAINT valid_source_type CHECK (source_type IN ('FILE', 'YOUTUBE')),
    CONSTRAINT file_requires_storage CHECK (
        source_type != 'FILE' OR (storage_key IS NOT NULL AND mime_type IS NOT NULL)
    ),
    CONSTRAINT youtube_requires_url CHECK (
        source_type != 'YOUTUBE' OR url IS NOT NULL
    )
);

CREATE INDEX idx_theme_media_theme ON theme_media(theme_id);
CREATE INDEX idx_theme_media_type ON theme_media(theme_id, type);

-- +goose Down
DROP TABLE IF EXISTS theme_media;
