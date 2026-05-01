-- name: InsertRevoke :one
-- Append a revoke entry. user_id is required; session_id / token_jti /
-- revoked_by are optional and select the granularity:
--   * (user_id only)              — bans, password changes; whole user.
--   * (user_id, session_id)       — kick a specific WS session.
--   * (user_id, token_jti)        — logout-elsewhere; that token only.
INSERT INTO revoke_log (user_id, session_id, token_jti, reason, code, revoked_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: IsUserRevokedSince :one
-- True if any revoke for user_id is newer than `since`. The WS hub
-- middleware passes the connection's auth timestamp as `since` so a
-- pre-existing revoke from before login does not nuke the new session.
SELECT EXISTS (
    SELECT 1 FROM revoke_log
    WHERE user_id = $1 AND revoked_at > $2
) AS revoked;

-- name: IsTokenRevoked :one
-- Token-precision lookup used by auth.identify / auth.resume on
-- reconnect. Returns true if the supplied token_jti has any revoke row.
SELECT EXISTS (
    SELECT 1 FROM revoke_log
    WHERE token_jti = $1
) AS revoked;

-- name: IsSessionRevoked :one
-- Session-precision lookup. Used when a single WS session is kicked
-- without invalidating the user's other devices.
SELECT EXISTS (
    SELECT 1 FROM revoke_log
    WHERE session_id = $1
) AS revoked;

-- name: ListRecentRevokesForUser :many
-- Newest-first audit lookup for admin dashboards.
SELECT * FROM revoke_log
WHERE user_id = $1
ORDER BY revoked_at DESC
LIMIT $2;
