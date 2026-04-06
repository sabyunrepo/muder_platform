package auth

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/httputil"
	"github.com/mmp-platform/server/internal/middleware"
)

// Handler holds HTTP handlers for auth endpoints.
type Handler struct {
	svc Service
}

// NewHandler creates a new auth Handler.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

type callbackRequest struct {
	Provider string `json:"provider" validate:"required"`
	Code     string `json:"code" validate:"required"`
	Nickname string `json:"nickname" validate:"required,min=2,max=30"`
}

type registerRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=4"`
	Nickname string `json:"nickname" validate:"required,min=2,max=30"`
}

type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// HandleRegister handles POST /auth/register.
func (h *Handler) HandleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	pair, err := h.svc.Register(r.Context(), req.Email, req.Password, req.Nickname)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, pair)
}

// HandleLogin handles POST /auth/login.
func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	pair, err := h.svc.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, pair)
}

// HandleCallback handles POST /auth/callback.
func (h *Handler) HandleCallback(w http.ResponseWriter, r *http.Request) {
	var req callbackRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	pair, err := h.svc.OAuthCallback(r.Context(), req.Provider, req.Code, req.Nickname)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, pair)
}

// HandleRefresh handles POST /auth/refresh.
func (h *Handler) HandleRefresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	pair, err := h.svc.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, pair)
}

// HandleLogout handles POST /auth/logout. Requires authentication.
func (h *Handler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	if err := h.svc.Logout(r.Context(), userID); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// HandleDeleteAccount handles DELETE /auth/account. Requires authentication.
func (h *Handler) HandleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	var req DeleteAccountRequest
	if err := httputil.ReadJSON(r, &req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	if err := h.svc.DeleteAccount(r.Context(), userID, req); err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleMe handles GET /auth/me. Requires authentication.
func (h *Handler) HandleMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFrom(r.Context())
	if userID == uuid.Nil {
		apperror.WriteError(w, r, apperror.Unauthorized("authentication required"))
		return
	}

	user, err := h.svc.GetCurrentUser(r.Context(), userID)
	if err != nil {
		apperror.WriteError(w, r, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, user)
}
