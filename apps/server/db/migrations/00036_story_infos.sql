-- +goose Up

CREATE TABLE story_infos (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id              UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    title                 VARCHAR(200) NOT NULL,
    body                  TEXT NOT NULL DEFAULT '',
    image_media_id        UUID REFERENCES theme_media(id) ON DELETE SET NULL,
    related_character_ids JSONB NOT NULL DEFAULT '[]',
    related_clue_ids      JSONB NOT NULL DEFAULT '[]',
    related_location_ids  JSONB NOT NULL DEFAULT '[]',
    sort_order            INT NOT NULL DEFAULT 0,
    version               INT NOT NULL DEFAULT 1,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_story_infos_theme ON story_infos(theme_id, sort_order);
CREATE INDEX idx_story_infos_image_media ON story_infos(image_media_id) WHERE image_media_id IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS story_infos;
