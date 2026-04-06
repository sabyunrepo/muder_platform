package profile

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"

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
	Nickname  string  `json:"nickname" validate:"required,min=2,max=30"`
	AvatarURL *string `json:"avatar_url" validate:"omitempty,url"`
}

// AvatarResponse is the response after a successful avatar upload.
type AvatarResponse struct {
	AvatarURL string `json:"avatar_url"`
}

// NotificationPrefsResponse is the notification preferences for a user.
type NotificationPrefsResponse struct {
	GameInvite bool `json:"game_invite"`
	RoomStatus bool `json:"room_status"`
	Marketing  bool `json:"marketing"`
}

// UpdateNotificationPrefsRequest is the payload for updating notification preferences.
type UpdateNotificationPrefsRequest struct {
	GameInvite bool `json:"game_invite"`
	RoomStatus bool `json:"room_status"`
	Marketing  bool `json:"marketing"`
}

// Service defines profile domain operations.
type Service interface {
	GetProfile(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error)
	GetPublicProfile(ctx context.Context, userID uuid.UUID) (*PublicProfileResponse, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*ProfileResponse, error)
	UpdateAvatar(ctx context.Context, userID uuid.UUID, file multipart.File, header *multipart.FileHeader) (*AvatarResponse, error)
	GetNotificationPrefs(ctx context.Context, userID uuid.UUID) (*NotificationPrefsResponse, error)
	UpdateNotificationPrefs(ctx context.Context, userID uuid.UUID, req UpdateNotificationPrefsRequest) (*NotificationPrefsResponse, error)
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

func (s *service) UpdateAvatar(ctx context.Context, userID uuid.UUID, file multipart.File, header *multipart.FileHeader) (*AvatarResponse, error) {
	// Validate content type via first 512 bytes.
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		return nil, apperror.BadRequest("failed to read file")
	}
	contentType := http.DetectContentType(buf[:n])
	switch contentType {
	case "image/jpeg", "image/png", "image/webp":
	default:
		return nil, apperror.BadRequest("unsupported image type: only JPEG, PNG, and WebP are allowed")
	}
	// Seek back to start after sniffing.
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, apperror.Internal("failed to process file")
	}

	uploadDir := "uploads/avatars"
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		s.logger.Error().Err(err).Msg("failed to create upload directory")
		return nil, apperror.Internal("failed to save avatar")
	}

	// Fixed filename: {userID}.webp — overwrites previous avatar.
	filename := fmt.Sprintf("%s.webp", userID.String())
	dst, err := os.Create(filepath.Join(uploadDir, filename))
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create avatar file")
		return nil, apperror.Internal("failed to save avatar")
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		s.logger.Error().Err(err).Msg("failed to write avatar file")
		return nil, apperror.Internal("failed to save avatar")
	}

	avatarURL := fmt.Sprintf("/uploads/avatars/%s", filename)
	current, err := s.queries.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("user not found")
		}
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to get user for avatar update")
		return nil, apperror.Internal("failed to update avatar")
	}
	_, err = s.queries.UpdateUser(ctx, db.UpdateUserParams{
		ID:        userID,
		Nickname:  current.Nickname,
		AvatarUrl: pgtype.Text{String: avatarURL, Valid: true},
	})
	if err != nil {
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to update avatar url")
		return nil, apperror.Internal("failed to update avatar")
	}

	return &AvatarResponse{AvatarURL: avatarURL}, nil
}

func (s *service) GetNotificationPrefs(ctx context.Context, userID uuid.UUID) (*NotificationPrefsResponse, error) {
	prefs, err := s.queries.GetNotificationPrefs(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &NotificationPrefsResponse{GameInvite: true, RoomStatus: true, Marketing: false}, nil
		}
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to get notification prefs")
		return nil, apperror.Internal("failed to get notification preferences")
	}
	return &NotificationPrefsResponse{
		GameInvite: prefs.GameInvite,
		RoomStatus: prefs.RoomStatus,
		Marketing:  prefs.Marketing,
	}, nil
}

func (s *service) UpdateNotificationPrefs(ctx context.Context, userID uuid.UUID, req UpdateNotificationPrefsRequest) (*NotificationPrefsResponse, error) {
	prefs, err := s.queries.UpsertNotificationPrefs(ctx, db.UpsertNotificationPrefsParams{
		UserID:     userID,
		GameInvite: req.GameInvite,
		RoomStatus: req.RoomStatus,
		Marketing:  req.Marketing,
	})
	if err != nil {
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to upsert notification prefs")
		return nil, apperror.Internal("failed to update notification preferences")
	}
	return &NotificationPrefsResponse{
		GameInvite: prefs.GameInvite,
		RoomStatus: prefs.RoomStatus,
		Marketing:  prefs.Marketing,
	}, nil
}

func textToPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}
