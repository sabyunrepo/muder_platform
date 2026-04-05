-- name: GetSession :one
SELECT * FROM game_sessions WHERE id = $1;

-- name: CreateSession :one
INSERT INTO game_sessions (room_id, theme_id) VALUES ($1, $2) RETURNING *;

-- name: UpdateSessionPhase :exec
UPDATE game_sessions SET current_phase = $2, phase_index = $3 WHERE id = $1;

-- name: UpdateSessionState :exec
UPDATE game_sessions SET state_json = $2 WHERE id = $1;

-- name: EndSession :exec
UPDATE game_sessions SET ended_at = NOW() WHERE id = $1;

-- name: GetSessionPlayers :many
SELECT * FROM session_players WHERE session_id = $1;

-- name: AddSessionPlayer :exec
INSERT INTO session_players (session_id, user_id, character_id) VALUES ($1, $2, $3);

-- name: UpdatePlayerScore :exec
UPDATE session_players SET score = score + $3 WHERE session_id = $1 AND user_id = $2;

-- name: SetPlayerAlive :exec
UPDATE session_players SET is_alive = $3 WHERE session_id = $1 AND user_id = $2;

-- name: AddSessionEvent :one
INSERT INTO session_events (session_id, type, payload) VALUES ($1, $2, $3) RETURNING *;

-- name: GetSessionEvents :many
SELECT * FROM session_events WHERE session_id = $1 ORDER BY id;
