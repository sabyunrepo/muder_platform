-- +goose Up
CREATE TABLE game_sessions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id       UUID NOT NULL REFERENCES rooms(id),
    theme_id      UUID NOT NULL REFERENCES themes(id),
    current_phase VARCHAR(50) NOT NULL DEFAULT '',
    phase_index   INT NOT NULL DEFAULT 0,
    state_json    JSONB NOT NULL DEFAULT '{}',
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at      TIMESTAMPTZ
);

CREATE INDEX idx_sessions_room ON game_sessions(room_id);

CREATE TABLE session_players (
    session_id   UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id),
    character_id UUID NOT NULL REFERENCES theme_characters(id),
    score        INT NOT NULL DEFAULT 0,
    is_alive     BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (session_id, user_id)
);

CREATE TABLE session_events (
    id         BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_events_session ON session_events(session_id, id);

-- +goose Down
DROP TABLE IF EXISTS session_events;
DROP TABLE IF EXISTS session_players;
DROP TABLE IF EXISTS game_sessions;
