package social

import (
	"time"

	"github.com/google/uuid"
)

// FriendshipResponse is the response for friend request operations.
type FriendshipResponse struct {
	ID          uuid.UUID `json:"id"`
	RequesterID uuid.UUID `json:"requester_id"`
	AddresseeID uuid.UUID `json:"addressee_id"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

// FriendResponse is a single friend in the friends list.
type FriendResponse struct {
	ID           uuid.UUID `json:"id"`
	Nickname     string    `json:"nickname"`
	AvatarURL    string    `json:"avatar_url"`
	Role         string    `json:"role"`
	FriendshipID uuid.UUID `json:"friendship_id"`
	Since        time.Time `json:"since"`
}

// PendingRequestResponse is a single pending friend request.
type PendingRequestResponse struct {
	FriendshipID uuid.UUID `json:"friendship_id"`
	RequesterID  uuid.UUID `json:"requester_id"`
	Nickname     string    `json:"nickname"`
	AvatarURL    string    `json:"avatar_url"`
	CreatedAt    time.Time `json:"created_at"`
}

// BlockResponse is a single blocked user entry.
type BlockResponse struct {
	ID        uuid.UUID `json:"id"`
	BlockedID uuid.UUID `json:"blocked_id"`
	Nickname  string    `json:"nickname"`
	AvatarURL string    `json:"avatar_url"`
	CreatedAt time.Time `json:"created_at"`
}

// ChatRoomResponse is the full chat room representation with members.
type ChatRoomResponse struct {
	ID        uuid.UUID            `json:"id"`
	Type      string               `json:"type"`
	Name      string               `json:"name"`
	CreatedAt time.Time            `json:"created_at"`
	Members   []ChatMemberResponse `json:"members"`
}

// ChatRoomSummary is a lightweight chat room listing entry.
type ChatRoomSummary struct {
	ID            uuid.UUID  `json:"id"`
	Type          string     `json:"type"`
	Name          string     `json:"name"`
	UnreadCount   int64      `json:"unread_count"`
	LastMessage   string     `json:"last_message"`
	LastMessageAt *time.Time `json:"last_message_at"`
}

// ChatMemberResponse is a single member of a chat room.
type ChatMemberResponse struct {
	UserID    uuid.UUID `json:"user_id"`
	Nickname  string    `json:"nickname"`
	AvatarURL string    `json:"avatar_url"`
	JoinedAt  time.Time `json:"joined_at"`
	LastReadAt time.Time `json:"last_read_at"`
}

// ChatMessageResponse is a single chat message.
type ChatMessageResponse struct {
	ID             int64     `json:"id"`
	ChatRoomID     uuid.UUID `json:"chat_room_id"`
	SenderID       uuid.UUID `json:"sender_id"`
	SenderNickname string    `json:"sender_nickname"`
	SenderAvatar   string    `json:"sender_avatar"`
	Content        string    `json:"content"`
	MessageType    string    `json:"message_type"`
	CreatedAt      time.Time `json:"created_at"`
}

// Request types for handler JSON decoding.

// SendFriendRequestReq is the body for POST /friends/request.
type SendFriendRequestReq struct {
	AddresseeID uuid.UUID `json:"addressee_id" validate:"required"`
}

// BlockUserReq is the body for POST /blocks.
type BlockUserReq struct {
	BlockedID uuid.UUID `json:"blocked_id" validate:"required"`
}

// CreateDMReq is the body for POST /chat/dm.
type CreateDMReq struct {
	UserID uuid.UUID `json:"user_id" validate:"required"`
}

// CreateGroupReq is the body for POST /chat/group.
type CreateGroupReq struct {
	Name      string      `json:"name" validate:"required,min=1,max=100"`
	MemberIDs []uuid.UUID `json:"member_ids" validate:"required,min=1"`
}

// SendMessageReq is the body for POST /chat/rooms/{id}/messages.
type SendMessageReq struct {
	Content     string `json:"content" validate:"required,min=1,max=2000"`
	MessageType string `json:"message_type"`
}
