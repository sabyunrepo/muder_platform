package voice

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

const (
	ttlMain    = 2 * time.Hour
	ttlWhisper = 30 * time.Minute
)

// roomNameRe allows alphanumerics and hyphens, max 64 chars.
var roomNameRe = regexp.MustCompile(`^[a-zA-Z0-9\-]{1,64}$`)

type serviceImpl struct {
	provider VoiceProvider
	queries  voiceQueries
	lkURL    string
	logger   zerolog.Logger
}

type voiceQueries interface {
	GetSessionPlayers(ctx context.Context, sessionID uuid.UUID) ([]db.SessionPlayer, error)
	GetRoom(ctx context.Context, id uuid.UUID) (db.Room, error)
	GetRoomPlayers(ctx context.Context, roomID uuid.UUID) ([]db.RoomPlayer, error)
}

// NewService creates a new voice service.
func NewService(provider VoiceProvider, queries *db.Queries, lkURL string, logger zerolog.Logger) Service {
	return &serviceImpl{
		provider: provider,
		queries:  queries,
		lkURL:    lkURL,
		logger:   logger.With().Str("domain", "voice").Logger(),
	}
}

// GetToken validates the request, ensures the LiveKit room exists, and returns
// a signed token the client can use to connect.
func (s *serviceImpl) GetToken(ctx context.Context, userID uuid.UUID, req TokenRequest) (*TokenResponse, error) {
	// C3: Validate room_name format when provided.
	if req.RoomName != "" && !roomNameRe.MatchString(req.RoomName) {
		return nil, apperror.BadRequest("room_name must contain only alphanumerics and hyphens, max 64 characters")
	}

	target, err := s.resolveTokenTarget(ctx, userID, req)
	if err != nil {
		return nil, err
	}

	var ttl time.Duration
	switch req.RoomType {
	case "main":
		ttl = ttlMain
	case "whisper":
		ttl = ttlWhisper
	default:
		return nil, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest,
			fmt.Sprintf("invalid room_type %q: must be \"main\" or \"whisper\"", req.RoomType))
	}

	roomName := s.buildRoomName(req, target)

	if err := s.provider.CreateRoom(ctx, roomName); err != nil {
		s.logger.Error().Err(err).Str("room", roomName).Msg("failed to create voice room")
		return nil, apperror.Internal("failed to create voice room")
	}

	params := TokenParams{
		PlayerID: userID,
		RoomName: roomName,
		TTL:      ttl,
	}

	token, err := s.provider.GenerateToken(ctx, params)
	if err != nil {
		s.logger.Error().Err(err).
			Str("room", roomName).
			Str("user_id", userID.String()).
			Msg("failed to generate voice token")
		return nil, apperror.Internal("failed to generate voice token")
	}

	s.logger.Info().
		Str("room", roomName).
		Str("user_id", userID.String()).
		Str("room_type", req.RoomType).
		Str("target_kind", target.kind).
		Msg("voice token issued")

	return &TokenResponse{
		Token:    token,
		URL:      s.lkURL,
		RoomName: roomName,
	}, nil
}

type tokenTarget struct {
	kind string
	id   uuid.UUID
}

func (s *serviceImpl) resolveTokenTarget(ctx context.Context, userID uuid.UUID, req TokenRequest) (tokenTarget, error) {
	hasSessionID := req.SessionID != ""
	hasRoomID := req.RoomID != ""
	if hasSessionID == hasRoomID {
		return tokenTarget{}, apperror.BadRequest("exactly one of session_id or room_id is required")
	}
	if hasRoomID {
		return s.resolveWaitingRoomTarget(ctx, userID, req)
	}
	return s.resolveSessionTarget(ctx, userID, req)
}

func (s *serviceImpl) resolveSessionTarget(ctx context.Context, userID uuid.UUID, req TokenRequest) (tokenTarget, error) {
	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		return tokenTarget{}, apperror.BadRequest("session_id must be a valid UUID")
	}

	players, err := s.queries.GetSessionPlayers(ctx, sessionID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return tokenTarget{}, apperror.Forbidden("not a participant of this session")
		}
		s.logger.Error().Err(err).Str("session_id", req.SessionID).Msg("failed to get session players")
		return tokenTarget{}, apperror.Internal("failed to verify session participation")
	}
	for _, p := range players {
		if p.UserID == userID {
			return tokenTarget{kind: "session", id: sessionID}, nil
		}
	}
	return tokenTarget{}, apperror.Forbidden("not a participant of this session")
}

func (s *serviceImpl) resolveWaitingRoomTarget(ctx context.Context, userID uuid.UUID, req TokenRequest) (tokenTarget, error) {
	if req.RoomType != "main" {
		return tokenTarget{}, apperror.BadRequest("waiting room voice only supports main room_type")
	}
	roomID, err := uuid.Parse(req.RoomID)
	if err != nil {
		return tokenTarget{}, apperror.BadRequest("room_id must be a valid UUID")
	}

	room, err := s.queries.GetRoom(ctx, roomID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return tokenTarget{}, apperror.Forbidden("not a participant of this room")
		}
		s.logger.Error().Err(err).Str("room_id", req.RoomID).Msg("failed to get waiting room")
		return tokenTarget{}, apperror.Internal("failed to verify room participation")
	}
	if room.Status != "WAITING" {
		return tokenTarget{}, apperror.New(apperror.ErrRoomNotWaiting, http.StatusConflict, "room is not in waiting state")
	}

	players, err := s.queries.GetRoomPlayers(ctx, roomID)
	if err != nil {
		s.logger.Error().Err(err).Str("room_id", req.RoomID).Msg("failed to get waiting room players")
		return tokenTarget{}, apperror.Internal("failed to verify room participation")
	}
	for _, p := range players {
		if p.UserID == userID {
			return tokenTarget{kind: "room", id: roomID}, nil
		}
	}
	return tokenTarget{}, apperror.Forbidden("not a participant of this room")
}

// buildRoomName constructs the LiveKit room name from the request.
// session main:      {sessionID}_main
// session whisper:   {sessionID}_{roomName}
// waiting room main: room-{roomID}-main
func (s *serviceImpl) buildRoomName(req TokenRequest, target tokenTarget) string {
	if target.kind == "room" {
		return fmt.Sprintf("room-%s-%s", target.id.String(), req.RoomType)
	}
	if req.RoomType == "whisper" && req.RoomName != "" {
		return fmt.Sprintf("%s_%s", req.SessionID, req.RoomName)
	}
	return fmt.Sprintf("%s_%s", req.SessionID, req.RoomType)
}
