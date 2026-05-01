package ws

import (
	"context"
	"encoding/json"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/domain/auth"
)

// Auth protocol message types — wire format per the catalog
// (envelope_catalog_system.go) and the generated TS WsEventType. PR-9
// uses the dot-form convention so frontend constants line up with the
// wire bytes verbatim. The colon vs dot drift across the codebase is
// catalogued as a Phase 20 normalisation follow-up; new wire types
// landed by PR-9 use the dot form to avoid widening the gap.
const (
	// C→S
	TypeAuthIdentify = "auth.identify"
	TypeAuthResume   = "auth.resume"
	TypeAuthRefresh  = "auth.refresh"

	// S→C
	TypeAuthChallenge       = "auth.challenge"
	TypeAuthRevoked         = "auth.revoked"
	TypeAuthRefreshRequired = "auth.refresh_required"
	TypeAuthTokenIssued     = "auth.token_issued"
	TypeAuthInvalidSession  = "auth.invalid_session"
)

// AuthRevokeChecker is the narrow domain surface AuthHandler needs to
// answer "is this user / token currently revoked?". *auth.RevokeRepo
// satisfies it; tests inject a fake.
type AuthRevokeChecker interface {
	IsUserRevokedSince(ctx context.Context, userID uuid.UUID, since time.Time) (bool, error)
	IsTokenRevoked(ctx context.Context, jti string) (bool, error)
}

// AuthRefresher is the narrow domain surface AuthHandler needs to honour
// auth.refresh frames — exchange a refresh token for a fresh access
// token + JTI rotation in Redis. *auth.service satisfies it via its
// existing Service.RefreshToken method, so the WS layer reuses the HTTP
// /auth/refresh logic without duplicating Redis bookkeeping.
type AuthRefresher interface {
	RefreshToken(ctx context.Context, refreshToken string) (*auth.TokenPair, error)
}

// AuthHandler dispatches the "auth" namespace. PR-9 Task 3.2 added
// auth.identify; Task 3.3 adds auth.resume and auth.refresh with their
// matching outbound replies (auth.invalid_session and auth.token_issued).
//
// Flag-gate behaviour: when enabled is false the handler silently drops
// every inbound auth.* frame so a client shipping the new protocol stays
// compatible with a back-rollout. The legacy upgrade-time JWT check
// (JWTPlayerIDExtractor) remains the only auth gate in that mode.
type AuthHandler struct {
	jwtSecret []byte
	revoke    AuthRevokeChecker
	refresher AuthRefresher
	enabled   bool
	logger    zerolog.Logger
}

// NewAuthHandler wires an AuthHandler. jwtSecret, revoke, and refresher
// must all be supplied even when enabled=false so a runtime flag flip
// does not need a re-wire of the dispatcher.
func NewAuthHandler(
	jwtSecret []byte,
	revoke AuthRevokeChecker,
	refresher AuthRefresher,
	enabled bool,
	logger zerolog.Logger,
) *AuthHandler {
	if len(jwtSecret) == 0 {
		panic("ws.NewAuthHandler: jwtSecret is empty")
	}
	if revoke == nil {
		panic("ws.NewAuthHandler: revoke is nil")
	}
	if refresher == nil {
		panic("ws.NewAuthHandler: refresher is nil")
	}
	return &AuthHandler{
		jwtSecret: jwtSecret,
		revoke:    revoke,
		refresher: refresher,
		enabled:   enabled,
		logger:    logger.With().Str("component", "ws.auth").Logger(),
	}
}

// Handle is the router entry point for the "auth" namespace. Registered
// in main.go as router.Handle("auth", h.Handle) — Task 3.6.
func (h *AuthHandler) Handle(c *Client, env *Envelope) {
	if !h.enabled {
		return
	}
	switch env.Type {
	case TypeAuthIdentify:
		h.handleIdentify(c, env)
	case TypeAuthResume:
		h.handleResume(c, env)
	case TypeAuthRefresh:
		h.handleRefresh(c, env)
	default:
		c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage,
			"unknown auth sub-action: "+env.Type))
	}
}

// ---------------------------------------------------------------------------
// auth.identify — confirm a refreshed access token still binds to this
// connection's player and is not revoked.
// ---------------------------------------------------------------------------

func (h *AuthHandler) handleIdentify(c *Client, env *Envelope) {
	var payload AuthIdentifyPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		h.logger.Warn().Err(err).Stringer("playerID", c.ID).
			Msg("auth.identify: invalid payload JSON")
		c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage,
			"invalid auth.identify payload"))
		return
	}
	if payload.Token == "" {
		c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage,
			"auth.identify: token is required"))
		return
	}

	userID, issuedAt, ok := h.verifyToken(c, payload.Token)
	if !ok {
		return
	}
	if h.userRevokedAndStop(c, userID, issuedAt) {
		return
	}
	// Success path is silent.
}

// ---------------------------------------------------------------------------
// auth.resume — reconnect with a (sessionID, lastSeq) so the server can
// replay missed envelopes from the per-session buffer. The buffer-replay
// wiring lands in Task 3.4; this handler covers the protocol surface
// (token + revoke + sessionID acceptance gate).
// ---------------------------------------------------------------------------

func (h *AuthHandler) handleResume(c *Client, env *Envelope) {
	var payload AuthResumePayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		h.logger.Warn().Err(err).Stringer("playerID", c.ID).
			Msg("auth.resume: invalid payload JSON")
		c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage,
			"invalid auth.resume payload"))
		return
	}
	if payload.Token == "" {
		c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage,
			"auth.resume: token is required"))
		return
	}

	userID, issuedAt, ok := h.verifyToken(c, payload.Token)
	if !ok {
		return
	}
	if h.userRevokedAndStop(c, userID, issuedAt) {
		return
	}

	if payload.SessionID != c.SessionID {
		// The client thinks it was attached to a different session than
		// the one this connection is bound to. Discord INVALID_SESSION
		// resumable=true semantics: open a fresh connection and
		// re-identify, the user itself is still valid.
		h.invalidSession(c, true,
			"session_id does not match this connection")
		return
	}

	// Buffer replay wiring (Hub.BufferSince(c.SessionID, payload.LastSeq))
	// lands in Task 3.4. For now silent acceptance — client treats lack
	// of invalid_session / auth.revoked as resume accepted and proceeds
	// with normal traffic.
}

// ---------------------------------------------------------------------------
// auth.refresh — exchange a refresh token for a fresh access token. The
// rotation is delegated to AuthRefresher (the existing HTTP refresh
// path) so Redis JTI bookkeeping stays single-sourced.
// ---------------------------------------------------------------------------

func (h *AuthHandler) handleRefresh(c *Client, env *Envelope) {
	var payload AuthRefreshPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		h.logger.Warn().Err(err).Stringer("playerID", c.ID).
			Msg("auth.refresh: invalid payload JSON")
		c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage,
			"invalid auth.refresh payload"))
		return
	}
	if payload.Token == "" {
		c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage,
			"auth.refresh: token is required"))
		return
	}

	pair, err := h.refresher.RefreshToken(c.Context(), payload.Token)
	if err != nil {
		h.logger.Warn().Err(err).Stringer("playerID", c.ID).
			Msg("auth.refresh: refresher rejected token")
		// Do not leak the underlying error to the client.
		h.unauthorize(c, "refresh token rejected")
		return
	}

	expiresAt := time.Now().Add(time.Duration(pair.ExpiresIn) * time.Second)
	c.SendMessage(MustEnvelope(TypeAuthTokenIssued, AuthTokenIssuedPayload{
		Token:     pair.AccessToken,
		ExpiresAt: expiresAt,
	}))
}

// ---------------------------------------------------------------------------
// Shared verification helpers used by identify and resume.
// ---------------------------------------------------------------------------

// verifyToken parses tokenStr as an HS256 JWT signed with h.jwtSecret,
// extracts the subject as a uuid, and confirms it matches c.ID. It also
// returns the token's `iat` (issued-at) so the caller can scope the
// pull-fallback revoke lookup to revocations that happened *after* the
// token was minted — see migration 00027's spec comment on revoke_log.
// Without this scope, IsUserRevokedSince(zero) matches every prior
// revocation a user has ever logged (e.g. their own previous logout)
// and produces a mass user-lockout the moment the WS auth flag flips on.
//
// On any failure verifyToken sends ErrCodeUnauthorized + closes the
// connection and returns ok=false.
func (h *AuthHandler) verifyToken(c *Client, tokenStr string) (uuid.UUID, time.Time, bool) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrQueryAuthNotAllowed
		}
		return h.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		h.logger.Warn().Err(err).Stringer("playerID", c.ID).
			Msg("token verification failed")
		h.unauthorize(c, "invalid or expired token")
		return uuid.Nil, time.Time{}, false
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		h.unauthorize(c, "token claims malformed")
		return uuid.Nil, time.Time{}, false
	}
	// Reject refresh tokens here — they carry the longer 30-day TTL
	// and were never meant to authenticate live WS frames. Without
	// this check a stolen refresh token could be replayed against
	// auth.identify / auth.resume to bypass the 15-min access-token
	// rotation. auth.refresh is the only path that legitimately sees
	// a refresh token (and AuthRefresher.RefreshToken validates type
	// itself). PR-9 CR-1.
	if tokenType, _ := claims["type"].(string); tokenType == "refresh" {
		h.logger.Warn().
			Stringer("playerID", c.ID).
			Msg("verifyToken rejected refresh token used for identify/resume")
		h.unauthorize(c, "refresh token cannot be used for WS auth")
		return uuid.Nil, time.Time{}, false
	}
	sub, _ := claims.GetSubject()
	userID, err := uuid.Parse(sub)
	if err != nil {
		h.unauthorize(c, "token subject not a uuid")
		return uuid.Nil, time.Time{}, false
	}
	if userID != c.ID {
		h.logger.Warn().
			Stringer("playerID", c.ID).
			Stringer("tokenSub", userID).
			Msg("token subject does not match connection player")
		h.unauthorize(c, "token subject does not match connection")
		return uuid.Nil, time.Time{}, false
	}
	iatClaim, err := claims.GetIssuedAt()
	if err != nil || iatClaim == nil {
		h.logger.Warn().Err(err).Stringer("playerID", c.ID).
			Msg("token missing iat claim")
		h.unauthorize(c, "token missing iat claim")
		return uuid.Nil, time.Time{}, false
	}
	return userID, iatClaim.Time, true
}

// userRevokedAndStop performs the pull-fallback revoke check scoped to
// revocations newer than `since` (the token's iat — see verifyToken).
// Returns true if the caller must stop because a response (auth.revoked
// + close or internal error) has already been sent.
func (h *AuthHandler) userRevokedAndStop(c *Client, userID uuid.UUID, since time.Time) bool {
	revoked, err := h.revoke.IsUserRevokedSince(c.Context(), userID, since)
	if err != nil {
		h.logger.Error().Err(err).Stringer("userID", userID).
			Msg("revoke lookup failed")
		c.SendMessage(NewErrorEnvelope(ErrCodeInternalError,
			"auth check failed"))
		return true
	}
	if revoked {
		h.revokeAndClose(c, auth.RevokeCodeBanned, "user has been revoked")
		return true
	}
	return false
}

// ---------------------------------------------------------------------------
// Outbound terminal envelopes
// ---------------------------------------------------------------------------

func (h *AuthHandler) unauthorize(c *Client, reason string) {
	c.SendMessage(NewErrorEnvelope(ErrCodeUnauthorized, reason))
	c.Close()
}

func (h *AuthHandler) revokeAndClose(c *Client, code, reason string) {
	c.SendMessage(MustEnvelope(TypeAuthRevoked, AuthRevokedPayload{
		Code:   code,
		Reason: reason,
	}))
	c.Close()
}

func (h *AuthHandler) invalidSession(c *Client, resumable bool, reason string) {
	c.SendMessage(MustEnvelope(TypeAuthInvalidSession, AuthInvalidSessionPayload{
		Resumable: resumable,
		Reason:    reason,
	}))
	c.Close()
}
