-- +goose Up

ALTER TABLE story_infos
ADD COLUMN content_format VARCHAR(32) NOT NULL DEFAULT 'mdx_v1'
    CHECK (content_format IN ('mdx_v1'));

CREATE TABLE story_info_media_refs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_info_id UUID NOT NULL REFERENCES story_infos(id) ON DELETE CASCADE,
    media_id      UUID NOT NULL REFERENCES theme_media(id) ON DELETE RESTRICT,
    usage         VARCHAR(32) NOT NULL CHECK (usage IN ('cover', 'embedded_image', 'embedded_video')),
    sort_order    INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_story_info_media_refs_story_info ON story_info_media_refs(story_info_id, sort_order);
CREATE INDEX idx_story_info_media_refs_media ON story_info_media_refs(media_id);

-- +goose Down
DROP TABLE IF EXISTS story_info_media_refs;

ALTER TABLE story_infos
DROP COLUMN IF EXISTS content_format;
