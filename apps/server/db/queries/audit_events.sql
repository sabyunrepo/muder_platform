-- name: AppendAuditEvent :one
-- Game-bound audit row. session_id + seq are required; user_id is optional
-- but commonly set for player-triggered events so dashboards can correlate
-- by both axes.
INSERT INTO audit_events (session_id, seq, actor_id, user_id, action, module_id, payload)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: AppendUserAuditEvent :one
-- Identity-bound audit row (Phase 19 PR-6). Used for auth/admin/review/
-- editor actions that occur outside any game session; session_id and seq
-- stay NULL and the partial UNIQUE index is not engaged.
INSERT INTO audit_events (session_id, seq, actor_id, user_id, action, module_id, payload)
VALUES (NULL, NULL, $1, $2, $3, $4, $5)
RETURNING *;

-- name: ListBySession :many
SELECT * FROM audit_events
WHERE session_id = $1
ORDER BY seq;

-- name: ListByUser :many
-- Newest-first lookup for admin dashboards. user_id is the target user
-- (may equal actor_id for self-initiated events like login).
SELECT * FROM audit_events
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: LatestSeq :one
SELECT COALESCE(MAX(seq), 0)::bigint AS seq
FROM audit_events
WHERE session_id = $1;
