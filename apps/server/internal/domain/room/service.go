package room

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// CreateRoomRequest is the payload for creating a new room.
//
// MaxPlayers is optional. When omitted (nil), the server falls back to the
// theme's MaxPlayers value. When present, it must lie within the theme's
// [MinPlayers, MaxPlayers] range, otherwise a VALIDATION_ERROR is returned.
type CreateRoomRequest struct {
	ThemeID    uuid.UUID `json:"theme_id" validate:"required"`
	MaxPlayers *int32    `json:"max_players,omitempty" validate:"omitempty,min=2,max=12"`
	IsPrivate  bool      `json:"is_private"`
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
	Theme   ThemeSummary `json:"theme"`
}

// ThemeSummary is the compact theme representation embedded in room detail.
type ThemeSummary struct {
	ID          uuid.UUID `json:"id"`
	Title       string    `json:"title"`
	Slug        string    `json:"slug"`
	Description *string   `json:"description,omitempty"`
	CoverImage  *string   `json:"cover_image,omitempty"`
	MinPlayers  int32     `json:"min_players"`
	MaxPlayers  int32     `json:"max_players"`
	DurationMin int32     `json:"duration_min"`
	Price       int32     `json:"price"`
	CoinPrice   int32     `json:"coin_price"`
	CreatorID   uuid.UUID `json:"creator_id"`
}

// PlayerInfo is the public representation of a player in a room.
//
// Phase 18.8 follow-up (#5): FE `RoomPlayer` 가 nickname/avatar_url/is_host
// 를 사용하므로 서버 SSOT 도 동일 필드를 직렬화한다. 기존 user_id/is_ready
// 는 유지.
type PlayerInfo struct {
	UserID      uuid.UUID  `json:"user_id"`
	CharacterID *uuid.UUID `json:"character_id,omitempty"`
	Nickname    string     `json:"nickname"`
	AvatarURL   *string    `json:"avatar_url,omitempty"`
	IsHost      bool       `json:"is_host"`
	IsReady     bool       `json:"is_ready"`
}

// StartRoomRequest is the payload for POST /rooms/:id/start.
type StartRoomRequest struct {
	// ConfigJSON is the scenario config produced by the editor.
	// If empty, the room's theme configJson is loaded from the DB.
	ConfigJSON []byte `json:"configJson,omitempty"`
}

// SetReadyRequest is the payload for POST /rooms/:id/ready.
type SetReadyRequest struct {
	IsReady bool `json:"is_ready"`
}

// SelectCharacterRequest is the payload for PUT /rooms/:id/character.
type SelectCharacterRequest struct {
	CharacterID uuid.UUID `json:"character_id"`
}

// RoomInviteRequest is the payload for POST /rooms/:id/invites.
type RoomInviteRequest struct {
	FriendIDs []uuid.UUID `json:"friend_ids"`
}

// RoomInviteSent reports a target that passed all validation and was eligible
// for realtime delivery.
type RoomInviteSent struct {
	FriendID uuid.UUID `json:"friend_id"`
	Nickname string    `json:"nickname"`
	Online   bool      `json:"online"`
}

// RoomInviteSkipped reports a target that could not receive this invite.
type RoomInviteSkipped struct {
	FriendID uuid.UUID `json:"friend_id"`
	Reason   string    `json:"reason"`
}

// RoomInviteResponse is the room invite MVP response. No durable invite row is
// written; callers should treat Sent.Online=false as "eligible but no online
// realtime delivery was confirmed".
type RoomInviteResponse struct {
	Sent    []RoomInviteSent    `json:"sent"`
	Skipped []RoomInviteSkipped `json:"skipped"`
}

// RoomInviteNotification is the payload handed to the online social notifier.
type RoomInviteNotification struct {
	RoomID          uuid.UUID `json:"room_id"`
	Code            string    `json:"code"`
	ThemeTitle      string    `json:"theme_title"`
	InviterID       uuid.UUID `json:"inviter_id"`
	InviterNickname string    `json:"inviter_nickname"`
}

// Service defines the room domain operations.
type Service interface {
	CreateRoom(ctx context.Context, hostID uuid.UUID, req CreateRoomRequest) (*RoomResponse, error)
	GetRoom(ctx context.Context, roomID uuid.UUID) (*RoomDetailResponse, error)
	GetRoomForUser(ctx context.Context, roomID, userID uuid.UUID) (*RoomDetailResponse, error)
	GetRoomByCode(ctx context.Context, code string) (*RoomDetailResponse, error)
	ListWaitingRooms(ctx context.Context, limit, offset int32) ([]RoomResponse, error)
	JoinRoom(ctx context.Context, roomID, userID uuid.UUID) error
	LeaveRoom(ctx context.Context, roomID, userID uuid.UUID) error
	SetReady(ctx context.Context, roomID, userID uuid.UUID, ready bool) error
	SelectCharacter(ctx context.Context, roomID, userID uuid.UUID, req SelectCharacterRequest) error
	InviteFriends(ctx context.Context, roomID, inviterID uuid.UUID, req RoomInviteRequest) (*RoomInviteResponse, error)
	StartRoom(ctx context.Context, roomID, hostID uuid.UUID, req StartRoomRequest) error
}

// GameStartPlayer is the player-facing roster input handed to the runtime
// session when a waiting room starts.
type GameStartPlayer struct {
	UserID                uuid.UUID
	CharacterID           *uuid.UUID
	Nickname              string
	AvatarURL             *string
	IsHost                bool
	IsReady               bool
	JoinedAt              time.Time
	CharacterName         string
	CharacterImageURL     *string
	CharacterImageMediaID *string
	CharacterAliasRules   json.RawMessage
}

// GameStarter abstracts startModularGame so the room service has no direct
// dependency on the session package.
type GameStarter interface {
	Start(ctx context.Context, roomID, themeID uuid.UUID, configJSON []byte, players []GameStartPlayer) error
}

// RoomInviteNotifier is intentionally tiny so main wiring can adapt the social
// WebSocket hub without coupling room service to ws/social packages.
type RoomInviteNotifier interface {
	NotifyRoomInvite(ctx context.Context, userID uuid.UUID, payload RoomInviteNotification) (online bool, err error)
}

type service struct {
	pool           *pgxpool.Pool
	queries        roomQueries
	logger         zerolog.Logger
	gameStarter    GameStarter // nil → legacy (flag off)
	inviteNotifier RoomInviteNotifier
}

// NewService creates a new room service.
func NewService(pool *pgxpool.Pool, queries *db.Queries, logger zerolog.Logger) Service {
	return &service{
		pool:    pool,
		queries: queries,
		logger:  logger.With().Str("domain", "room").Logger(),
	}
}

// NewServiceWithStarter creates a room service with a GameStarter for the
// game_runtime_v2 feature flag path.
func NewServiceWithStarter(pool *pgxpool.Pool, queries *db.Queries, logger zerolog.Logger, starter GameStarter) Service {
	return &service{
		pool:        pool,
		queries:     queries,
		logger:      logger.With().Str("domain", "room").Logger(),
		gameStarter: starter,
	}
}

// NewServiceWithInviteNotifier creates a room service with realtime invite
// delivery enabled. Kept separate from NewService so existing wiring remains
// unchanged until main Codex wires the social hub adapter.
func NewServiceWithInviteNotifier(pool *pgxpool.Pool, queries *db.Queries, logger zerolog.Logger, notifier RoomInviteNotifier) Service {
	return &service{
		pool:           pool,
		queries:        queries,
		logger:         logger.With().Str("domain", "room").Logger(),
		inviteNotifier: notifier,
	}
}

// NewServiceWithStarterAndInviteNotifier wires both optional runtime adapters.
func NewServiceWithStarterAndInviteNotifier(pool *pgxpool.Pool, queries *db.Queries, logger zerolog.Logger, starter GameStarter, notifier RoomInviteNotifier) Service {
	return &service{
		pool:           pool,
		queries:        queries,
		logger:         logger.With().Str("domain", "room").Logger(),
		gameStarter:    starter,
		inviteNotifier: notifier,
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
	theme, err := s.queries.GetTheme(ctx, req.ThemeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrNotFound, http.StatusNotFound, "theme not found")
		}
		s.logger.Error().Err(err).Msg("failed to get theme for room creation")
		return nil, apperror.Internal("failed to create room")
	}
	// PR-1 security follow-up: 공개되지 않은 theme (DRAFT / REVIEW_PENDING / ARCHIVED)
	// ID 를 추측한 사용자가 방을 생성하지 못하도록 status 필터 추가. oracle 공격
	// 방어를 위해 404 NotFound 로 응답한다 (존재 여부 자체를 숨김).
	if theme.Status != "PUBLISHED" {
		s.logger.Warn().
			Str("theme_id", req.ThemeID.String()).
			Str("status", theme.Status).
			Msg("create room rejected: theme not published")
		return nil, apperror.New(apperror.ErrNotFound, http.StatusNotFound, "theme not found")
	}

	maxPlayers, fallback, err := resolveMaxPlayers(theme, req.MaxPlayers)
	if err != nil {
		return nil, err
	}
	if fallback {
		s.logger.Info().
			Str("theme_id", req.ThemeID.String()).
			Int32("max_players", maxPlayers).
			Str("source", "theme-fallback").
			Msg("max_players omitted; applied theme default")
	}

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
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)

	room, err := qtx.CreateRoom(ctx, db.CreateRoomParams{
		ThemeID:    req.ThemeID,
		HostID:     hostID,
		Code:       code,
		MaxPlayers: maxPlayers,
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

	resp := mapRoomResponse(room, 1)
	return &resp, nil
}

// GetRoom returns public room detail. Character selections are intentionally
// redacted because public room/code lookups are available before joining.
func (s *service) GetRoom(ctx context.Context, roomID uuid.UUID) (*RoomDetailResponse, error) {
	room, err := s.queries.GetRoom(ctx, roomID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("failed to get room")
		return nil, apperror.Internal("failed to get room")
	}

	return s.buildRoomDetail(ctx, room, false)
}

// GetRoomForUser returns room detail with participant-only pre-game state.
func (s *service) GetRoomForUser(ctx context.Context, roomID, userID uuid.UUID) (*RoomDetailResponse, error) {
	room, err := s.queries.GetRoom(ctx, roomID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("failed to get room")
		return nil, apperror.Internal("failed to get room")
	}

	resp, err := s.buildRoomDetail(ctx, room, true)
	if err != nil {
		return nil, err
	}
	if !hasPlayerInfo(resp.Players, userID) {
		return nil, apperror.New(apperror.ErrPlayerNotInGame, http.StatusForbidden, "player is not in this room")
	}
	return resp, nil
}

// GetRoomByCode returns public room detail by its invite code. Character
// selections are redacted until the caller joins and uses GetRoomForUser.
func (s *service) GetRoomByCode(ctx context.Context, code string) (*RoomDetailResponse, error) {
	room, err := s.queries.GetRoomByCode(ctx, code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("failed to get room by code")
		return nil, apperror.Internal("failed to get room")
	}

	return s.buildRoomDetail(ctx, room, false)
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

	// Phase 18.8 follow-up (#3 DRY): sqlc Row 는 db.Room 필드를 평탄화한
	// 형태이므로 임시 db.Room 으로 매핑한 뒤 공통 mapRoomResponse 를 호출한다.
	// RoomResponse 필드 추가 시 두 경로의 동기화 누락 위험 제거.
	result := make([]RoomResponse, len(rooms))
	for i, r := range rooms {
		room := db.Room{
			ID:         r.ID,
			ThemeID:    r.ThemeID,
			HostID:     r.HostID,
			Code:       r.Code,
			Status:     r.Status,
			MaxPlayers: r.MaxPlayers,
			IsPrivate:  r.IsPrivate,
			CreatedAt:  r.CreatedAt,
		}
		result[i] = mapRoomResponse(room, int(r.PlayerCount))
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
	defer tx.Rollback(ctx) //nolint:errcheck

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
	defer tx.Rollback(ctx) //nolint:errcheck

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

// SetReady updates a participant's pre-game ready state.
func (s *service) SetReady(ctx context.Context, roomID, userID uuid.UUID, ready bool) error {
	room, err := s.queries.GetRoom(ctx, roomID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("SetReady: failed to get room")
		return apperror.Internal("failed to get room")
	}
	if room.Status != "WAITING" {
		return apperror.New(apperror.ErrRoomNotWaiting, http.StatusConflict, "room is not in waiting state")
	}

	players, err := s.queries.GetRoomPlayers(ctx, roomID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("room_id", roomID).Msg("SetReady: failed to get room players")
		return apperror.Internal("failed to get room players")
	}
	if !hasRoomPlayer(players, userID) {
		return apperror.New(apperror.ErrPlayerNotInGame, http.StatusForbidden, "player is not in this room")
	}

	if err := s.queries.SetPlayerReady(ctx, db.SetPlayerReadyParams{
		RoomID:  roomID,
		UserID:  userID,
		IsReady: ready,
	}); err != nil {
		s.logger.Error().Err(err).Stringer("room_id", roomID).Stringer("user_id", userID).Msg("SetReady: failed to update ready state")
		return apperror.Internal("failed to update ready state")
	}
	return nil
}

// SelectCharacter persists a waiting-room participant's playable character
// selection after validating room state, participant membership, and theme
// ownership.
func (s *service) SelectCharacter(ctx context.Context, roomID, userID uuid.UUID, req SelectCharacterRequest) error {
	if req.CharacterID == uuid.Nil {
		return apperror.BadRequest("character_id is required")
	}

	room, err := s.queries.GetRoom(ctx, roomID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("SelectCharacter: failed to get room")
		return apperror.Internal("failed to get room")
	}
	if room.Status != "WAITING" {
		return apperror.New(apperror.ErrRoomNotWaiting, http.StatusConflict, "room is not in waiting state")
	}

	players, err := s.queries.GetRoomPlayers(ctx, roomID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("room_id", roomID).Msg("SelectCharacter: failed to get room players")
		return apperror.Internal("failed to get room players")
	}
	if !hasRoomPlayer(players, userID) {
		return apperror.New(apperror.ErrPlayerNotInGame, http.StatusForbidden, "player is not in this room")
	}

	character, err := s.queries.GetThemeCharacter(ctx, req.CharacterID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.NotFound("character not found")
		}
		s.logger.Error().Err(err).Stringer("character_id", req.CharacterID).Msg("SelectCharacter: failed to get character")
		return apperror.Internal("failed to get character")
	}
	if character.ThemeID != room.ThemeID {
		return apperror.BadRequest("character does not belong to this room theme")
	}
	if !character.IsPlayable {
		return apperror.BadRequest("character is not playable")
	}
	for _, player := range players {
		if player.UserID == userID || !player.CharacterID.Valid {
			continue
		}
		if uuid.UUID(player.CharacterID.Bytes) == req.CharacterID {
			return apperror.Conflict("character already selected")
		}
	}

	rowsAffected, err := s.queries.SetRoomPlayerCharacter(ctx, db.SetRoomPlayerCharacterParams{
		RoomID: roomID,
		UserID: userID,
		CharacterID: pgtype.UUID{
			Bytes: req.CharacterID,
			Valid: true,
		},
	})
	if err != nil {
		if isUniqueViolation(err) {
			return apperror.Conflict("character already selected")
		}
		s.logger.Error().Err(err).Stringer("room_id", roomID).Stringer("user_id", userID).Stringer("character_id", req.CharacterID).Msg("SelectCharacter: failed to update character")
		return apperror.Internal("failed to update character")
	}
	if rowsAffected == 0 {
		latestRoom, latestErr := s.queries.GetRoom(ctx, roomID)
		if latestErr == nil && latestRoom.Status != "WAITING" {
			return apperror.New(apperror.ErrRoomNotWaiting, http.StatusConflict, "room is not in waiting state")
		}
		return apperror.New(apperror.ErrPlayerNotInGame, http.StatusForbidden, "player is not in this room")
	}
	return nil
}

// InviteFriends validates friend targets for a waiting-room participant and
// pushes online notifications. This MVP deliberately does not persist invites;
// when no notifier is wired, eligible targets are returned as sent with
// online=false so the API stays usable during staged integration.
func (s *service) InviteFriends(ctx context.Context, roomID, inviterID uuid.UUID, req RoomInviteRequest) (*RoomInviteResponse, error) {
	if len(req.FriendIDs) == 0 {
		return nil, apperror.BadRequest("friend_ids is required")
	}

	room, err := s.queries.GetRoom(ctx, roomID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("InviteFriends: failed to get room")
		return nil, apperror.Internal("failed to get room")
	}
	if room.Status != "WAITING" {
		return nil, apperror.New(apperror.ErrRoomNotWaiting, http.StatusConflict, "room is not in waiting state")
	}
	if room.HostID != inviterID {
		return nil, apperror.New(apperror.ErrForbidden, http.StatusForbidden, "only the host can invite friends")
	}

	players, err := s.queries.GetRoomPlayers(ctx, roomID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("room_id", roomID).Msg("InviteFriends: failed to get room players")
		return nil, apperror.Internal("failed to get room players")
	}
	if !hasRoomPlayer(players, inviterID) {
		return nil, apperror.New(apperror.ErrPlayerNotInGame, http.StatusForbidden, "player is not in this room")
	}

	theme, err := s.queries.GetTheme(ctx, room.ThemeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrNotFound, http.StatusNotFound, "theme not found")
		}
		s.logger.Error().Err(err).Stringer("theme_id", room.ThemeID).Msg("InviteFriends: failed to get theme")
		return nil, apperror.Internal("failed to get theme")
	}
	inviter, err := s.queries.GetUser(ctx, inviterID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("inviter_id", inviterID).Msg("InviteFriends: failed to get inviter")
		return nil, apperror.Internal("failed to invite friends")
	}

	resp := &RoomInviteResponse{
		Sent:    []RoomInviteSent{},
		Skipped: []RoomInviteSkipped{},
	}
	participantIDs := make(map[uuid.UUID]struct{}, len(players))
	for _, player := range players {
		participantIDs[player.UserID] = struct{}{}
	}
	seen := make(map[uuid.UUID]struct{}, len(req.FriendIDs))
	payload := RoomInviteNotification{
		RoomID:          room.ID,
		Code:            room.Code,
		ThemeTitle:      theme.Title,
		InviterID:       inviterID,
		InviterNickname: inviter.Nickname,
	}

	for _, friendID := range req.FriendIDs {
		if friendID == uuid.Nil {
			resp.Skipped = append(resp.Skipped, RoomInviteSkipped{FriendID: friendID, Reason: "invalid_friend_id"})
			continue
		}
		if _, exists := seen[friendID]; exists {
			resp.Skipped = append(resp.Skipped, RoomInviteSkipped{FriendID: friendID, Reason: "duplicate"})
			continue
		}
		seen[friendID] = struct{}{}
		if _, inRoom := participantIDs[friendID]; inRoom {
			resp.Skipped = append(resp.Skipped, RoomInviteSkipped{FriendID: friendID, Reason: "already_participant"})
			continue
		}

		target, skipReason, err := s.validateInviteTarget(ctx, inviterID, friendID)
		if err != nil {
			return nil, err
		}
		if skipReason != "" {
			resp.Skipped = append(resp.Skipped, RoomInviteSkipped{FriendID: friendID, Reason: skipReason})
			continue
		}

		online := false
		if s.inviteNotifier != nil {
			online, err = s.inviteNotifier.NotifyRoomInvite(ctx, friendID, payload)
			if err != nil {
				s.logger.Error().Err(err).Stringer("friend_id", friendID).Msg("InviteFriends: notifier failed")
				resp.Skipped = append(resp.Skipped, RoomInviteSkipped{FriendID: friendID, Reason: "notification_failed"})
				continue
			}
		}
		resp.Sent = append(resp.Sent, RoomInviteSent{FriendID: friendID, Nickname: target.Nickname, Online: online})
	}
	return resp, nil
}

func (s *service) validateInviteTarget(ctx context.Context, inviterID, friendID uuid.UUID) (db.User, string, error) {
	friendship, err := s.queries.GetFriendshipBetween(ctx, db.GetFriendshipBetweenParams{
		RequesterID: inviterID,
		AddresseeID: friendID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.User{}, "not_friend", nil
		}
		s.logger.Error().Err(err).Stringer("friend_id", friendID).Msg("InviteFriends: failed to get friendship")
		return db.User{}, "", apperror.Internal("failed to validate invite target")
	}
	if friendship.Status != "ACCEPTED" {
		return db.User{}, "not_friend", nil
	}

	blocked, err := s.queries.IsBlocked(ctx, db.IsBlockedParams{BlockerID: inviterID, BlockedID: friendID})
	if err != nil {
		s.logger.Error().Err(err).Stringer("friend_id", friendID).Msg("InviteFriends: failed to check block")
		return db.User{}, "", apperror.Internal("failed to validate invite target")
	}
	if blocked {
		return db.User{}, "blocked", nil
	}

	prefs, err := s.queries.GetNotificationPrefs(ctx, friendID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		s.logger.Error().Err(err).Stringer("friend_id", friendID).Msg("InviteFriends: failed to get notification prefs")
		return db.User{}, "", apperror.Internal("failed to validate invite target")
	}
	if err == nil && !prefs.GameInvite {
		return db.User{}, "notification_disabled", nil
	}

	target, err := s.queries.GetUser(ctx, friendID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.User{}, "not_friend", nil
		}
		s.logger.Error().Err(err).Stringer("friend_id", friendID).Msg("InviteFriends: failed to get target user")
		return db.User{}, "", apperror.Internal("failed to validate invite target")
	}
	return target, "", nil
}

// buildRoomDetail fetches players (with user JOIN) and assembles a
// RoomDetailResponse. is_host 는 room.HostID 와 user_id 비교로 결정한다.
func (s *service) buildRoomDetail(ctx context.Context, room db.Room, includeCharacterSelection bool) (*RoomDetailResponse, error) {
	players, err := s.queries.GetRoomPlayersWithUser(ctx, room.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get room players")
		return nil, apperror.Internal("failed to get room players")
	}
	theme, err := s.queries.GetTheme(ctx, room.ThemeID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("theme_id", room.ThemeID).Msg("failed to get room theme")
		return nil, apperror.Internal("failed to get room theme")
	}

	infos := make([]PlayerInfo, len(players))
	for i, p := range players {
		infos[i] = PlayerInfo{
			UserID:    p.UserID,
			Nickname:  p.Nickname,
			AvatarURL: textToPtr(p.AvatarUrl),
			IsHost:    p.UserID == room.HostID,
			IsReady:   p.IsReady,
		}
		if includeCharacterSelection {
			infos[i].CharacterID = pgUUIDToPtr(p.CharacterID)
		}
	}

	resp := &RoomDetailResponse{
		RoomResponse: mapRoomResponse(room, len(players)),
		Players:      infos,
		Theme:        mapThemeSummary(theme),
	}
	return resp, nil
}

func pgUUIDToPtr(value pgtype.UUID) *uuid.UUID {
	if !value.Valid {
		return nil
	}
	id := uuid.UUID(value.Bytes)
	return &id
}

// textToPtr converts pgtype.Text to *string (nil when NULL).
func textToPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

// StartRoom validates host ownership, checks all players are ready, then
// delegates to GameStarter (game_runtime_v2 flag on) or returns a stub
// response for the legacy path (flag off).
func (s *service) StartRoom(ctx context.Context, roomID, hostID uuid.UUID, req StartRoomRequest) error {
	if s.pool == nil {
		return s.startRoomLocked(ctx, s.queries, roomID, hostID, req)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		s.logger.Error().Err(err).Msg("StartRoom: failed to begin transaction")
		return apperror.Internal("failed to start room")
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := s.queries.WithTx(tx)
	if err := s.startRoomLocked(ctx, qtx, roomID, hostID, req); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		s.logger.Error().Err(err).Str("room_id", roomID.String()).Msg("StartRoom: failed to commit transaction")
		return apperror.Internal("failed to start room")
	}
	return nil
}

func (s *service) startRoomLocked(ctx context.Context, q roomQueries, roomID, hostID uuid.UUID, req StartRoomRequest) error {
	room, err := q.GetRoomForUpdate(ctx, roomID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.New(apperror.ErrRoomNotFound, http.StatusNotFound, "room not found")
		}
		s.logger.Error().Err(err).Msg("StartRoom: failed to lock room")
		return apperror.Internal("failed to get room")
	}

	if room.HostID != hostID {
		return apperror.New(apperror.ErrForbidden, http.StatusForbidden, "only the host can start the game")
	}

	if room.Status != "WAITING" {
		return apperror.New(apperror.ErrRoomNotWaiting, http.StatusConflict, "room is not in waiting state")
	}

	theme, err := q.GetTheme(ctx, room.ThemeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.New(apperror.ErrNotFound, http.StatusNotFound, "theme not found")
		}
		s.logger.Error().Err(err).Stringer("theme_id", room.ThemeID).Msg("StartRoom: failed to get theme")
		return apperror.Internal("failed to get theme")
	}
	playerRows, err := q.GetRoomPlayersWithUser(ctx, room.ID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("room_id", room.ID).Msg("StartRoom: failed to get room players")
		return apperror.Internal("failed to get room players")
	}
	if err := validateStartGateRows(room, theme, playerRows); err != nil {
		return err
	}

	if s.gameStarter == nil {
		// Feature flag off — return 503 so clients get an explicit signal
		// rather than a false success. (M-9 early fix)
		s.logger.Warn().
			Str("room_id", roomID.String()).
			Msg("StartRoom: game_runtime_v2 disabled, returning 503")
		return apperror.New(
			apperror.ErrServiceUnavailable,
			http.StatusServiceUnavailable,
			"game runtime not enabled",
		)
	}

	startPlayers, err := s.buildGameStartPlayers(ctx, room, playerRows)
	if err != nil {
		return err
	}

	if err := q.UpdateRoomStatus(ctx, db.UpdateRoomStatusParams{
		ID:     roomID,
		Status: "PLAYING",
	}); err != nil {
		s.logger.Error().Err(err).Str("room_id", roomID.String()).Msg("StartRoom: failed to mark room as playing")
		return apperror.Internal("failed to update room status")
	}
	if err := s.gameStarter.Start(ctx, roomID, room.ThemeID, req.ConfigJSON, startPlayers); err != nil {
		s.logger.Error().Err(err).Str("room_id", roomID.String()).Msg("StartRoom: gameStarter failed")
		if rollbackErr := q.UpdateRoomStatus(ctx, db.UpdateRoomStatusParams{
			ID:     roomID,
			Status: "WAITING",
		}); rollbackErr != nil {
			s.logger.Error().Err(rollbackErr).Str("room_id", roomID.String()).Msg("StartRoom: failed to roll back room status after gameStarter failure")
		}
		return err
	}

	s.logger.Info().
		Str("room_id", roomID.String()).
		Str("host_id", hostID.String()).
		Msg("StartRoom: game started")
	return nil
}

func validateStartGate(room db.Room, theme db.Theme, players []db.RoomPlayer) error {
	if int32(len(players)) < theme.MinPlayers {
		return apperror.Conflict("not enough players to start")
	}
	for _, player := range players {
		if !player.CharacterID.Valid {
			return apperror.Conflict("all players must select a character")
		}
		if player.UserID == room.HostID {
			continue
		}
		if !player.IsReady {
			return apperror.Conflict("all non-host players must be ready")
		}
	}
	return nil
}

func validateStartGateRows(room db.Room, theme db.Theme, players []db.GetRoomPlayersWithUserRow) error {
	if int32(len(players)) < theme.MinPlayers {
		return apperror.Conflict("not enough players to start")
	}
	for _, player := range players {
		if !player.CharacterID.Valid {
			return apperror.Conflict("all players must select a character")
		}
		if player.UserID == room.HostID {
			continue
		}
		if !player.IsReady {
			return apperror.Conflict("all non-host players must be ready")
		}
	}
	return nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func hasRoomPlayer(players []db.RoomPlayer, userID uuid.UUID) bool {
	for _, player := range players {
		if player.UserID == userID {
			return true
		}
	}
	return false
}

func hasPlayerInfo(players []PlayerInfo, userID uuid.UUID) bool {
	for _, player := range players {
		if player.UserID == userID {
			return true
		}
	}
	return false
}

func (s *service) buildGameStartPlayers(ctx context.Context, room db.Room, rows []db.GetRoomPlayersWithUserRow) ([]GameStartPlayer, error) {
	chars, err := s.queries.GetThemeCharacters(ctx, room.ThemeID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("theme_id", room.ThemeID).Msg("StartRoom: failed to get theme characters")
		return nil, apperror.Internal("failed to get theme characters")
	}
	return mapGameStartPlayers(rows, chars, room.HostID), nil
}

func mapGameStartPlayers(
	rows []db.GetRoomPlayersWithUserRow,
	chars []db.ThemeCharacter,
	hostID uuid.UUID,
) []GameStartPlayer {
	charByID := make(map[uuid.UUID]db.ThemeCharacter, len(chars))
	for _, char := range chars {
		charByID[char.ID] = char
	}

	players := make([]GameStartPlayer, 0, len(rows))
	for _, row := range rows {
		player := GameStartPlayer{
			UserID:    row.UserID,
			Nickname:  row.Nickname,
			AvatarURL: textToPtr(row.AvatarUrl),
			IsHost:    row.UserID == hostID,
			IsReady:   row.IsReady,
			JoinedAt:  row.JoinedAt,
		}
		if row.CharacterID.Valid {
			charID := uuid.UUID(row.CharacterID.Bytes)
			player.CharacterID = &charID
			if char, ok := charByID[charID]; ok {
				player.CharacterName = char.Name
				player.CharacterImageURL = textToPtr(char.ImageUrl)
				player.CharacterImageMediaID = uuidToStringPtr(char.ImageMediaID)
				player.CharacterAliasRules = char.AliasRules
			}
		}
		players = append(players, player)
	}
	return players
}

func uuidToStringPtr(value pgtype.UUID) *string {
	if !value.Valid {
		return nil
	}
	id := uuid.UUID(value.Bytes).String()
	return &id
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

func mapThemeSummary(t db.Theme) ThemeSummary {
	return ThemeSummary{
		ID:          t.ID,
		Title:       t.Title,
		Slug:        t.Slug,
		Description: textToPtr(t.Description),
		CoverImage:  textToPtr(t.CoverImage),
		MinPlayers:  t.MinPlayers,
		MaxPlayers:  t.MaxPlayers,
		DurationMin: t.DurationMin,
		Price:       t.Price,
		CoinPrice:   t.CoinPrice,
		CreatorID:   t.CreatorID,
	}
}
