package social

import (
	"context"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

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
