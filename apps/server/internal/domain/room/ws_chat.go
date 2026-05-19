package room

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/ws"
	"github.com/rs/zerolog"
)

type roomChatQueries interface {
	GetRoom(ctx context.Context, id uuid.UUID) (db.Room, error)
	GetRoomPlayersWithUser(ctx context.Context, roomID uuid.UUID) ([]db.GetRoomPlayersWithUserRow, error)
}

type roomChatBroadcaster interface {
	SendToPlayer(playerID uuid.UUID, env *ws.Envelope)
}

type LobbyChatWSHandler struct {
	queries     roomChatQueries
	broadcaster roomChatBroadcaster
	logger      zerolog.Logger
}

type lobbyChatSendPayload struct {
	RoomID string `json:"room_id"`
	Text   string `json:"text"`
}

type lobbyChatMessagePayload struct {
	Sender   string `json:"sender"`
	Nickname string `json:"nickname"`
	Text     string `json:"text"`
	TS       int64  `json:"ts"`
}

func NewLobbyChatWSHandler(queries roomChatQueries, broadcaster roomChatBroadcaster, logger zerolog.Logger) *LobbyChatWSHandler {
	return &LobbyChatWSHandler{
		queries:     queries,
		broadcaster: broadcaster,
		logger:      logger.With().Str("component", "room.lobby_chat_ws").Logger(),
	}
}

func (h *LobbyChatWSHandler) HandleChat(c *ws.Client, env *ws.Envelope) {
	if env.Type != "chat:send" {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "unknown chat event type: "+env.Type))
		return
	}

	var payload lobbyChatSendPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "invalid chat:send payload"))
		return
	}

	roomID, err := uuid.Parse(payload.RoomID)
	if err != nil {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "invalid room_id"))
		return
	}

	text := strings.TrimSpace(payload.Text)
	if text == "" {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "empty message"))
		return
	}
	if len([]rune(text)) > 500 {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "message too long"))
		return
	}

	room, err := h.queries.GetRoom(context.Background(), roomID)
	if err != nil {
		h.logger.Error().Err(err).Stringer("roomID", roomID).Msg("failed to load room for lobby chat")
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeInternalError, "failed to send message"))
		return
	}
	if room.Status != "WAITING" {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "room chat is closed"))
		return
	}

	players, err := h.queries.GetRoomPlayersWithUser(context.Background(), roomID)
	if err != nil {
		h.logger.Error().Err(err).Stringer("roomID", roomID).Msg("failed to load room players for lobby chat")
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeInternalError, "failed to send message"))
		return
	}

	senderNickname := ""
	for _, player := range players {
		if player.UserID == c.ID {
			senderNickname = player.Nickname
			break
		}
	}
	if senderNickname == "" {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeUnauthorized, "player not in room"))
		return
	}

	message := lobbyChatMessagePayload{
		Sender:   c.ID.String(),
		Nickname: senderNickname,
		Text:     text,
		TS:       time.Now().UnixMilli(),
	}
	out := ws.MustEnvelope("chat:message", message)
	for _, player := range players {
		h.broadcaster.SendToPlayer(player.UserID, out)
	}
}
