package ws

import (
	"context"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/domain/auth"
)

// SocialHub also satisfies auth.RevokePublisher so a revoke fans out to
// both the in-game socket (Hub) and the lobby/social socket (SocialHub).
// The compile-time check below catches signature drift.
var _ auth.RevokePublisher = (*SocialHub)(nil)

// RevokeUser closes the social WS connection bound to userID (if any)
// after pushing auth.revoked. Mirrors Hub.RevokeUser; the underlying
// SocialHub.users map is the social analogue of Hub.players.
func (h *SocialHub) RevokeUser(_ context.Context, userID uuid.UUID, code, reason string) error {
	h.mu.RLock()
	c, ok := h.users[userID]
	h.mu.RUnlock()
	if !ok {
		return nil
	}
	c.SendMessage(MustEnvelope(TypeAuthRevoked, AuthRevokedPayload{
		Code:   code,
		Reason: reason,
	}))
	c.Close()
	h.Unregister(c)
	return nil
}

// RevokeSession is a no-op on SocialHub: sessionID in the auth domain
// refers to a game session, but SocialHub indexes by chat room instead.
// "Force-close this game" semantics live entirely on the game Hub.
func (h *SocialHub) RevokeSession(_ context.Context, _ uuid.UUID, code, _ string) error {
	h.logger.Debug().
		Str("code", code).
		Msg("SocialHub.RevokeSession: no-op (game session concept does not apply to social)")
	return nil
}

// RevokeToken is a no-op for the same reason as Hub.RevokeToken: PR-9
// access tokens carry no jti claim, so there is no way to find which
// connection authenticated with a given token. Use RevokeUser.
func (h *SocialHub) RevokeToken(_ context.Context, tokenJTI, code, _ string) error {
	h.logger.Debug().
		Str("jti", tokenJTI).
		Str("code", code).
		Msg("SocialHub.RevokeToken: no-op (access token jti tracking not implemented; use RevokeUser)")
	return nil
}
