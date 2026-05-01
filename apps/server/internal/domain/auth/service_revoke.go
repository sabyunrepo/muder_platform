package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// revokePushTimeout bounds the live publisher fan-out so a wedged WS
// client (slow writer, saturated send channel) cannot keep a goroutine
// alive forever. Sized larger than Hub's WriteMessage deadline (10s) so
// healthy publishers always finish first.
const revokePushTimeout = 15 * time.Second

// recordRevoke writes a persistent revoke_log row and pushes auth.revoked
// to live WS sessions. Both side effects are best-effort: a failure is
// logged but does not block the calling auth flow, mirroring the audit
// pipeline (additive, never blocks primary auth behaviour). When the
// MMP_WS_AUTH_PROTOCOL flag is off the publisher is a no-op so live
// sockets stay attached and the legacy upgrade-time JWT check remains
// the only auth gate; the revoke_log row is still written so the next
// reconnect after the flag flip is rejected via the pull fallback.
//
// The revoke_log insert is synchronous because the next reconnect's
// pull-fallback (auth.identify / auth.resume) reads it; if the row is
// not durable before the HTTP response returns, a client that races
// the in-flight publisher push will pass the pull check and stay
// attached.
//
// The publisher push runs in a goroutine so a wedged WS socket cannot
// stall the calling HTTP response (Logout / RefreshToken family-attack
// branch). It uses a fresh background context so cancellation of the
// HTTP request ctx the moment the response returns does not abort the
// push mid-fanout. See PR-9 H-1 for the latency motivation.
func (s *service) recordRevoke(ctx context.Context, userID uuid.UUID, code, reason string) {
	if _, err := s.revokeRepo.Insert(ctx, RevokeEntry{
		UserID: userID,
		Reason: reason,
		Code:   code,
	}); err != nil {
		s.logger.Warn().Err(err).
			Str("user_id", userID.String()).
			Str("code", code).
			Msg("revoke_log insert failed")
	}
	go s.pushRevokeAsync(userID, code, reason)
}

// pushRevokeAsync invokes the configured RevokePublisher off the caller's
// goroutine with a fresh, bounded context. Errors are logged but not
// surfaced — recordRevoke is best-effort and the next reconnect's
// pull-fallback covers a missed push.
func (s *service) pushRevokeAsync(userID uuid.UUID, code, reason string) {
	ctx, cancel := context.WithTimeout(context.Background(), revokePushTimeout)
	defer cancel()
	if err := s.publisher.RevokeUser(ctx, userID, code, reason); err != nil {
		s.logger.Warn().Err(err).
			Str("user_id", userID.String()).
			Str("code", code).
			Msg("revoke push failed")
	}
}
