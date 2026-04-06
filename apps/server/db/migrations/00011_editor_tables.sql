-- +goose Up

-- 맵 테이블
CREATE TABLE theme_maps (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id   UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    image_url  TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_theme_maps_theme ON theme_maps(theme_id);

-- 위치 테이블
CREATE TABLE theme_locations (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id              UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    map_id                UUID NOT NULL REFERENCES theme_maps(id) ON DELETE CASCADE,
    name                  VARCHAR(100) NOT NULL,
    restricted_characters TEXT,
    sort_order            INT NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_theme_locations_map ON theme_locations(map_id);
CREATE INDEX idx_theme_locations_theme ON theme_locations(theme_id);

-- 단서 테이블
CREATE TABLE theme_clues (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    location_id UUID REFERENCES theme_locations(id) ON DELETE SET NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    image_url   TEXT,
    is_common   BOOLEAN NOT NULL DEFAULT FALSE,
    level       INT NOT NULL DEFAULT 1,
    clue_type   VARCHAR(30) NOT NULL DEFAULT 'normal',
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_theme_clues_theme ON theme_clues(theme_id);
CREATE INDEX idx_theme_clues_location ON theme_clues(location_id);

-- 콘텐츠 테이블 (스토리, 역할 등 마크다운)
CREATE TABLE theme_contents (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id   UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    key        VARCHAR(100) NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(theme_id, key),
    CONSTRAINT valid_content_key CHECK (key ~ '^(story|rules|epilogue|role:[a-z0-9_-]{1,50})$')
);
CREATE INDEX idx_theme_contents_theme ON theme_contents(theme_id);

-- +goose Down
DROP TABLE IF EXISTS theme_contents;
DROP TABLE IF EXISTS theme_clues;
DROP TABLE IF EXISTS theme_locations;
DROP TABLE IF EXISTS theme_maps;
