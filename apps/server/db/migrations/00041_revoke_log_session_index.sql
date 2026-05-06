-- +goose Up
-- Speed up session-targeted revoke checks used by IsSessionRevoked.
-- Most revoke rows are user-wide or token-targeted, so keep the index partial.
CREATE INDEX idx_revoke_log_session_id
    ON revoke_log (session_id)
    WHERE session_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_revoke_log_session_id;
