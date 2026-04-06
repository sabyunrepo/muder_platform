-- +goose Up

-- ── chat_rooms: updated_at 추가 ──
ALTER TABLE chat_rooms ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TRIGGER trg_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── chat_room_members: role 추가 ──
ALTER TABLE chat_room_members ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'MEMBER'
    CHECK (role IN ('OWNER', 'MEMBER'));

-- ── chat_messages: metadata, deleted_at, IMAGE 타입 ──
ALTER TABLE chat_messages ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE chat_messages ADD COLUMN deleted_at TIMESTAMPTZ;

-- CHECK 제약 교체 (IMAGE 타입 추가)
ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_message_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_message_type_check
    CHECK (message_type IN ('TEXT', 'IMAGE', 'SYSTEM', 'GAME_INVITE', 'GAME_RESULT'));

-- ── 새 인덱스 ──
CREATE INDEX idx_chat_messages_not_deleted ON chat_messages(chat_room_id, id DESC)
    WHERE deleted_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_chat_messages_not_deleted;
ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_message_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_message_type_check
    CHECK (message_type IN ('TEXT', 'SYSTEM', 'GAME_INVITE', 'GAME_RESULT'));
ALTER TABLE chat_messages DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE chat_messages DROP COLUMN IF EXISTS metadata;
ALTER TABLE chat_room_members DROP COLUMN IF EXISTS role;
DROP TRIGGER IF EXISTS trg_chat_rooms_updated_at ON chat_rooms;
ALTER TABLE chat_rooms DROP COLUMN IF EXISTS updated_at;
