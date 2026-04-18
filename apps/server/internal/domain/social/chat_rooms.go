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
	defer tx.Rollback(ctx) //nolint:errcheck

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
		_ = tx.Rollback(ctx)
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
	defer tx.Rollback(ctx) //nolint:errcheck

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
