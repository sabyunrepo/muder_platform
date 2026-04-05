package profile

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// ProfileResponse is the full profile visible to the authenticated user.
type ProfileResponse struct {
	ID          uuid.UUID `json:"id"`
	Nickname    string    `json:"nickname"`
	Email       *string   `json:"email,omitempty"`
	AvatarURL   *string   `json:"avatar_url,omitempty"`
	Role        string    `json:"role"`
	CoinBalance int64     `json:"coin_balance"`
}

// PublicProfileResponse is the subset of profile visible to other users.
type PublicProfileResponse struct {
	ID        uuid.UUID `json:"id"`
	Nickname  string    `json:"nickname"`
	AvatarURL *string   `json:"avatar_url,omitempty"`
}

// UpdateProfileRequest is the payload for updating a user's profile.
type UpdateProfileRequest struct {
	Nickname  string  `json:"nickname" validate:"required,min=2,max=20"`
	AvatarURL *string `json:"avatar_url" validate:"omitempty,url"`
}

// Service defines profile domain operations.
type Service interface {
	GetProfile(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error)
	GetPublicProfile(ctx context.Context, userID uuid.UUID) (*PublicProfileResponse, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*ProfileResponse, error)
}

type service struct {
	queries *db.Queries
	logger  zerolog.Logger
}

// NewService creates a new profile service.
func NewService(queries *db.Queries, logger zerolog.Logger) Service {
	return &service{
		queries: queries,
		logger:  logger.With().Str("domain", "profile").Logger(),
	}
}

func (s *service) GetProfile(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error) {
	user, err := s.queries.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("user not found")
		}
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to get user")
		return nil, apperror.Internal("failed to get profile")
	}
	return toProfileResponse(user), nil
}

func (s *service) GetPublicProfile(ctx context.Context, userID uuid.UUID) (*PublicProfileResponse, error) {
	user, err := s.queries.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("user not found")
		}
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to get user")
		return nil, apperror.Internal("failed to get profile")
	}
	return &PublicProfileResponse{
		ID:        user.ID,
		Nickname:  user.Nickname,
		AvatarURL: textToPtr(user.AvatarUrl),
	}, nil
}

func (s *service) UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*ProfileResponse, error) {
	params := db.UpdateUserParams{
		ID:       userID,
		Nickname: req.Nickname,
	}
	if req.AvatarURL != nil {
		params.AvatarUrl = pgtype.Text{String: *req.AvatarURL, Valid: true}
	}

	user, err := s.queries.UpdateUser(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("user not found")
		}
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to update user")
		return nil, apperror.Internal("failed to update profile")
	}
	return toProfileResponse(user), nil
}

func toProfileResponse(u db.User) *ProfileResponse {
	return &ProfileResponse{
		ID:          u.ID,
		Nickname:    u.Nickname,
		Email:       textToPtr(u.Email),
		AvatarURL:   textToPtr(u.AvatarUrl),
		Role:        u.Role,
		CoinBalance: u.CoinBalance,
	}
}

func textToPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}
