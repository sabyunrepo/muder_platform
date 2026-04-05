-- +goose Up

-- C1: Prevent negative coin balance at DB level
ALTER TABLE users ADD CONSTRAINT chk_users_coin_balance_non_negative CHECK (coin_balance >= 0);

-- I3: Remove redundant index (email UNIQUE already creates one)
DROP INDEX IF EXISTS idx_users_email;

-- I4: Remove redundant index (slug UNIQUE already creates one)
DROP INDEX IF EXISTS idx_themes_slug;

-- I7: Auto-update updated_at trigger function
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_themes_updated_at BEFORE UPDATE ON themes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- S3: Only one active session per room
CREATE UNIQUE INDEX idx_sessions_active_room ON game_sessions(room_id) WHERE ended_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_sessions_active_room;
DROP TRIGGER IF EXISTS trg_rooms_updated_at ON rooms;
DROP TRIGGER IF EXISTS trg_themes_updated_at ON themes;
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
DROP FUNCTION IF EXISTS set_updated_at();
CREATE INDEX idx_themes_slug ON themes(slug);
CREATE INDEX idx_users_email ON users(email);
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_coin_balance_non_negative;
