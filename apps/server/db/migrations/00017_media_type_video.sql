-- +goose Up

ALTER TABLE theme_media DROP CONSTRAINT valid_media_type;
ALTER TABLE theme_media ADD CONSTRAINT valid_media_type CHECK (type IN ('BGM', 'SFX', 'VOICE', 'VIDEO'));

-- VIDEO type requires YOUTUBE source (FileVideoPlayer is not implemented in Phase 7.7)
ALTER TABLE theme_media ADD CONSTRAINT video_requires_youtube CHECK (
    type != 'VIDEO' OR source_type = 'YOUTUBE'
);

-- +goose Down

ALTER TABLE theme_media DROP CONSTRAINT video_requires_youtube;
ALTER TABLE theme_media DROP CONSTRAINT valid_media_type;
ALTER TABLE theme_media ADD CONSTRAINT valid_media_type CHECK (type IN ('BGM', 'SFX', 'VOICE'));
