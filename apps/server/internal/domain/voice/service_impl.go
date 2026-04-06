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
	queries  *db.Queries
	lkURL    string
	logger   zerolog.Logger
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
	// C3: Validate session_id as UUID.
	sessionID, err := uuid.Parse(req.SessionID)
	if err != nil {
		return nil, apperror.BadRequest("session_id must be a valid UUID")
	}

	// C3: Validate room_name format when provided.
	if req.RoomName != "" && !roomNameRe.MatchString(req.RoomName) {
		return nil, apperror.BadRequest("room_name must contain only alphanumerics and hyphens, max 64 characters")
	}

	// C2: Verify the user is a participant of the session.
	players, err := s.queries.GetSessionPlayers(ctx, sessionID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.Forbidden("not a participant of this session")
		}
		s.logger.Error().Err(err).Str("session_id", req.SessionID).Msg("failed to get session players")
		return nil, apperror.Internal("failed to verify session participation")
	}
	found := false
	for _, p := range players {
		if p.UserID == userID {
			found = true
			break
		}
	}
	if !found {
		return nil, apperror.Forbidden("not a participant of this session")
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

	roomName := s.buildRoomName(req)

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
		Msg("voice token issued")

	return &TokenResponse{
		Token:    token,
		URL:      s.lkURL,
		RoomName: roomName,
	}, nil
}

// buildRoomName constructs the LiveKit room name from the request.
// main:    {sessionID}_main
// whisper: {sessionID}_{roomName}
func (s *serviceImpl) buildRoomName(req TokenRequest) string {
	if req.RoomType == "whisper" && req.RoomName != "" {
		return fmt.Sprintf("%s_%s", req.SessionID, req.RoomName)
	}
	return fmt.Sprintf("%s_%s", req.SessionID, req.RoomType)
}
