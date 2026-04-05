-- +goose Up
CREATE TABLE rooms (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_id    UUID NOT NULL REFERENCES themes(id),
    host_id     UUID NOT NULL REFERENCES users(id),
    code        VARCHAR(6) UNIQUE NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    max_players INT NOT NULL,
    is_private  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_host ON rooms(host_id);

CREATE TABLE room_players (
    room_id      UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id),
    character_id UUID REFERENCES theme_characters(id),
    is_ready     BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

-- +goose Down
DROP TABLE IF EXISTS room_players;
DROP TABLE IF EXISTS rooms;
