package auth

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// CompositeRevokePublisher fans a single revoke call out to every wired
// RevokePublisher (today: ws.Hub + ws.SocialHub; tomorrow: a Redis
// pub/sub adapter for multi-server fanout). All publishers are invoked
// even if an earlier one fails so a slow or down hub does not silently
// skip the others, and every error is surfaced to the caller via
// errors.Join — the prior implementation only returned the first error,
// which masked partial failures and made monitoring noisy.
//
// The wrapper is synchronous; callers that cannot afford the per-publisher
// latency on a hot path (e.g. service.recordRevoke fronting an HTTP
// response) should themselves invoke this in a goroutine. See the H-1
// fix in service.recordRevoke for why this split is kept rather than
// pushing the goroutine into the composite.
type CompositeRevokePublisher struct {
	publishers []RevokePublisher
}

// NewCompositeRevokePublisher constructs a CompositeRevokePublisher from
// a slice of inner publishers. nil entries are filtered out so callers
// can wire optional adapters (e.g. a Redis pub/sub) by passing nil when
// disabled.
func NewCompositeRevokePublisher(publishers ...RevokePublisher) CompositeRevokePublisher {
	out := make([]RevokePublisher, 0, len(publishers))
	for _, p := range publishers {
		if p != nil {
			out = append(out, p)
		}
	}
	return CompositeRevokePublisher{publishers: out}
}

func (c CompositeRevokePublisher) RevokeUser(ctx context.Context, userID uuid.UUID, code, reason string) error {
	errs := make([]error, 0, len(c.publishers))
	for _, p := range c.publishers {
		if err := p.RevokeUser(ctx, userID, code, reason); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (c CompositeRevokePublisher) RevokeSession(ctx context.Context, sessionID uuid.UUID, code, reason string) error {
	errs := make([]error, 0, len(c.publishers))
	for _, p := range c.publishers {
		if err := p.RevokeSession(ctx, sessionID, code, reason); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (c CompositeRevokePublisher) RevokeToken(ctx context.Context, tokenJTI, code, reason string) error {
	errs := make([]error, 0, len(c.publishers))
	for _, p := range c.publishers {
		if err := p.RevokeToken(ctx, tokenJTI, code, reason); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}
