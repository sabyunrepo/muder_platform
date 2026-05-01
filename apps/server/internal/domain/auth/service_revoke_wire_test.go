package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// ---------------------------------------------------------------------------
// Capturing fakes — assert that recordRevoke wires to both the repo and
// the publisher in the order the contract advertises.
// ---------------------------------------------------------------------------

type capturingRevokeRepo struct {
	mu      sync.Mutex
	entries []RevokeEntry
	insertErr error
}

func (c *capturingRevokeRepo) Insert(_ context.Context, entry RevokeEntry) (RevokeRecord, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = append(c.entries, entry)
	if c.insertErr != nil {
		return RevokeRecord{}, c.insertErr
	}
	return RevokeRecord{ID: uuid.New(), UserID: entry.UserID, Code: entry.Code, Reason: entry.Reason}, nil
}

func (c *capturingRevokeRepo) IsUserRevokedSince(context.Context, uuid.UUID, time.Time) (bool, error) {
	return false, nil
}
func (c *capturingRevokeRepo) IsTokenRevoked(context.Context, string) (bool, error) {
	return false, nil
}
func (c *capturingRevokeRepo) IsSessionRevoked(context.Context, uuid.UUID) (bool, error) {
	return false, nil
}
func (c *capturingRevokeRepo) ListRecent(context.Context, uuid.UUID, int32) ([]RevokeRecord, error) {
	return nil, nil
}

type capturingPublisher struct {
	mu        sync.Mutex
	userCalls []revokeUserCall
	pushErr   error
}

type revokeUserCall struct {
	UserID uuid.UUID
	Code   string
	Reason string
}

func (c *capturingPublisher) RevokeUser(_ context.Context, userID uuid.UUID, code, reason string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.userCalls = append(c.userCalls, revokeUserCall{userID, code, reason})
	return c.pushErr
}
func (c *capturingPublisher) RevokeSession(context.Context, uuid.UUID, string, string) error {
	return nil
}
func (c *capturingPublisher) RevokeToken(context.Context, string, string, string) error {
	return nil
}

// snapshotUserCalls returns a deep copy of userCalls under the mutex so
// the caller can inspect them race-free even while the async push
// goroutine may still be running for unrelated test iterations.
func (c *capturingPublisher) snapshotUserCalls() []revokeUserCall {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]revokeUserCall, len(c.userCalls))
	copy(out, c.userCalls)
	return out
}

// waitForUserCalls polls until at least n RevokeUser invocations are
// observed or the deadline elapses. PR-9 H-1 made recordRevoke push
// asynchronously so direct len() checks immediately after recordRevoke
// race the pushRevokeAsync goroutine.
func (c *capturingPublisher) waitForUserCalls(t *testing.T, n int) []revokeUserCall {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		got := c.snapshotUserCalls()
		if len(got) >= n {
			return got
		}
		time.Sleep(2 * time.Millisecond)
	}
	got := c.snapshotUserCalls()
	t.Fatalf("publisher.RevokeUser calls = %d, want >= %d within 2s", len(got), n)
	return got
}

// newWireTestService builds a *service with the bare minimum needed to
// exercise recordRevoke directly. queries / redis stay nil because
// recordRevoke does not touch them; tests that need those deps go
// through the handler_audit_test.go fixture instead.
func newWireTestService(repo RevokeRepo, pub RevokePublisher) *service {
	if repo == nil {
		repo = NoopRevokeRepo{}
	}
	if pub == nil {
		pub = NoopRevokePublisher{}
	}
	return &service{
		logger:     zerolog.Nop(),
		revokeRepo: repo,
		publisher:  pub,
	}
}

// ---------------------------------------------------------------------------
// recordRevoke happy path: both repo and publisher receive the same
// userID / code / reason. Logout and the RefreshToken family-attack
// branch both funnel through this helper, so covering it once covers
// both call sites.
// ---------------------------------------------------------------------------

func TestRecordRevoke_WiresRepoAndPublisher(t *testing.T) {
	t.Parallel()
	repo := &capturingRevokeRepo{}
	pub := &capturingPublisher{}
	svc := newWireTestService(repo, pub)

	userID := uuid.New()
	svc.recordRevoke(context.Background(), userID, RevokeCodeLoggedOutElsewhere, "user logout")

	if len(repo.entries) != 1 {
		t.Fatalf("revokeRepo.Insert calls = %d, want 1", len(repo.entries))
	}
	if got := repo.entries[0]; got.UserID != userID || got.Code != RevokeCodeLoggedOutElsewhere || got.Reason != "user logout" {
		t.Errorf("Insert entry = %+v, want UserID=%v Code=%q Reason=%q",
			got, userID, RevokeCodeLoggedOutElsewhere, "user logout")
	}

	calls := pub.waitForUserCalls(t, 1)
	if got := calls[0]; got.UserID != userID || got.Code != RevokeCodeLoggedOutElsewhere || got.Reason != "user logout" {
		t.Errorf("RevokeUser call = %+v, want UserID=%v Code=%q Reason=%q",
			got, userID, RevokeCodeLoggedOutElsewhere, "user logout")
	}
}

// ---------------------------------------------------------------------------
// Best-effort: a repo failure does not stop the publisher push, and
// neither failure surfaces back to the caller. The auth flow continues.
// ---------------------------------------------------------------------------

func TestRecordRevoke_RepoFailure_StillPushesAndDoesNotError(t *testing.T) {
	t.Parallel()
	repo := &capturingRevokeRepo{insertErr: errors.New("db down")}
	pub := &capturingPublisher{}
	svc := newWireTestService(repo, pub)

	userID := uuid.New()
	// Must not panic and must return immediately — repo synchronous,
	// publisher push runs on a goroutine (PR-9 H-1).
	svc.recordRevoke(context.Background(), userID, RevokeCodeAdminRevoked, "family attack")

	if got := pub.waitForUserCalls(t, 1); len(got) < 1 {
		t.Fatalf("publisher.RevokeUser must still fire on repo failure, calls = %d", len(got))
	}
}

func TestRecordRevoke_PublisherFailure_DoesNotError(t *testing.T) {
	t.Parallel()
	repo := &capturingRevokeRepo{}
	pub := &capturingPublisher{pushErr: errors.New("hub down")}
	svc := newWireTestService(repo, pub)

	userID := uuid.New()
	svc.recordRevoke(context.Background(), userID, RevokeCodeLoggedOutElsewhere, "logout")

	if len(repo.entries) != 1 {
		t.Errorf("revokeRepo.Insert must still fire on publisher failure, calls = %d", len(repo.entries))
	}
	// Drain the async push goroutine so it doesn't leak into the next
	// test under -race.
	pub.waitForUserCalls(t, 1)
}

// ---------------------------------------------------------------------------
// NewService nil fallback — the constructor must accept nil deps and
// substitute the Noop variants so existing call sites stay buildable
// during the staged rollout.
// ---------------------------------------------------------------------------

func TestNewService_NilDeps_FallbackToNoops(t *testing.T) {
	t.Parallel()
	svc := NewService(nil, nil, []byte("secret"), nil, nil, nil, zerolog.Nop())
	impl, ok := svc.(*service)
	if !ok {
		t.Fatalf("NewService returned %T, want *service", svc)
	}
	if _, ok := impl.revokeRepo.(NoopRevokeRepo); !ok {
		t.Errorf("revokeRepo = %T, want NoopRevokeRepo", impl.revokeRepo)
	}
	if _, ok := impl.publisher.(NoopRevokePublisher); !ok {
		t.Errorf("publisher = %T, want NoopRevokePublisher", impl.publisher)
	}
}
