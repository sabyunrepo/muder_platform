package social

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"

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
