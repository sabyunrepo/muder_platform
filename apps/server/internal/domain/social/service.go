// Package social implements friend / block / chat domain services. The
// actual implementations live in sibling files split by domain:
//
//   - friends.go         friend request lifecycle + listing
//   - blocks.go          block / unblock / list
//   - chat_rooms.go      DM and group room creation + membership helpers
//   - chat_messages.go   message send / list / read / unread counting
//
// This file owns only the public interfaces so callers can depend on
// social.FriendService / social.ChatService without reaching into the
// implementation files.
package social

import (
	"context"

	"github.com/google/uuid"
)

// FriendService defines friend and block domain operations.
type FriendService interface {
	SendRequest(ctx context.Context, requesterID, addresseeID uuid.UUID) (*FriendshipResponse, error)
	AcceptRequest(ctx context.Context, friendshipID, userID uuid.UUID) (*FriendshipResponse, error)
	RejectRequest(ctx context.Context, friendshipID, userID uuid.UUID) error
	RemoveFriend(ctx context.Context, friendshipID, userID uuid.UUID) error
	ListFriends(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]FriendResponse, error)
	ListPendingRequests(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]PendingRequestResponse, error)
	BlockUser(ctx context.Context, blockerID, blockedID uuid.UUID) error
	UnblockUser(ctx context.Context, blockerID, blockedID uuid.UUID) error
	ListBlocks(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]BlockResponse, error)
}

// ChatService defines chat domain operations.
type ChatService interface {
	GetOrCreateDMRoom(ctx context.Context, userID, otherID uuid.UUID) (*ChatRoomResponse, error)
	CreateGroupRoom(ctx context.Context, creatorID uuid.UUID, name string, memberIDs []uuid.UUID) (*ChatRoomResponse, error)
	ListMyRooms(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]ChatRoomSummary, error)
	GetRoomMembers(ctx context.Context, roomID, userID uuid.UUID) ([]ChatMemberResponse, error)
	SendMessage(ctx context.Context, roomID, senderID uuid.UUID, content, messageType string) (*ChatMessageResponse, error)
	ListMessages(ctx context.Context, roomID, userID uuid.UUID, limit, offset int32) ([]ChatMessageResponse, error)
	MarkAsRead(ctx context.Context, roomID, userID uuid.UUID) error
	CountUnread(ctx context.Context, roomID, userID uuid.UUID) (int64, error)
}
