package auth

import (
	"context"

	"github.com/google/uuid"
)

// RevokePublisher signals server-initiated session invalidation to live
// WS connections. The default in-process implementation is supplied by
// internal/ws (Hub) so every authenticated socket can be closed
// immediately on revoke. Multi-server deployments swap a Redis pub/sub
// adapter without touching the auth service.
//
// Standards reference: OWASP WebSocket cheat sheet recommends closing
// the socket on logout/revoke, and OpenID CAEP 1.0 (2025-08-29) defines
// the equivalent "session-revoked" SET. The revoke_log table backs the
// reconnect-time pull fallback (Auth0 hybrid pattern) so a missed push
// still rejects the next auth.identify / auth.resume frame.
type RevokePublisher interface {
	// RevokeUser closes every live session belonging to userID and emits
	// auth.revoked with the supplied code/reason. Used for bans, password
	// changes — anything that invalidates the whole user.
	RevokeUser(ctx context.Context, userID uuid.UUID, code, reason string) error

	// RevokeSession closes live game sockets bound to sessionID. Social
	// sockets do not carry the game session concept, so SocialHub treats
	// this as a no-op.
	RevokeSession(ctx context.Context, sessionID uuid.UUID, code, reason string) error

	// RevokeToken is a best-effort hook for future token-JTI indexed
	// sockets. Current Hub/SocialHub implementations log and no-op; use
	// RevokeUser for the concrete logout-elsewhere end state.
	RevokeToken(ctx context.Context, tokenJTI, code, reason string) error
}

// NoopRevokePublisher is the default when MMP_WS_AUTH_PROTOCOL is off:
// every call is a silent no-op, which keeps service.Logout etc. wirable
// without the WS hub being instantiated. Tests that never exercise the
// revoke push path may also use this.
type NoopRevokePublisher struct{}

func (NoopRevokePublisher) RevokeUser(context.Context, uuid.UUID, string, string) error {
	return nil
}

func (NoopRevokePublisher) RevokeSession(context.Context, uuid.UUID, string, string) error {
	return nil
}

func (NoopRevokePublisher) RevokeToken(context.Context, string, string, string) error {
	return nil
}
