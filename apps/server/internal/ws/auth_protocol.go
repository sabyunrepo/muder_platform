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

// Auth protocol message types — sub-actions under the "auth" namespace.
// The catalog (envelope_catalog_system.go) is the source of truth for
// wire compatibility; these constants are the Go-side reference used by
// the dispatcher and tests.
const (
	// C→S
	TypeAuthIdentify = "auth:identify"
	TypeAuthResume   = "auth:resume"
	TypeAuthRefresh  = "auth:refresh"

	// S→C
	TypeAuthChallenge       = "auth:challenge"
	TypeAuthRevoked         = "auth:revoked"
	TypeAuthRefreshRequired = "auth:refresh_required"
	TypeAuthTokenIssued     = "auth:token_issued"
	TypeAuthInvalidSession  = "auth:invalid_session"
)

// AuthRevokeChecker is the narrow domain surface AuthHandler needs to
// answer "is this user / token currently revoked?". *auth.RevokeRepo
// satisfies it; tests inject a fake.
type AuthRevokeChecker interface {
	IsUserRevokedSince(ctx context.Context, userID uuid.UUID, since time.Time) (bool, error)
	IsTokenRevoked(ctx context.Context, jti string) (bool, error)
}

// AuthHandler dispatches the "auth" namespace. PR-9 Task 3.2 implements
// auth.identify only; resume / refresh land in Task 3.3 and currently
// reply with a not-implemented error so a client probing the surface
// gets an explicit signal rather than silence.
//
// Flag-gate behaviour: when enabled is false the handler silently drops
// every inbound auth.* frame so a client shipping the new protocol stays
// compatible with a back-rollout. The legacy upgrade-time JWT check
// (JWTPlayerIDExtractor) remains the only auth gate in that mode.
type AuthHandler struct {
	jwtSecret []byte
	revoke    AuthRevokeChecker
	enabled   bool
	logger    zerolog.Logger
}

// NewAuthHandler wires an AuthHandler. Both jwtSecret and revoke must be
// supplied even when enabled=false so a runtime flag flip does not need
// a re-wire of the dispatcher.
func NewAuthHandler(jwtSecret []byte, revoke AuthRevokeChecker, enabled bool, logger zerolog.Logger) *AuthHandler {
	if len(jwtSecret) == 0 {
		panic("ws.NewAuthHandler: jwtSecret is empty")
	}
	if revoke == nil {
		panic("ws.NewAuthHandler: revoke is nil")
	}
	return &AuthHandler{
		jwtSecret: jwtSecret,
		revoke:    revoke,
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
	case TypeAuthResume, TypeAuthRefresh:
		// Task 3.3 will land these. Replying explicitly beats router-level
		// "unknown type" because the catalog already advertises them.
		c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage,
			"auth sub-action not yet implemented: "+env.Type))
	default:
		c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage,
			"unknown auth sub-action: "+env.Type))
	}
}

// handleIdentify validates a refreshed access token and rejects the
// connection if (a) the token does not parse / verify, (b) the token's
// subject differs from the connection's bound playerID (token-swap
// attempt), or (c) the user has been revoked. Success is silent — Task
// 3.3 will add the auth.token_issued / auth.invalid_session reply paths
// for the resume/refresh flows.
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

	token, err := jwt.Parse(payload.Token, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrQueryAuthNotAllowed
		}
		return h.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		h.logger.Warn().Err(err).Stringer("playerID", c.ID).
			Msg("auth.identify: token verification failed")
		h.unauthorize(c, "invalid or expired token")
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		h.unauthorize(c, "token claims malformed")
		return
	}
	sub, _ := claims.GetSubject()
	userID, err := uuid.Parse(sub)
	if err != nil {
		h.unauthorize(c, "token subject not a uuid")
		return
	}
	if userID != c.ID {
		// Token-swap attempt — refuse to upgrade the connection to a
		// different identity. Bouncing the socket is safer than silently
		// re-binding it.
		h.logger.Warn().
			Stringer("playerID", c.ID).
			Stringer("tokenSub", userID).
			Msg("auth.identify: token subject does not match connection player")
		h.unauthorize(c, "token subject does not match connection")
		return
	}

	// Pull-fallback revoke check. Hub.RevokeUser (Task 3.4) closes
	// already-open sockets via push; this catches the race where an
	// auth.identify frame arrives between revoke insertion and the push
	// reaching this connection. since=zero matches any revoke row for
	// the user — the precise iat-based filter is a Task 3.5 follow-up
	// once the access token carries an iat claim that we trust.
	revoked, err := h.revoke.IsUserRevokedSince(context.Background(), userID, time.Time{})
	if err != nil {
		h.logger.Error().Err(err).Stringer("userID", userID).
			Msg("auth.identify: revoke lookup failed")
		c.SendMessage(NewErrorEnvelope(ErrCodeInternalError,
			"auth check failed"))
		return
	}
	if revoked {
		h.revokeAndClose(c, auth.RevokeCodeBanned, "user has been revoked")
		return
	}

	// Success path is silent. The legacy upgrade-time JWT check has
	// already populated Client.ID with the matching subject; identify is
	// confirmation, not promotion.
}

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
