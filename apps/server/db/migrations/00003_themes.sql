-- +goose Up
CREATE TABLE themes (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id   UUID NOT NULL REFERENCES users(id),
    title        VARCHAR(100) NOT NULL,
    slug         VARCHAR(100) UNIQUE NOT NULL,
    description  TEXT,
    cover_image  TEXT,
    min_players  INT NOT NULL DEFAULT 4,
    max_players  INT NOT NULL DEFAULT 8,
    duration_min INT NOT NULL DEFAULT 60,
    price        INT NOT NULL DEFAULT 0,
    status       VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    config_json  JSONB NOT NULL DEFAULT '{}',
    version      INT NOT NULL DEFAULT 1,
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_themes_creator ON themes(creator_id);
CREATE INDEX idx_themes_status ON themes(status);
CREATE INDEX idx_themes_slug ON themes(slug);

CREATE TABLE theme_characters (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    description TEXT,
    image_url   TEXT,
    is_culprit  BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_theme_characters_theme ON theme_characters(theme_id);

-- +goose Down
DROP TABLE IF EXISTS theme_characters;
DROP TABLE IF EXISTS themes;
