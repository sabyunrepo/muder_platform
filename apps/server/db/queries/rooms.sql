-- name: GetRoom :one
SELECT * FROM rooms WHERE id = $1;

-- name: GetRoomByCode :one
SELECT * FROM rooms WHERE code = $1;

-- name: ListWaitingRooms :many
SELECT * FROM rooms WHERE status = 'WAITING' AND is_private = FALSE ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: ListWaitingRoomsWithCount :many
SELECT r.*, (SELECT count(*) FROM room_players rp WHERE rp.room_id = r.id)::int AS player_count
FROM rooms r
WHERE r.status = 'WAITING' AND r.is_private = FALSE
ORDER BY r.created_at DESC LIMIT $1 OFFSET $2;

-- name: GetRoomForUpdate :one
SELECT * FROM rooms WHERE id = $1 FOR UPDATE;

-- name: GetRoomPlayerCount :one
SELECT count(*) FROM room_players WHERE room_id = $1;

-- name: CreateRoom :one
INSERT INTO rooms (theme_id, host_id, code, max_players, is_private)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateRoomStatus :exec
UPDATE rooms SET status = $2, updated_at = NOW() WHERE id = $1;

-- name: GetRoomPlayers :many
SELECT * FROM room_players WHERE room_id = $1;

-- name: AddRoomPlayer :exec
INSERT INTO room_players (room_id, user_id) VALUES ($1, $2);

-- name: RemoveRoomPlayer :exec
DELETE FROM room_players WHERE room_id = $1 AND user_id = $2;

-- name: SetPlayerReady :exec
UPDATE room_players SET is_ready = $3 WHERE room_id = $1 AND user_id = $2;
