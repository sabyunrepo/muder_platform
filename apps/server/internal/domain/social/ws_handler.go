package social

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/ws"
)

// SocialWSHandler handles real-time WebSocket messages for the social system.
type SocialWSHandler struct {
	hub      *ws.SocialHub
	chat     ChatService
	friends  FriendService
	presence PresenceProvider
	queries  *db.Queries
	logger   zerolog.Logger
}

// NewSocialWSHandler creates a new handler.
func NewSocialWSHandler(
	hub *ws.SocialHub,
	chat ChatService,
	friends FriendService,
	presence PresenceProvider,
	queries *db.Queries,
	logger zerolog.Logger,
) *SocialWSHandler {
	return &SocialWSHandler{
		hub:      hub,
		chat:     chat,
		friends:  friends,
		presence: presence,
		queries:  queries,
		logger:   logger.With().Str("component", "social.ws").Logger(),
	}
}

// HandleChat handles "chat:*" namespace messages.
func (h *SocialWSHandler) HandleChat(c *ws.Client, env *ws.Envelope) {
	ctx := context.Background()

	switch env.Type {
	case "chat:send":
		h.handleChatSend(ctx, c, env)
	case "chat:typing":
		h.handleChatTyping(ctx, c, env)
	case "chat:read":
		h.handleChatRead(ctx, c, env)
	case "chat:join":
		h.handleChatJoin(ctx, c, env)
	default:
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "unknown chat action: "+env.Type))
	}
}

// HandleFriend handles "friend:*" namespace messages.
func (h *SocialWSHandler) HandleFriend(c *ws.Client, env *ws.Envelope) {
	// Friend namespace is mostly server→client push.
	// Client-originated friend events are handled via REST API.
	c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "friend events are push-only"))
}

// HandlePresence handles "presence:*" namespace messages.
func (h *SocialWSHandler) HandlePresence(c *ws.Client, env *ws.Envelope) {
	ctx := context.Background()

	switch env.Type {
	case "presence:heartbeat":
		if err := h.presence.Heartbeat(ctx, c.ID); err != nil {
			h.logger.Error().Err(err).Stringer("userId", c.ID).Msg("heartbeat failed")
		}
	default:
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "unknown presence action"))
	}
}

// --- Chat handlers ---

type chatSendPayload struct {
	RoomID      uuid.UUID       `json:"room_id"`
	Content     string          `json:"content"`
	MessageType string          `json:"message_type"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
}

func (h *SocialWSHandler) handleChatSend(ctx context.Context, c *ws.Client, env *ws.Envelope) {
	var p chatSendPayload
	if err := json.Unmarshal(env.Payload, &p); err != nil {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "invalid chat:send payload"))
		return
	}

	if p.MessageType == "" {
		p.MessageType = "TEXT"
	}

	msg, err := h.chat.SendMessage(ctx, p.RoomID, c.ID, p.Content, p.MessageType)
	if err != nil {
		h.logger.Warn().Err(err).Stringer("userId", c.ID).Msg("chat:send failed")
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, err.Error()))
		return
	}

	// Broadcast to all room members (including sender for confirmation).
	msgEnv := ws.MustEnvelope("chat:message", msg)
	h.hub.BroadcastToRoom(p.RoomID, msgEnv, uuid.Nil)
}

type chatTypingPayload struct {
	RoomID uuid.UUID `json:"room_id"`
}

func (h *SocialWSHandler) handleChatTyping(ctx context.Context, c *ws.Client, env *ws.Envelope) {
	var p chatTypingPayload
	if err := json.Unmarshal(env.Payload, &p); err != nil {
		return // silently ignore malformed typing events
	}

	// Ephemeral broadcast to room members except sender.
	indicator := ws.MustEnvelope("chat:typing_indicator", map[string]any{
		"room_id": p.RoomID,
		"user_id": c.ID,
	})
	h.hub.BroadcastToRoom(p.RoomID, indicator, c.ID)
}

type chatReadPayload struct {
	RoomID uuid.UUID `json:"room_id"`
}

func (h *SocialWSHandler) handleChatRead(ctx context.Context, c *ws.Client, env *ws.Envelope) {
	var p chatReadPayload
	if err := json.Unmarshal(env.Payload, &p); err != nil {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "invalid chat:read payload"))
		return
	}

	if err := h.chat.MarkAsRead(ctx, p.RoomID, c.ID); err != nil {
		h.logger.Warn().Err(err).Stringer("userId", c.ID).Msg("chat:read failed")
		return
	}

	// Broadcast read receipt to room members.
	receipt := ws.MustEnvelope("chat:read_receipt", map[string]any{
		"room_id": p.RoomID,
		"user_id": c.ID,
		"read_at": time.Now(),
	})
	h.hub.BroadcastToRoom(p.RoomID, receipt, c.ID)
}

type chatJoinPayload struct {
	RoomIDs []uuid.UUID `json:"room_ids"`
}

func (h *SocialWSHandler) handleChatJoin(ctx context.Context, c *ws.Client, env *ws.Envelope) {
	var p chatJoinPayload
	if err := json.Unmarshal(env.Payload, &p); err != nil {
		c.SendMessage(ws.NewErrorEnvelope(ws.ErrCodeBadMessage, "invalid chat:join payload"))
		return
	}

	// Register user in each room for broadcast targeting.
	// Only allow joining rooms where the user is a member.
	for _, roomID := range p.RoomIDs {
		isMember, err := h.queries.IsChatRoomMember(ctx, db.IsChatRoomMemberParams{
			ChatRoomID: roomID,
			UserID:     c.ID,
		})
		if err != nil || !isMember {
			continue
		}
		h.hub.JoinRoom(roomID, c.ID)
	}
}

// --- Public push helpers (called from SocialBridge or service layer) ---

// NotifyFriendRequest sends a real-time friend request notification.
func (h *SocialWSHandler) NotifyFriendRequest(targetID uuid.UUID, req *FriendshipResponse) {
	env := ws.MustEnvelope("friend:request", req)
	h.hub.SendToUser(targetID, env)
}

// NotifyFriendAccepted sends a real-time friend accepted notification.
func (h *SocialWSHandler) NotifyFriendAccepted(targetID uuid.UUID, resp *FriendshipResponse) {
	env := ws.MustEnvelope("friend:accepted", resp)
	h.hub.SendToUser(targetID, env)
}

// NotifyOnlineStatus sends online/offline status to a list of friend user IDs.
func (h *SocialWSHandler) NotifyOnlineStatus(userID uuid.UUID, friendIDs []uuid.UUID, online bool) {
	eventType := "friend:offline"
	if online {
		eventType = "friend:online"
	}
	env := ws.MustEnvelope(eventType, map[string]any{
		"user_id": userID,
	})
	for _, fid := range friendIDs {
		h.hub.SendToUser(fid, env)
	}
}

// OnConnect is called when a social client connects. Sets presence and joins rooms.
func (h *SocialWSHandler) OnConnect(ctx context.Context, userID uuid.UUID) {
	// Set online presence.
	if err := h.presence.SetOnline(ctx, userID); err != nil {
		h.logger.Error().Err(err).Stringer("userId", userID).Msg("failed to set online")
	}

	// Auto-join all user's chat rooms.
	rooms, err := h.queries.ListUserChatRooms(ctx, db.ListUserChatRoomsParams{
		UserID: userID,
		Limit:  100,
		Offset: 0,
	})
	if err != nil {
		h.logger.Error().Err(err).Stringer("userId", userID).Msg("failed to list rooms on connect")
		return
	}
	for _, r := range rooms {
		h.hub.JoinRoom(r.ID, userID)
	}

	// Notify friends that user is online.
	friends, err := h.queries.ListFriends(ctx, db.ListFriendsParams{
		RequesterID: userID,
		Limit:       200,
		Offset:      0,
	})
	if err != nil {
		h.logger.Error().Err(err).Stringer("userId", userID).Msg("failed to list friends for presence")
		return
	}
	friendIDs := make([]uuid.UUID, len(friends))
	for i, f := range friends {
		friendIDs[i] = f.ID
	}
	h.NotifyOnlineStatus(userID, friendIDs, true)
}

// OnDisconnect is called when a social client disconnects.
func (h *SocialWSHandler) OnDisconnect(ctx context.Context, userID uuid.UUID) {
	if err := h.presence.SetOffline(ctx, userID); err != nil {
		h.logger.Error().Err(err).Stringer("userId", userID).Msg("failed to set offline")
	}

	// Notify friends that user is offline.
	friends, err := h.queries.ListFriends(ctx, db.ListFriendsParams{
		RequesterID: userID,
		Limit:       200,
		Offset:      0,
	})
	if err != nil {
		return
	}
	friendIDs := make([]uuid.UUID, len(friends))
	for i, f := range friends {
		friendIDs[i] = f.ID
	}
	h.NotifyOnlineStatus(userID, friendIDs, false)
}
