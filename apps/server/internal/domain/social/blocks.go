package social

import (
	"context"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

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
