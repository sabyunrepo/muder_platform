-- +goose Up
CREATE TABLE notification_preferences (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    game_invite     BOOLEAN NOT NULL DEFAULT true,
    room_status     BOOLEAN NOT NULL DEFAULT true,
    marketing       BOOLEAN NOT NULL DEFAULT false,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS notification_preferences;
