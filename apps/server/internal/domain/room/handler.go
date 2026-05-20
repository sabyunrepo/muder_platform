package room

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// startBodyLimit is the maximum allowed body size for StartRoom (256 KiB).
const startBodyLimit = 256 * 1024

// Handler handles room HTTP endpoints.
type Handler struct {
	svc Service
}

// NewHandler creates a new room handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// CreateRoom handles POST /rooms (authenticated).
func (h *Handler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req CreateRoomRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	resp, err := h.svc.CreateRoom(r.Context(), userID, req)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// ListWaitingRooms handles GET /rooms (public).
func (h *Handler) ListWaitingRooms(w http.ResponseWriter, r *http.Request) {
	pg := httputil.ParsePagination(r, 20, 50)

	rooms, err := h.svc.ListWaitingRooms(r.Context(), pg.Limit, pg.Offset)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, rooms)
}

// GetRoom handles GET /rooms/{id} (public).
func (h *Handler) GetRoom(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	roomID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	resp, err := h.svc.GetRoom(r.Context(), roomID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// GetRoomForCurrentUser handles GET /rooms/{id}/me (authenticated participant).
func (h *Handler) GetRoomForCurrentUser(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	idStr := chi.URLParam(r, "id")
	roomID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	resp, err := h.svc.GetRoomForUser(r.Context(), roomID, userID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// GetRoomByCode handles GET /rooms/code/{code} (public).
func (h *Handler) GetRoomByCode(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		apperror.WriteError(w, r, apperror.BadRequest("room code is required"))
		return
	}

	resp, err := h.svc.GetRoomByCode(r.Context(), code)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, resp)
}

// JoinRoom handles POST /rooms/{id}/join (authenticated).
func (h *Handler) JoinRoom(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	idStr := chi.URLParam(r, "id")
	roomID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	if err := h.svc.JoinRoom(r.Context(), roomID, userID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "joined"})
}

// LeaveRoom handles POST /rooms/{id}/leave (authenticated).
func (h *Handler) LeaveRoom(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	idStr := chi.URLParam(r, "id")
	roomID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	if err := h.svc.LeaveRoom(r.Context(), roomID, userID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "left"})
}

// SetReady handles POST /rooms/{id}/ready (authenticated).
func (h *Handler) SetReady(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	idStr := chi.URLParam(r, "id")
	roomID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	var req SetReadyRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	if err := h.svc.SetReady(r.Context(), roomID, userID, req.IsReady); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready updated"})
}

// SelectCharacter handles PUT /rooms/{id}/character (authenticated).
func (h *Handler) SelectCharacter(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	idStr := chi.URLParam(r, "id")
	roomID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	var req SelectCharacterRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	if err := h.svc.SelectCharacter(r.Context(), roomID, userID, req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "character selected"})
}

// StartRoom handles POST /rooms/{id}/start (authenticated, host only).
// It enforces a 256 KiB body limit to protect the configJson trust boundary.
func (h *Handler) StartRoom(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	idStr := chi.URLParam(r, "id")
	roomID, err := uuid.Parse(idStr)
	if err != nil {
		apperror.WriteError(w, r, apperror.BadRequest("invalid room ID"))
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, startBodyLimit)

	var req StartRoomRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, apperror.New(apperror.ErrBadRequest, http.StatusBadRequest, "invalid start body"))
		return
	}

	if err := h.svc.StartRoom(r.Context(), roomID, userID, req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "started"})
}
