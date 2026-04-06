-- ═══════════════════════════════════════════════════════════════════
-- Friendships
-- ══════════���════════════��═══════════════════════════════════════════

-- name: CreateFriendRequest :one
INSERT INTO friendships (requester_id, addressee_id, status)
VALUES ($1, $2, 'PENDING')
RETURNING *;

-- name: AcceptFriendRequest :one
UPDATE friendships SET status = 'ACCEPTED', updated_at = NOW()
WHERE id = $1 AND addressee_id = $2 AND status = 'PENDING'
RETURNING *;

-- name: RejectFriendRequest :exec
UPDATE friendships SET status = 'REJECTED', updated_at = NOW()
WHERE id = $1 AND addressee_id = $2 AND status = 'PENDING';

-- name: DeleteFriendship :exec
DELETE FROM friendships
WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2);

-- name: GetFriendship :one
SELECT * FROM friendships WHERE id = $1;

-- name: GetFriendshipBetween :one
SELECT * FROM friendships
WHERE (requester_id = $1 AND addressee_id = $2)
   OR (requester_id = $2 AND addressee_id = $1);

-- name: ListFriends :many
SELECT u.id, u.nickname, u.avatar_url, u.role, f.id AS friendship_id, f.created_at
FROM friendships f
JOIN users u ON (
    CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END = u.id
)
WHERE (f.requester_id = $1 OR f.addressee_id = $1)
  AND f.status = 'ACCEPTED'
ORDER BY u.nickname
LIMIT $2 OFFSET $3;

-- name: CountFriends :one
SELECT COUNT(*) FROM friendships
WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'ACCEPTED';

-- name: ListPendingRequests :many
SELECT f.*, u.nickname AS requester_nickname, u.avatar_url AS requester_avatar
FROM friendships f
JOIN users u ON f.requester_id = u.id
WHERE f.addressee_id = $1 AND f.status = 'PENDING'
ORDER BY f.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPendingRequests :one
SELECT COUNT(*) FROM friendships
WHERE addressee_id = $1 AND status = 'PENDING';

-- ═══════��══════════════════════���══════════════════════════════���═════
-- User Blocks
-- ════════════════��═══════════════════════════════════════════════��══

-- name: CreateBlock :one
INSERT INTO user_blocks (blocker_id, blocked_id)
VALUES ($1, $2)
RETURNING *;

-- name: DeleteBlock :exec
DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2;

-- name: ListBlocks :many
SELECT ub.*, u.nickname AS blocked_nickname, u.avatar_url AS blocked_avatar
FROM user_blocks ub
JOIN users u ON ub.blocked_id = u.id
WHERE ub.blocker_id = $1
ORDER BY ub.created_at DESC
LIMIT $2 OFFSET $3;

-- name: IsBlocked :one
SELECT EXISTS(
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = $1 AND blocked_id = $2)
       OR (blocker_id = $2 AND blocked_id = $1)
) AS is_blocked;

-- ════════��═════════════════════════════════════════════════════════���
-- Chat Rooms
-- ══���════════════════════════════���═══════════════════════════���═══════

-- name: CreateChatRoom :one
INSERT INTO chat_rooms (type, name, created_by)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetChatRoom :one
SELECT * FROM chat_rooms WHERE id = $1;

-- name: FindDMRoom :one
SELECT cr.* FROM chat_rooms cr
JOIN chat_room_members m1 ON cr.id = m1.chat_room_id AND m1.user_id = $1
JOIN chat_room_members m2 ON cr.id = m2.chat_room_id AND m2.user_id = $2
WHERE cr.type = 'DM'
LIMIT 1;

-- name: DeleteFriendshipBetween :exec
DELETE FROM friendships
WHERE (requester_id = $1 AND addressee_id = $2)
   OR (requester_id = $2 AND addressee_id = $1);

-- name: ListUserChatRooms :many
SELECT cr.id, cr.type, cr.name, cr.created_at,
       m.last_read_at,
       COALESCE(s.unread_count, 0) AS unread_count,
       s.last_message,
       s.last_message_at
FROM chat_rooms cr
JOIN chat_room_members m ON cr.id = m.chat_room_id
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) FILTER (WHERE cm.created_at > m.last_read_at) AS unread_count,
        (ARRAY_AGG(cm.content ORDER BY cm.id DESC))[1] AS last_message,
        MAX(cm.created_at) AS last_message_at
    FROM chat_messages cm
    WHERE cm.chat_room_id = cr.id AND cm.deleted_at IS NULL
) s ON true
WHERE m.user_id = $1
ORDER BY s.last_message_at DESC NULLS LAST
LIMIT $2 OFFSET $3;

-- ════════��═══════════════════════��══════════════════════════════════
-- Chat Room Members
-- ═══════════════════════��═══════════════════════════��═══════════════

-- name: AddChatRoomMember :exec
INSERT INTO chat_room_members (chat_room_id, user_id, role)
VALUES (@chat_room_id, @user_id, @role)
ON CONFLICT DO NOTHING;

-- name: RemoveChatRoomMember :exec
DELETE FROM chat_room_members WHERE chat_room_id = $1 AND user_id = $2;

-- name: ListChatRoomMembers :many
SELECT crm.*, u.nickname, u.avatar_url
FROM chat_room_members crm
JOIN users u ON crm.user_id = u.id
WHERE crm.chat_room_id = $1
ORDER BY crm.joined_at;

-- name: IsChatRoomMember :one
SELECT EXISTS(
    SELECT 1 FROM chat_room_members
    WHERE chat_room_id = $1 AND user_id = $2
) AS is_member;

-- name: UpdateLastReadAt :exec
UPDATE chat_room_members SET last_read_at = NOW()
WHERE chat_room_id = $1 AND user_id = $2;

-- ══════════��═════════════════════════════════════════════════��══════
-- Chat Messages
-- ══���════════════════════════════════���═══════════════════════════════

-- name: CreateChatMessage :one
INSERT INTO chat_messages (chat_room_id, sender_id, content, message_type, metadata)
VALUES (@chat_room_id, @sender_id, @content, @message_type, @metadata)
RETURNING *;

-- name: ListChatMessages :many
SELECT cm.*, u.nickname AS sender_nickname, u.avatar_url AS sender_avatar
FROM chat_messages cm
JOIN users u ON cm.sender_id = u.id
WHERE cm.chat_room_id = $1 AND cm.deleted_at IS NULL
ORDER BY cm.id ASC
LIMIT $2 OFFSET $3;

-- name: GetChatMessage :one
SELECT * FROM chat_messages WHERE id = $1;

-- name: CountUnreadMessages :one
SELECT COUNT(*) FROM chat_messages cm
JOIN chat_room_members crm ON cm.chat_room_id = crm.chat_room_id
WHERE crm.chat_room_id = $1
  AND crm.user_id = $2
  AND cm.created_at > crm.last_read_at
  AND cm.deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- New queries for Phase 7.5
-- ═══════════════════════════════════════════════════════════════════

-- name: SoftDeleteChatMessage :exec
UPDATE chat_messages SET deleted_at = NOW()
WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL;

-- name: GetChatRoomMemberRole :one
SELECT role FROM chat_room_members
WHERE chat_room_id = $1 AND user_id = $2;

-- name: UpdateChatRoomMemberRole :exec
UPDATE chat_room_members SET role = $3
WHERE chat_room_id = $1 AND user_id = $2;

-- name: UpdateChatRoomName :one
UPDATE chat_rooms SET name = $2
WHERE id = $1
RETURNING *;

-- name: ListChatMessagesCursor :many
SELECT cm.*, u.nickname AS sender_nickname, u.avatar_url AS sender_avatar
FROM chat_messages cm
JOIN users u ON cm.sender_id = u.id
WHERE cm.chat_room_id = $1 AND cm.id < $2 AND cm.deleted_at IS NULL
ORDER BY cm.id DESC
LIMIT $3;

-- name: CountTotalUnreadMessages :one
SELECT COALESCE(SUM(cnt), 0)::bigint AS total_unread
FROM (
    SELECT COUNT(*) AS cnt
    FROM chat_messages cm
    JOIN chat_room_members crm ON cm.chat_room_id = crm.chat_room_id
    WHERE crm.user_id = $1
      AND cm.created_at > crm.last_read_at
      AND cm.deleted_at IS NULL
) sub;

-- name: SearchFriendsByNickname :many
SELECT u.id, u.nickname, u.avatar_url, u.role, f.id AS friendship_id, f.created_at
FROM friendships f
JOIN users u ON (
    CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END = u.id
)
WHERE (f.requester_id = $1 OR f.addressee_id = $1)
  AND f.status = 'ACCEPTED'
  AND u.nickname ILIKE '%' || $2 || '%'
ORDER BY u.nickname
LIMIT $3;
