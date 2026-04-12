-- name: AppendAuditEvent :one
INSERT INTO audit_events (session_id, seq, actor_id, action, module_id, payload)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListBySession :many
SELECT * FROM audit_events
WHERE session_id = $1
ORDER BY seq;

-- name: LatestSeq :one
SELECT COALESCE(MAX(seq), 0)::bigint AS seq
FROM audit_events
WHERE session_id = $1;
