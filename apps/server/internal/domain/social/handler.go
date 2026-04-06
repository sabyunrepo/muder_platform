package social

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// Handler handles social HTTP endpoints (friends, blocks, chat).
type Handler struct {
	friends FriendService
	chat    ChatService
}

// NewHandler creates a new social handler.
func NewHandler(friends FriendService, chat ChatService) *Handler {
	return &Handler{friends: friends, chat: chat}
}

// --- Friends ---

// SendFriendRequest handles POST /friends/request.
func (h *Handler) SendFriendRequest(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req SendFriendRequestReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.friends.SendRequest(r.Context(), userID, req.AddresseeID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// AcceptFriendRequest handles POST /friends/{id}/accept.
func (h *Handler) AcceptFriendRequest(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	friendshipID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid friendship ID"))
		return
	}

	resp, err := h.friends.AcceptRequest(r.Context(), friendshipID, userID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// RejectFriendRequest handles POST /friends/{id}/reject.
func (h *Handler) RejectFriendRequest(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	friendshipID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid friendship ID"))
		return
	}

	if err := h.friends.RejectRequest(r.Context(), friendshipID, userID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "rejected"})
}

// RemoveFriend handles DELETE /friends/{id}.
func (h *Handler) RemoveFriend(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	friendshipID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid friendship ID"))
		return
	}

	if err := h.friends.RemoveFriend(r.Context(), friendshipID, userID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

// ListFriends handles GET /friends.
func (h *Handler) ListFriends(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	pg := httputil.ParsePagination(r, 20, 50)

	friends, err := h.friends.ListFriends(r.Context(), userID, pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, friends)
}

// ListPendingRequests handles GET /friends/pending.
func (h *Handler) ListPendingRequests(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	pg := httputil.ParsePagination(r, 20, 50)

	pending, err := h.friends.ListPendingRequests(r.Context(), userID, pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, pending)
}

// --- Blocks ---

// BlockUser handles POST /blocks.
func (h *Handler) BlockUser(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req BlockUserReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	if err := h.friends.BlockUser(r.Context(), userID, req.BlockedID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, map[string]string{"status": "blocked"})
}

// UnblockUser handles DELETE /blocks/{id}.
func (h *Handler) UnblockUser(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	blockedID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid user ID"))
		return
	}

	if err := h.friends.UnblockUser(r.Context(), userID, blockedID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "unblocked"})
}

// ListBlocks handles GET /blocks.
func (h *Handler) ListBlocks(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	pg := httputil.ParsePagination(r, 20, 50)
	blocks, err := h.friends.ListBlocks(r.Context(), userID, pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, blocks)
}

// --- Chat ---

// GetOrCreateDMRoom handles POST /chat/dm.
func (h *Handler) GetOrCreateDMRoom(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req CreateDMReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.chat.GetOrCreateDMRoom(r.Context(), userID, req.UserID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// CreateGroupRoom handles POST /chat/group.
func (h *Handler) CreateGroupRoom(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req CreateGroupReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.chat.CreateGroupRoom(r.Context(), userID, req.Name, req.MemberIDs)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// ListMyRooms handles GET /chat/rooms.
func (h *Handler) ListMyRooms(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	pg := httputil.ParsePagination(r, 20, 50)

	rooms, err := h.chat.ListMyRooms(r.Context(), userID, pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, rooms)
}

// GetRoomMembers handles GET /chat/rooms/{id}/members.
func (h *Handler) GetRoomMembers(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	roomID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	members, err := h.chat.GetRoomMembers(r.Context(), roomID, userID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, members)
}

// SendMessage handles POST /chat/rooms/{id}/messages.
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	roomID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	var req SendMessageReq
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.chat.SendMessage(r.Context(), roomID, userID, req.Content, req.MessageType)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// ListMessages handles GET /chat/rooms/{id}/messages.
func (h *Handler) ListMessages(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	roomID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	pg := httputil.ParsePagination(r, 50, 100)

	messages, err := h.chat.ListMessages(r.Context(), roomID, userID, pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, messages)
}

// MarkAsRead handles POST /chat/rooms/{id}/read.
func (h *Handler) MarkAsRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	roomID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	if err := h.chat.MarkAsRead(r.Context(), roomID, userID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "read"})
}
