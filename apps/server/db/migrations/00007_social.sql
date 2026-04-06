-- +goose Up

-- ── 친구 관계 ──────────────────────────────────────────
CREATE TABLE friendships (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships(requester_id, status);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id, status);

-- ── 차단 ──────────────────────────────────────────────
CREATE TABLE user_blocks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);

-- ── 채팅방 ────────────────────────────────────────────
CREATE TABLE chat_rooms (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type        VARCHAR(10) NOT NULL DEFAULT 'DM'
                CHECK (type IN ('DM', 'GROUP')),
    name        VARCHAR(100),
    created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 채팅방 멤버 ──────────────────────────────────────
CREATE TABLE chat_room_members (
    chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_room_id, user_id)
);

CREATE INDEX idx_chat_members_user ON chat_room_members(user_id);

-- ── 채팅 메시지 ──────────────────────────────────────
CREATE TABLE chat_messages (
    id           BIGSERIAL PRIMARY KEY,
    chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content      TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT'
                 CHECK (message_type IN ('TEXT', 'SYSTEM', 'GAME_INVITE', 'GAME_RESULT')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_room ON chat_messages(chat_room_id, id DESC);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);

-- +goose Down
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_room_members;
DROP TABLE IF EXISTS chat_rooms;
DROP TABLE IF EXISTS user_blocks;
DROP TABLE IF EXISTS friendships;
