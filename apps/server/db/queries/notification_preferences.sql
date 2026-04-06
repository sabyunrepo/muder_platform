-- name: GetNotificationPrefs :one
SELECT * FROM notification_preferences WHERE user_id = $1;

-- name: UpsertNotificationPrefs :one
INSERT INTO notification_preferences (user_id, game_invite, room_status, marketing, updated_at)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (user_id) DO UPDATE SET
    game_invite = EXCLUDED.game_invite,
    room_status = EXCLUDED.room_status,
    marketing = EXCLUDED.marketing,
    updated_at = NOW()
RETURNING *;
