package auth

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
)

// revokePushTimeout bounds the live publisher fan-out so a wedged WS
// client (slow writer, saturated send channel) cannot keep a goroutine
// alive forever. Sized larger than Hub's WriteMessage deadline (10s) so
// healthy publishers always finish first.
const revokePushTimeout = 15 * time.Second

// recordRevoke writes a persistent revoke_log row and pushes auth.revoked
// to live WS sessions. The two side effects have different criticality:
//
// The revoke_log insert is synchronous and load-bearing: the next
// reconnect's pull-fallback (auth.identify / auth.resume) reads it to
// reject sessions that came up after revocation. PR-9 H-4 (a) escalated
// an insert failure from log-and-shrug to a propagated error so a
// security revocation that did not actually persist surfaces as a 500
// to the caller (Logout / RefreshToken family-attack), prompting a
// retry. Without the row a reconnect would silently bypass the revoke.
//
// The publisher push runs in a goroutine and stays best-effort. A
// wedged WS socket cannot stall the calling HTTP response, and a
// missed push is covered by the pull-fallback that the row above
// guarantees. When MMP_WS_AUTH_PROTOCOL is off the publisher is a
// no-op so live sockets stay attached and the legacy upgrade-time
// JWT check remains the only auth gate; the row is still written so
// the next reconnect after the flag flip is rejected.
func (s *service) recordRevoke(ctx context.Context, userID uuid.UUID, code, reason string) error {
	if _, err := s.revokeRepo.Insert(ctx, RevokeEntry{
		UserID: userID,
		Reason: reason,
		Code:   code,
	}); err != nil {
		s.logger.Error().Err(err).
			Str("user_id", userID.String()).
			Str("code", code).
			Msg("revoke_log insert failed — security revocation not persisted, surfacing as 500")
		// Skip the publisher push: without the row, the close it would
		// trigger is silently bypassed on the very next reconnect.
		return apperror.Internal("failed to record revocation")
	}
	go s.pushRevokeAsync(userID, code, reason)
	return nil
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
