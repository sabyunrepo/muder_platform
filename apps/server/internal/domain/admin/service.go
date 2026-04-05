package admin

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// UserSummary is the admin view of a user.
type UserSummary struct {
	ID          uuid.UUID `json:"id"`
	Nickname    string    `json:"nickname"`
	Email       *string   `json:"email,omitempty"`
	Role        string    `json:"role"`
	CoinBalance int64     `json:"coin_balance"`
	CreatedAt   time.Time `json:"created_at"`
}

// UpdateRoleRequest is the payload for updating a user's role.
type UpdateRoleRequest struct {
	Role string `json:"role" validate:"required,oneof=PLAYER GM CREATOR ADMIN"`
}

// ThemeSummary is the admin view of a theme.
type ThemeSummary struct {
	ID         uuid.UUID `json:"id"`
	CreatorID  uuid.UUID `json:"creator_id"`
	Title      string    `json:"title"`
	Status     string    `json:"status"`
	MinPlayers int32     `json:"min_players"`
	MaxPlayers int32     `json:"max_players"`
	Price      int32     `json:"price"`
	Version    int32     `json:"version"`
	CreatedAt  time.Time `json:"created_at"`
}

// RoomSummary is the admin view of a room.
type RoomSummary struct {
	ID         uuid.UUID `json:"id"`
	ThemeID    uuid.UUID `json:"theme_id"`
	HostID     uuid.UUID `json:"host_id"`
	Code       string    `json:"code"`
	Status     string    `json:"status"`
	MaxPlayers int32     `json:"max_players"`
	IsPrivate  bool      `json:"is_private"`
	CreatedAt  time.Time `json:"created_at"`
}

// Service defines the admin domain operations.
type Service interface {
	ListUsers(ctx context.Context, limit, offset int32) ([]UserSummary, error)
	GetUser(ctx context.Context, userID uuid.UUID) (*UserSummary, error)
	UpdateUserRole(ctx context.Context, userID uuid.UUID, role string) (*UserSummary, error)
	ListAllThemes(ctx context.Context, limit, offset int32) ([]ThemeSummary, error)
	ForceUnpublishTheme(ctx context.Context, themeID uuid.UUID) (*ThemeSummary, error)
	ListAllRooms(ctx context.Context, limit, offset int32) ([]RoomSummary, error)
	ForceCloseRoom(ctx context.Context, roomID uuid.UUID) error
}

type service struct {
	queries *db.Queries
	logger  zerolog.Logger
}

// NewService creates a new admin service.
func NewService(queries *db.Queries, logger zerolog.Logger) Service {
	return &service{
		queries: queries,
		logger:  logger.With().Str("domain", "admin").Logger(),
	}
}

func (s *service) ListUsers(ctx context.Context, limit, offset int32) ([]UserSummary, error) {
	users, err := s.queries.ListUsers(ctx, db.ListUsersParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list users")
		return nil, apperror.Internal("failed to list users")
	}

	result := make([]UserSummary, len(users))
	for i, u := range users {
		result[i] = mapUserSummary(u)
	}
	return result, nil
}

func (s *service) GetUser(ctx context.Context, userID uuid.UUID) (*UserSummary, error) {
	u, err := s.queries.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrNotFound, http.StatusNotFound, "user not found")
		}
		s.logger.Error().Err(err).Msg("failed to get user")
		return nil, apperror.Internal("failed to get user")
	}

	summary := mapUserSummary(u)
	return &summary, nil
}

func (s *service) UpdateUserRole(ctx context.Context, userID uuid.UUID, role string) (*UserSummary, error) {
	u, err := s.queries.UpdateUserRole(ctx, db.UpdateUserRoleParams{
		ID:   userID,
		Role: role,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrNotFound, http.StatusNotFound, "user not found")
		}
		s.logger.Error().Err(err).Msg("failed to update user role")
		return nil, apperror.Internal("failed to update user role")
	}

	s.logger.Info().
		Str("user_id", userID.String()).
		Str("new_role", role).
		Msg("user role updated")

	summary := mapUserSummary(u)
	return &summary, nil
}

func (s *service) ListAllThemes(ctx context.Context, limit, offset int32) ([]ThemeSummary, error) {
	themes, err := s.queries.ListAllThemes(ctx, db.ListAllThemesParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list all themes")
		return nil, apperror.Internal("failed to list themes")
	}

	result := make([]ThemeSummary, len(themes))
	for i, t := range themes {
		result[i] = mapThemeSummary(t)
	}
	return result, nil
}

func (s *service) ForceUnpublishTheme(ctx context.Context, themeID uuid.UUID) (*ThemeSummary, error) {
	t, err := s.queries.UpdateThemeStatus(ctx, db.UpdateThemeStatusParams{
		ID:     themeID,
		Status: "DRAFT",
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrNotFound, http.StatusNotFound, "theme not found")
		}
		s.logger.Error().Err(err).Msg("failed to force unpublish theme")
		return nil, apperror.Internal("failed to unpublish theme")
	}

	s.logger.Info().
		Str("theme_id", themeID.String()).
		Msg("theme force unpublished")

	summary := mapThemeSummary(t)
	return &summary, nil
}

func (s *service) ListAllRooms(ctx context.Context, limit, offset int32) ([]RoomSummary, error) {
	rooms, err := s.queries.ListAllRooms(ctx, db.ListAllRoomsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list all rooms")
		return nil, apperror.Internal("failed to list rooms")
	}

	result := make([]RoomSummary, len(rooms))
	for i, r := range rooms {
		result[i] = mapRoomSummary(r)
	}
	return result, nil
}

func (s *service) ForceCloseRoom(ctx context.Context, roomID uuid.UUID) error {
	// Verify the room exists first.
	if _, err := s.queries.GetRoom(ctx, roomID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("failed to get room for force close")
		return apperror.Internal("failed to get room")
	}

	if err := s.queries.UpdateRoomStatus(ctx, db.UpdateRoomStatusParams{
		ID:     roomID,
		Status: "CLOSED",
	}); err != nil {
		s.logger.Error().Err(err).Msg("failed to force close room")
		return apperror.Internal("failed to close room")
	}

	s.logger.Info().
		Str("room_id", roomID.String()).
		Msg("room force closed")

	return nil
}

// textToPtr converts a pgtype.Text to *string.
func textToPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

func mapUserSummary(u db.User) UserSummary {
	return UserSummary{
		ID:          u.ID,
		Nickname:    u.Nickname,
		Email:       textToPtr(u.Email),
		Role:        u.Role,
		CoinBalance: u.CoinBalance,
		CreatedAt:   u.CreatedAt,
	}
}

func mapThemeSummary(t db.Theme) ThemeSummary {
	return ThemeSummary{
		ID:         t.ID,
		CreatorID:  t.CreatorID,
		Title:      t.Title,
		Status:     t.Status,
		MinPlayers: t.MinPlayers,
		MaxPlayers: t.MaxPlayers,
		Price:      t.Price,
		Version:    t.Version,
		CreatedAt:  t.CreatedAt,
	}
}

func mapRoomSummary(r db.Room) RoomSummary {
	return RoomSummary{
		ID:         r.ID,
		ThemeID:    r.ThemeID,
		HostID:     r.HostID,
		Code:       r.Code,
		Status:     r.Status,
		MaxPlayers: r.MaxPlayers,
		IsPrivate:  r.IsPrivate,
		CreatedAt:  r.CreatedAt,
	}
}
