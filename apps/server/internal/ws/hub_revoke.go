package ws

import (
	"context"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/domain/auth"
)

// Hub satisfies auth.RevokePublisher so the auth domain can push
// server-initiated session invalidation without importing the ws package.
// The compile-time check below catches signature drift at build time
// rather than at first revoke under load.
var _ auth.RevokePublisher = (*Hub)(nil)

// RevokeUser closes the live WS connection for userID (if any) after
// emitting auth.revoked with the supplied code/reason. Used for bans,
// password changes, and other actions that nuke the whole user.
//
// The connection's Hub bookkeeping (players / lobby / sessions) is
// cleaned up by Unregister; the client.Close() call here is what stops
// the WritePump and lets the ReadPump exit. If userID has no live
// connection — they are offline at the moment of revoke — this is a
// silent success: the persistent revoke_log row, written by the caller,
// will reject the next reconnect via auth.identify / auth.resume.
//
// Multi-device note: the players map is currently a single playerID →
// *Client mapping (the upgrade path overwrites on duplicate logins), so
// RevokeUser fans out to at most one socket. A future multi-device
// model would replace players with a slice and iterate here without
// touching the AuthPublisher interface.
func (h *Hub) RevokeUser(_ context.Context, userID uuid.UUID, code, reason string) error {
	h.mu.RLock()
	c, ok := h.players[userID]
	h.mu.RUnlock()
	if !ok {
		return nil
	}
	h.pushRevokeAndUnregister(c, code, reason)
	return nil
}

// RevokeSession closes every WS connection bound to the given game
// sessionID. Used for "force-end this game" admin actions where the
// whole table must be evicted at once. Each client receives auth.revoked
// before its connection is closed.
func (h *Hub) RevokeSession(_ context.Context, sessionID uuid.UUID, code, reason string) error {
	h.mu.RLock()
	sess, ok := h.sessions[sessionID]
	var clients []*Client
	if ok {
		clients = make([]*Client, 0, len(sess))
		for _, c := range sess {
			clients = append(clients, c)
		}
	}
	h.mu.RUnlock()
	for _, c := range clients {
		h.pushRevokeAndUnregister(c, code, reason)
	}
	return nil
}

// RevokeToken is a no-op in PR-9 because the access tokens minted by
// auth.GenerateAccessToken carry no jti claim — there is no reliable
// way to tell which live socket authenticated with a given token. The
// recommended workaround for logout-elsewhere is for the caller to use
// RevokeUser (whole-user invalidation), which is the same end-state
// from the user's perspective. Keeping this method on the interface
// avoids a breaking change when a future migration introduces access
// token jti tracking.
func (h *Hub) RevokeToken(_ context.Context, tokenJTI, code, _ string) error {
	h.logger.Debug().
		Str("jti_hash", redactJTI(tokenJTI)).
		Str("code", code).
		Msg("Hub.RevokeToken: no-op (access token jti tracking not implemented; use RevokeUser)")
	return nil
}

// pushRevokeAndUnregister sends auth.revoked, closes the websocket, and
// queues an Unregister so the Hub maps drop the entry. SendMessage and
// Close are both idempotent on a Client that has already been closed,
// so calling RevokeUser twice in quick succession is safe.
func (h *Hub) pushRevokeAndUnregister(c *Client, code, reason string) {
	c.SendMessage(MustEnvelope(TypeAuthRevoked, AuthRevokedPayload{
		Code:   code,
		Reason: reason,
	}))
	c.Close()
	h.Unregister(c)
}
