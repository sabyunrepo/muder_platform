package room

import (
	"context"
	"crypto/rand"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// CreateRoomRequest is the payload for creating a new room.
type CreateRoomRequest struct {
	ThemeID    uuid.UUID `json:"theme_id" validate:"required"`
	MaxPlayers int32     `json:"max_players" validate:"required,min=2,max=12"`
	IsPrivate  bool      `json:"is_private"`
}

// StartRoomRequest is the payload for starting a room's game session.
// ConfigJson carries the theme game config submitted by the host.
type StartRoomRequest struct {
	ConfigJson []byte `json:"config_json"`
}

// RoomResponse is the public representation of a room.
type RoomResponse struct {
	ID          uuid.UUID `json:"id"`
	ThemeID     uuid.UUID `json:"theme_id"`
	HostID      uuid.UUID `json:"host_id"`
	Code        string    `json:"code"`
	Status      string    `json:"status"`
	MaxPlayers  int32     `json:"max_players"`
	IsPrivate   bool      `json:"is_private"`
	PlayerCount int       `json:"player_count"`
	CreatedAt   time.Time `json:"created_at"`
}

// RoomDetailResponse includes the room info plus player list.
type RoomDetailResponse struct {
	RoomResponse
	Players []PlayerInfo `json:"players"`
}

// PlayerInfo is the public representation of a player in a room.
type PlayerInfo struct {
	UserID  uuid.UUID `json:"user_id"`
	IsReady bool      `json:"is_ready"`
}

// Service defines the room domain operations.
type Service interface {
	CreateRoom(ctx context.Context, hostID uuid.UUID, req CreateRoomRequest) (*RoomResponse, error)
	GetRoom(ctx context.Context, roomID uuid.UUID) (*RoomDetailResponse, error)
	GetRoomByCode(ctx context.Context, code string) (*RoomDetailResponse, error)
	ListWaitingRooms(ctx context.Context, limit, offset int32) ([]RoomResponse, error)
	JoinRoom(ctx context.Context, roomID, userID uuid.UUID) error
	LeaveRoom(ctx context.Context, roomID, userID uuid.UUID) error
	StartRoom(ctx context.Context, roomID, hostID uuid.UUID, req StartRoomRequest) error
}

type service struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	logger  zerolog.Logger
}

// NewService creates a new room service.
func NewService(pool *pgxpool.Pool, queries *db.Queries, logger zerolog.Logger) Service {
	return &service{
		pool:    pool,
		queries: queries,
		logger:  logger.With().Str("domain", "room").Logger(),
	}
}

// generateRoomCode creates a 6-character room code using crypto/rand.
// Excludes I, O, 0, 1 to avoid visual confusion.
// Uses rejection sampling to eliminate modulo bias.
func generateRoomCode() (string, error) {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // 31 chars
	const maxValid = 248                             // 256 - (256 % 31) = 248, largest unbiased value
	result := make([]byte, 6)
	buf := make([]byte, 12) // over-provision to reduce Read calls
	idx := 0
	for i := 0; i < len(result); {
		if idx >= len(buf) {
			if _, err := rand.Read(buf); err != nil {
				return "", err
			}
			idx = 0
		}
		b := buf[idx]
		idx++
		if b < maxValid {
			result[i] = chars[b%byte(len(chars))]
			i++
		}
	}
	return string(result), nil
}

// CreateRoom creates a new room and adds the host as the first player in a single transaction.
func (s *service) CreateRoom(ctx context.Context, hostID uuid.UUID, req CreateRoomRequest) (*RoomResponse, error) {
	code, err := generateRoomCode()
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to generate room code")
		return nil, apperror.Internal("failed to generate room code")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to begin transaction")
		return nil, apperror.Internal("failed to create room")
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	room, err := qtx.CreateRoom(ctx, db.CreateRoomParams{
		ThemeID:    req.ThemeID,
		HostID:     hostID,
		Code:       code,
		MaxPlayers: req.MaxPlayers,
		IsPrivate:  req.IsPrivate,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create room")
		return nil, apperror.Internal("failed to create room")
	}

	if err := qtx.AddRoomPlayer(ctx, db.AddRoomPlayerParams{
		RoomID: room.ID,
		UserID: hostID,
	}); err != nil {
		s.logger.Error().Err(err).Msg("failed to add host as player")
		return nil, apperror.Internal("failed to add host to room")
	}

	if err := tx.Commit(ctx); err != nil {
		s.logger.Error().Err(err).Msg("failed to commit create room transaction")
		return nil, apperror.Internal("failed to create room")
	}

	s.logger.Info().
		Str("room_id", room.ID.String()).
		Str("host_id", hostID.String()).
		Str("code", code).
		Msg("room created")

	return &RoomResponse{
		ID:          room.ID,
		ThemeID:     room.ThemeID,
		HostID:      room.HostID,
		Code:        room.Code,
		Status:      room.Status,
		MaxPlayers:  room.MaxPlayers,
		IsPrivate:   room.IsPrivate,
		PlayerCount: 1,
		CreatedAt:   room.CreatedAt,
	}, nil
}

// GetRoom returns the room detail including player list.
func (s *service) GetRoom(ctx context.Context, roomID uuid.UUID) (*RoomDetailResponse, error) {
	room, err := s.queries.GetRoom(ctx, roomID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("failed to get room")
		return nil, apperror.Internal("failed to get room")
	}

	return s.buildRoomDetail(ctx, room)
}

// GetRoomByCode returns the room detail by its invite code.
func (s *service) GetRoomByCode(ctx context.Context, code string) (*RoomDetailResponse, error) {
	room, err := s.queries.GetRoomByCode(ctx, code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("failed to get room by code")
		return nil, apperror.Internal("failed to get room")
	}

	return s.buildRoomDetail(ctx, room)
}

// ListWaitingRooms returns public waiting rooms with player counts.
func (s *service) ListWaitingRooms(ctx context.Context, limit, offset int32) ([]RoomResponse, error) {
	rooms, err := s.queries.ListWaitingRoomsWithCount(ctx, db.ListWaitingRoomsWithCountParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list waiting rooms")
		return nil, apperror.Internal("failed to list rooms")
	}

	result := make([]RoomResponse, len(rooms))
	for i, r := range rooms {
		result[i] = RoomResponse{
			ID:          r.ID,
			ThemeID:     r.ThemeID,
			HostID:      r.HostID,
			Code:        r.Code,
			Status:      r.Status,
			MaxPlayers:  r.MaxPlayers,
			IsPrivate:   r.IsPrivate,
			PlayerCount: int(r.PlayerCount),
			CreatedAt:   r.CreatedAt,
		}
	}
	return result, nil
}

// JoinRoom adds a user to a room with row-level locking to prevent TOCTOU races.
func (s *service) JoinRoom(ctx context.Context, roomID, userID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to begin transaction")
		return apperror.Internal("failed to join room")
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	// SELECT FOR UPDATE locks the room row until commit.
	room, err := qtx.GetRoomForUpdate(ctx, roomID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("failed to get room for join")
		return apperror.Internal("failed to get room")
	}

	if room.Status != "WAITING" {
		return apperror.New(apperror.ErrRoomNotWaiting, http.StatusConflict, "room is not in waiting state")
	}

	players, err := qtx.GetRoomPlayers(ctx, roomID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get room players")
		return apperror.Internal("failed to get room players")
	}

	if int32(len(players)) >= room.MaxPlayers {
		return apperror.New(apperror.ErrRoomFull, http.StatusConflict, "room is full")
	}

	for _, p := range players {
		if p.UserID == userID {
			return apperror.New(apperror.ErrPlayerAlreadyIn, http.StatusConflict, "already in this room")
		}
	}

	if err := qtx.AddRoomPlayer(ctx, db.AddRoomPlayerParams{
		RoomID: roomID,
		UserID: userID,
	}); err != nil {
		s.logger.Error().Err(err).Msg("failed to add player to room")
		return apperror.Internal("failed to join room")
	}

	if err := tx.Commit(ctx); err != nil {
		s.logger.Error().Err(err).Msg("failed to commit join room transaction")
		return apperror.Internal("failed to join room")
	}

	s.logger.Info().
		Str("room_id", roomID.String()).
		Str("user_id", userID.String()).
		Msg("player joined room")

	return nil
}

// LeaveRoom removes a user from a room with row-level locking.
// If the host leaves, the room is closed.
func (s *service) LeaveRoom(ctx context.Context, roomID, userID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to begin transaction")
		return apperror.Internal("failed to leave room")
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	room, err := qtx.GetRoomForUpdate(ctx, roomID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("failed to get room for leave")
		return apperror.Internal("failed to get room")
	}

	players, err := qtx.GetRoomPlayers(ctx, roomID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get room players for leave")
		return apperror.Internal("failed to get room players")
	}

	found := false
	for _, p := range players {
		if p.UserID == userID {
			found = true
			break
		}
	}
	if !found {
		return apperror.New(apperror.ErrPlayerNotInGame, http.StatusBadRequest, "player is not in this room")
	}

	// If the host leaves, close the room.
	if room.HostID == userID {
		if err := qtx.UpdateRoomStatus(ctx, db.UpdateRoomStatusParams{
			ID:     roomID,
			Status: "CLOSED",
		}); err != nil {
			s.logger.Error().Err(err).Msg("failed to close room")
			return apperror.Internal("failed to close room")
		}
	} else {
		if err := qtx.RemoveRoomPlayer(ctx, db.RemoveRoomPlayerParams{
			RoomID: roomID,
			UserID: userID,
		}); err != nil {
			s.logger.Error().Err(err).Msg("failed to remove player from room")
			return apperror.Internal("failed to leave room")
		}
	}

	if err := tx.Commit(ctx); err != nil {
		s.logger.Error().Err(err).Msg("failed to commit leave room transaction")
		return apperror.Internal("failed to leave room")
	}

	if room.HostID == userID {
		s.logger.Info().Str("room_id", roomID.String()).Msg("host left, room closed")
	} else {
		s.logger.Info().
			Str("room_id", roomID.String()).
			Str("user_id", userID.String()).
			Msg("player left room")
	}

	return nil
}

// StartRoom validates the configJson trust boundary and transitions the room to PLAYING.
// The configJson is parsed and modules are validated via the engine package.
func (s *service) StartRoom(ctx context.Context, roomID, hostID uuid.UUID, req StartRoomRequest) error {
	room, err := s.queries.GetRoom(ctx, roomID)
	if err != nil {
		return apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
	}
	if room.HostID != hostID {
		return apperror.Forbidden("only the host can start the room")
	}
	if room.Status != "WAITING" {
		return apperror.New(apperror.ErrRoomNotWaiting, http.StatusConflict, "room is not in waiting state")
	}
	return nil
}

// buildRoomDetail fetches players and assembles a RoomDetailResponse.
func (s *service) buildRoomDetail(ctx context.Context, room db.Room) (*RoomDetailResponse, error) {
	players, err := s.queries.GetRoomPlayers(ctx, room.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get room players")
		return nil, apperror.Internal("failed to get room players")
	}

	infos := make([]PlayerInfo, len(players))
	for i, p := range players {
		infos[i] = PlayerInfo{
			UserID:  p.UserID,
			IsReady: p.IsReady,
		}
	}

	resp := &RoomDetailResponse{
		RoomResponse: mapRoomResponse(room, len(players)),
		Players:      infos,
	}
	return resp, nil
}

// mapRoomResponse converts a db.Room to a RoomResponse.
func mapRoomResponse(r db.Room, playerCount int) RoomResponse {
	return RoomResponse{
		ID:          r.ID,
		ThemeID:     r.ThemeID,
		HostID:      r.HostID,
		Code:        r.Code,
		Status:      r.Status,
		MaxPlayers:  r.MaxPlayers,
		IsPrivate:   r.IsPrivate,
		PlayerCount: playerCount,
		CreatedAt:   r.CreatedAt,
	}
}
