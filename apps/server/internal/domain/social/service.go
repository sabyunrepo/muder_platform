package social

import (
	"context"
	"errors"
	"hash/fnv"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// validMessageTypes defines the allowed message types for chat messages.
var validMessageTypes = map[string]bool{
	"TEXT":        true,
	"IMAGE":       true,
	"SYSTEM":      true,
	"GAME_INVITE": true,
	"GAME_RESULT": true,
}

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

// friendService implements FriendService.
type friendService struct {
	queries *db.Queries
	logger  zerolog.Logger
}

// NewFriendService creates a new friend service.
func NewFriendService(queries *db.Queries, logger zerolog.Logger) FriendService {
	return &friendService{
		queries: queries,
		logger:  logger.With().Str("domain", "social.friend").Logger(),
	}
}

func (s *friendService) SendRequest(ctx context.Context, requesterID, addresseeID uuid.UUID) (*FriendshipResponse, error) {
	if requesterID == addresseeID {
		return nil, apperror.New(apperror.ErrFriendRequestSelf, http.StatusBadRequest, "cannot send friend request to yourself")
	}

	// Check if blocked.
	blocked, err := s.queries.IsBlocked(ctx, db.IsBlockedParams{
		BlockerID: requesterID,
		BlockedID: addresseeID,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to check block status")
		return nil, apperror.Internal("failed to send friend request")
	}
	if blocked {
		return nil, apperror.New(apperror.ErrFriendRequestBlocked, http.StatusConflict, "cannot send friend request to a blocked user")
	}

	// Check for existing friendship.
	existing, err := s.queries.GetFriendshipBetween(ctx, db.GetFriendshipBetweenParams{
		RequesterID: requesterID,
		AddresseeID: addresseeID,
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		s.logger.Error().Err(err).Msg("failed to check existing friendship")
		return nil, apperror.Internal("failed to send friend request")
	}
	if err == nil {
		if existing.Status == "PENDING" || existing.Status == "ACCEPTED" {
			return nil, apperror.New(apperror.ErrFriendRequestDuplicate, http.StatusConflict, "friend request already exists")
		}
	}

	f, err := s.queries.CreateFriendRequest(ctx, db.CreateFriendRequestParams{
		RequesterID: requesterID,
		AddresseeID: addresseeID,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create friend request")
		return nil, apperror.Internal("failed to send friend request")
	}

	s.logger.Info().
		Stringer("requester_id", requesterID).
		Stringer("addressee_id", addresseeID).
		Msg("friend request sent")

	return &FriendshipResponse{
		ID:          f.ID,
		RequesterID: f.RequesterID,
		AddresseeID: f.AddresseeID,
		Status:      f.Status,
		CreatedAt:   f.CreatedAt,
	}, nil
}

func (s *friendService) AcceptRequest(ctx context.Context, friendshipID, userID uuid.UUID) (*FriendshipResponse, error) {
	f, err := s.queries.AcceptFriendRequest(ctx, db.AcceptFriendRequestParams{
		ID:          friendshipID,
		AddresseeID: userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrFriendshipNotFound, http.StatusNotFound, "pending friend request not found")
		}
		s.logger.Error().Err(err).Msg("failed to accept friend request")
		return nil, apperror.Internal("failed to accept friend request")
	}

	s.logger.Info().
		Stringer("friendship_id", friendshipID).
		Stringer("user_id", userID).
		Msg("friend request accepted")

	return &FriendshipResponse{
		ID:          f.ID,
		RequesterID: f.RequesterID,
		AddresseeID: f.AddresseeID,
		Status:      f.Status,
		CreatedAt:   f.CreatedAt,
	}, nil
}

func (s *friendService) RejectRequest(ctx context.Context, friendshipID, userID uuid.UUID) error {
	// Verify the request exists and belongs to this user.
	f, err := s.queries.GetFriendship(ctx, friendshipID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.New(apperror.ErrFriendshipNotFound, http.StatusNotFound, "friend request not found")
		}
		return apperror.Internal("failed to reject friend request")
	}
	if f.AddresseeID != userID || f.Status != "PENDING" {
		return apperror.New(apperror.ErrFriendshipNotFound, http.StatusNotFound, "pending friend request not found")
	}

	err = s.queries.RejectFriendRequest(ctx, db.RejectFriendRequestParams{
		ID:          friendshipID,
		AddresseeID: userID,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to reject friend request")
		return apperror.Internal("failed to reject friend request")
	}

	s.logger.Info().
		Stringer("friendship_id", friendshipID).
		Stringer("user_id", userID).
		Msg("friend request rejected")

	return nil
}

func (s *friendService) RemoveFriend(ctx context.Context, friendshipID, userID uuid.UUID) error {
	// Verify the friendship exists and involves this user.
	f, err := s.queries.GetFriendship(ctx, friendshipID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.New(apperror.ErrFriendshipNotFound, http.StatusNotFound, "friendship not found")
		}
		return apperror.Internal("failed to remove friend")
	}
	if f.RequesterID != userID && f.AddresseeID != userID {
		return apperror.New(apperror.ErrFriendshipNotFound, http.StatusNotFound, "friendship not found")
	}

	err = s.queries.DeleteFriendship(ctx, db.DeleteFriendshipParams{
		ID:          friendshipID,
		RequesterID: userID,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to remove friend")
		return apperror.Internal("failed to remove friend")
	}

	s.logger.Info().
		Stringer("friendship_id", friendshipID).
		Stringer("user_id", userID).
		Msg("friend removed")

	return nil
}

func (s *friendService) ListFriends(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]FriendResponse, error) {
	rows, err := s.queries.ListFriends(ctx, db.ListFriendsParams{
		RequesterID: userID,
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list friends")
		return nil, apperror.Internal("failed to list friends")
	}

	result := make([]FriendResponse, len(rows))
	for i, r := range rows {
		result[i] = FriendResponse{
			ID:           r.ID,
			Nickname:     r.Nickname,
			AvatarURL:    textToString(r.AvatarUrl),
			Role:         r.Role,
			FriendshipID: r.FriendshipID,
			Since:        r.CreatedAt,
		}
	}
	return result, nil
}

func (s *friendService) ListPendingRequests(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]PendingRequestResponse, error) {
	rows, err := s.queries.ListPendingRequests(ctx, db.ListPendingRequestsParams{
		AddresseeID: userID,
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list pending requests")
		return nil, apperror.Internal("failed to list pending requests")
	}

	result := make([]PendingRequestResponse, len(rows))
	for i, r := range rows {
		result[i] = PendingRequestResponse{
			FriendshipID: r.ID,
			RequesterID:  r.RequesterID,
			Nickname:     r.RequesterNickname,
			AvatarURL:    textToString(r.RequesterAvatar),
			CreatedAt:    r.CreatedAt,
		}
	}
	return result, nil
}

func (s *friendService) BlockUser(ctx context.Context, blockerID, blockedID uuid.UUID) error {
	if blockerID == blockedID {
		return apperror.BadRequest("cannot block yourself")
	}

	// Remove any existing friendship between the two users.
	_ = s.queries.DeleteFriendshipBetween(ctx, db.DeleteFriendshipBetweenParams{
		RequesterID: blockerID,
		AddresseeID: blockedID,
	})

	_, err := s.queries.CreateBlock(ctx, db.CreateBlockParams{
		BlockerID: blockerID,
		BlockedID: blockedID,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to block user")
		return apperror.Internal("failed to block user")
	}

	s.logger.Info().
		Stringer("blocker_id", blockerID).
		Stringer("blocked_id", blockedID).
		Msg("user blocked")

	return nil
}

func (s *friendService) UnblockUser(ctx context.Context, blockerID, blockedID uuid.UUID) error {
	err := s.queries.DeleteBlock(ctx, db.DeleteBlockParams{
		BlockerID: blockerID,
		BlockedID: blockedID,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to unblock user")
		return apperror.Internal("failed to unblock user")
	}

	s.logger.Info().
		Stringer("blocker_id", blockerID).
		Stringer("blocked_id", blockedID).
		Msg("user unblocked")

	return nil
}

func (s *friendService) ListBlocks(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]BlockResponse, error) {
	rows, err := s.queries.ListBlocks(ctx, db.ListBlocksParams{
		BlockerID: userID,
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list blocks")
		return nil, apperror.Internal("failed to list blocks")
	}

	result := make([]BlockResponse, len(rows))
	for i, r := range rows {
		result[i] = BlockResponse{
			ID:        r.ID,
			BlockedID: r.BlockedID,
			Nickname:  r.BlockedNickname,
			AvatarURL: textToString(r.BlockedAvatar),
			CreatedAt: r.CreatedAt,
		}
	}
	return result, nil
}

// chatService implements ChatService.
type chatService struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	logger  zerolog.Logger
}

// NewChatService creates a new chat service.
func NewChatService(pool *pgxpool.Pool, queries *db.Queries, logger zerolog.Logger) ChatService {
	return &chatService{
		pool:    pool,
		queries: queries,
		logger:  logger.With().Str("domain", "social.chat").Logger(),
	}
}

// dmLockKey returns a deterministic advisory lock key for a DM user pair.
func dmLockKey(a, b uuid.UUID) int64 {
	if a.String() > b.String() {
		a, b = b, a
	}
	h := fnv.New64a()
	h.Write(a[:])
	h.Write(b[:])
	return int64(h.Sum64())
}

func (s *chatService) GetOrCreateDMRoom(ctx context.Context, userID, otherID uuid.UUID) (*ChatRoomResponse, error) {
	if userID == otherID {
		return nil, apperror.BadRequest("cannot create DM room with yourself")
	}

	// Block check: cannot DM a blocked/blocking user.
	blocked, err := s.queries.IsBlocked(ctx, db.IsBlockedParams{
		BlockerID: userID,
		BlockedID: otherID,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to check block status for DM")
		return nil, apperror.Internal("failed to create DM room")
	}
	if blocked {
		return nil, apperror.New(apperror.ErrChatBlocked, http.StatusForbidden, "cannot create DM with blocked user")
	}

	// Acquire advisory lock to prevent duplicate DM rooms for the same pair.
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to begin transaction")
		return nil, apperror.Internal("failed to create DM room")
	}
	defer tx.Rollback(ctx)

	lockKey := dmLockKey(userID, otherID)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", lockKey); err != nil {
		s.logger.Error().Err(err).Msg("failed to acquire advisory lock")
		return nil, apperror.Internal("failed to create DM room")
	}

	qtx := s.queries.WithTx(tx)

	// Try to find existing DM room inside the lock.
	room, err := qtx.FindDMRoom(ctx, db.FindDMRoomParams{
		UserID:   userID,
		UserID_2: otherID,
	})
	if err == nil {
		tx.Rollback(ctx)
		return s.buildChatRoomResponse(ctx, room)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		s.logger.Error().Err(err).Msg("failed to find DM room")
		return nil, apperror.Internal("failed to get or create DM room")
	}

	// Create new DM room inside the same transaction.
	room, err = qtx.CreateChatRoom(ctx, db.CreateChatRoomParams{
		Type:      "DM",
		CreatedBy: userID,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create DM room")
		return nil, apperror.Internal("failed to create DM room")
	}

	if err := qtx.AddChatRoomMember(ctx, db.AddChatRoomMemberParams{
		ChatRoomID: room.ID,
		UserID:     userID,
		Role:       "MEMBER",
	}); err != nil {
		s.logger.Error().Err(err).Msg("failed to add member to DM room")
		return nil, apperror.Internal("failed to create DM room")
	}

	if err := qtx.AddChatRoomMember(ctx, db.AddChatRoomMemberParams{
		ChatRoomID: room.ID,
		UserID:     otherID,
		Role:       "MEMBER",
	}); err != nil {
		s.logger.Error().Err(err).Msg("failed to add member to DM room")
		return nil, apperror.Internal("failed to create DM room")
	}

	if err := tx.Commit(ctx); err != nil {
		s.logger.Error().Err(err).Msg("failed to commit DM room creation")
		return nil, apperror.Internal("failed to create DM room")
	}

	s.logger.Info().
		Stringer("room_id", room.ID).
		Stringer("user_id", userID).
		Stringer("other_id", otherID).
		Msg("DM room created")

	return s.buildChatRoomResponse(ctx, room)
}

func (s *chatService) CreateGroupRoom(ctx context.Context, creatorID uuid.UUID, name string, memberIDs []uuid.UUID) (*ChatRoomResponse, error) {
	if len(memberIDs) > 50 {
		return nil, apperror.BadRequest("group room cannot have more than 50 members")
	}

	name = strings.TrimSpace(name)
	if name == "" {
		return nil, apperror.BadRequest("group name is required")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to begin transaction")
		return nil, apperror.Internal("failed to create group room")
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	room, err := qtx.CreateChatRoom(ctx, db.CreateChatRoomParams{
		Type:      "GROUP",
		Name:      pgtype.Text{String: name, Valid: true},
		CreatedBy: creatorID,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create group room")
		return nil, apperror.Internal("failed to create group room")
	}

	// Add creator as OWNER.
	if err := qtx.AddChatRoomMember(ctx, db.AddChatRoomMemberParams{
		ChatRoomID: room.ID,
		UserID:     creatorID,
		Role:       "OWNER",
	}); err != nil {
		s.logger.Error().Err(err).Msg("failed to add creator to group room")
		return nil, apperror.Internal("failed to create group room")
	}

	// Add other members.
	for _, memberID := range memberIDs {
		if memberID == creatorID {
			continue
		}
		if err := qtx.AddChatRoomMember(ctx, db.AddChatRoomMemberParams{
			ChatRoomID: room.ID,
			UserID:     memberID,
			Role:       "MEMBER",
		}); err != nil {
			s.logger.Error().Err(err).Msg("failed to add member to group room")
			return nil, apperror.Internal("failed to create group room")
		}
	}

	if err := tx.Commit(ctx); err != nil {
		s.logger.Error().Err(err).Msg("failed to commit group room creation")
		return nil, apperror.Internal("failed to create group room")
	}

	s.logger.Info().
		Stringer("room_id", room.ID).
		Str("name", name).
		Int("member_count", len(memberIDs)+1).
		Msg("group room created")

	return s.buildChatRoomResponse(ctx, room)
}

func (s *chatService) ListMyRooms(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]ChatRoomSummary, error) {
	rows, err := s.queries.ListUserChatRooms(ctx, db.ListUserChatRoomsParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list chat rooms")
		return nil, apperror.Internal("failed to list chat rooms")
	}

	result := make([]ChatRoomSummary, len(rows))
	for i, r := range rows {
		var lastMsgAt *time.Time
		if ts, ok := r.LastMessageAt.(pgtype.Timestamptz); ok && ts.Valid {
			lastMsgAt = &ts.Time
		}
		var lastMsg string
		if txt, ok := r.LastMessage.(pgtype.Text); ok {
			lastMsg = textToString(txt)
		}
		result[i] = ChatRoomSummary{
			ID:            r.ID,
			Type:          r.Type,
			Name:          textToString(r.Name),
			UnreadCount:   r.UnreadCount,
			LastMessage:   lastMsg,
			LastMessageAt: lastMsgAt,
		}
	}
	return result, nil
}

func (s *chatService) GetRoomMembers(ctx context.Context, roomID, userID uuid.UUID) ([]ChatMemberResponse, error) {
	if err := s.requireMembership(ctx, roomID, userID); err != nil {
		return nil, err
	}

	rows, err := s.queries.ListChatRoomMembers(ctx, roomID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list chat room members")
		return nil, apperror.Internal("failed to get room members")
	}

	return mapMembers(rows), nil
}

func (s *chatService) SendMessage(ctx context.Context, roomID, senderID uuid.UUID, content, messageType string) (*ChatMessageResponse, error) {
	if err := s.requireMembership(ctx, roomID, senderID); err != nil {
		return nil, err
	}

	// Block check for DM rooms: cannot send to blocked/blocking user.
	room, err := s.queries.GetChatRoom(ctx, roomID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get chat room for block check")
		return nil, apperror.Internal("failed to send message")
	}
	if room.Type == "DM" {
		members, err := s.queries.ListChatRoomMembers(ctx, roomID)
		if err != nil {
			s.logger.Error().Err(err).Msg("failed to list members for block check")
			return nil, apperror.Internal("failed to send message")
		}
		for _, m := range members {
			if m.UserID != senderID {
				blocked, err := s.queries.IsBlocked(ctx, db.IsBlockedParams{
					BlockerID: senderID,
					BlockedID: m.UserID,
				})
				if err != nil {
					s.logger.Error().Err(err).Msg("failed to check block status")
					return nil, apperror.Internal("failed to send message")
				}
				if blocked {
					return nil, apperror.New(apperror.ErrChatBlocked, http.StatusForbidden, "cannot send message to blocked user")
				}
			}
		}
	}

	content = strings.TrimSpace(content)
	if content == "" {
		return nil, apperror.BadRequest("message content is required")
	}
	if len(content) > 2000 {
		return nil, apperror.BadRequest("message content exceeds 2000 characters")
	}

	if messageType == "" {
		messageType = "TEXT"
	}
	if !validMessageTypes[messageType] {
		return nil, apperror.New(apperror.ErrChatInvalidMsgType, http.StatusBadRequest, "invalid message type: must be TEXT, SYSTEM, GAME_INVITE, or GAME_RESULT")
	}

	msg, err := s.queries.CreateChatMessage(ctx, db.CreateChatMessageParams{
		ChatRoomID:  roomID,
		SenderID:    senderID,
		Content:     content,
		MessageType: messageType,
		Metadata:    []byte("{}"),
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create chat message")
		return nil, apperror.Internal("failed to send message")
	}

	// Look up sender info.
	user, err := s.queries.GetUser(ctx, senderID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get sender info")
		return nil, apperror.Internal("failed to send message")
	}

	return &ChatMessageResponse{
		ID:             msg.ID,
		ChatRoomID:     msg.ChatRoomID,
		SenderID:       msg.SenderID,
		SenderNickname: user.Nickname,
		SenderAvatar:   textToString(user.AvatarUrl),
		Content:        msg.Content,
		MessageType:    msg.MessageType,
		CreatedAt:      msg.CreatedAt,
	}, nil
}

func (s *chatService) ListMessages(ctx context.Context, roomID, userID uuid.UUID, limit, offset int32) ([]ChatMessageResponse, error) {
	if err := s.requireMembership(ctx, roomID, userID); err != nil {
		return nil, err
	}

	rows, err := s.queries.ListChatMessages(ctx, db.ListChatMessagesParams{
		ChatRoomID: roomID,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list chat messages")
		return nil, apperror.Internal("failed to list messages")
	}

	result := make([]ChatMessageResponse, len(rows))
	for i, r := range rows {
		result[i] = ChatMessageResponse{
			ID:             r.ID,
			ChatRoomID:     r.ChatRoomID,
			SenderID:       r.SenderID,
			SenderNickname: r.SenderNickname,
			SenderAvatar:   textToString(r.SenderAvatar),
			Content:        r.Content,
			MessageType:    r.MessageType,
			CreatedAt:      r.CreatedAt,
		}
	}
	return result, nil
}

func (s *chatService) MarkAsRead(ctx context.Context, roomID, userID uuid.UUID) error {
	if err := s.requireMembership(ctx, roomID, userID); err != nil {
		return err
	}

	if err := s.queries.UpdateLastReadAt(ctx, db.UpdateLastReadAtParams{
		ChatRoomID: roomID,
		UserID:     userID,
	}); err != nil {
		s.logger.Error().Err(err).Msg("failed to mark as read")
		return apperror.Internal("failed to mark as read")
	}
	return nil
}

func (s *chatService) CountUnread(ctx context.Context, roomID, userID uuid.UUID) (int64, error) {
	if err := s.requireMembership(ctx, roomID, userID); err != nil {
		return 0, err
	}

	count, err := s.queries.CountUnreadMessages(ctx, db.CountUnreadMessagesParams{
		ChatRoomID: roomID,
		UserID:     userID,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count unread messages")
		return 0, apperror.Internal("failed to count unread messages")
	}
	return count, nil
}

// requireMembership checks that the user is a member of the given chat room.
func (s *chatService) requireMembership(ctx context.Context, roomID, userID uuid.UUID) error {
	isMember, err := s.queries.IsChatRoomMember(ctx, db.IsChatRoomMemberParams{
		ChatRoomID: roomID,
		UserID:     userID,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to check room membership")
		return apperror.Internal("failed to verify room membership")
	}
	if !isMember {
		return apperror.New(apperror.ErrChatNotMember, http.StatusForbidden, "not a member of this chat room")
	}
	return nil
}

// buildChatRoomResponse assembles a ChatRoomResponse with members.
func (s *chatService) buildChatRoomResponse(ctx context.Context, room db.ChatRoom) (*ChatRoomResponse, error) {
	rows, err := s.queries.ListChatRoomMembers(ctx, room.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list chat room members")
		return nil, apperror.Internal("failed to get chat room")
	}

	return &ChatRoomResponse{
		ID:        room.ID,
		Type:      room.Type,
		Name:      textToString(room.Name),
		CreatedAt: room.CreatedAt,
		Members:   mapMembers(rows),
	}, nil
}

// mapMembers converts db rows to ChatMemberResponse slice.
func mapMembers(rows []db.ListChatRoomMembersRow) []ChatMemberResponse {
	members := make([]ChatMemberResponse, len(rows))
	for i, r := range rows {
		members[i] = ChatMemberResponse{
			UserID:     r.UserID,
			Nickname:   r.Nickname,
			AvatarURL:  textToString(r.AvatarUrl),
			JoinedAt:   r.JoinedAt,
			LastReadAt: r.LastReadAt,
		}
	}
	return members
}

// textToString converts a pgtype.Text to a plain string (empty if not valid).
func textToString(t pgtype.Text) string {
	if !t.Valid {
		return ""
	}
	return t.String
}
