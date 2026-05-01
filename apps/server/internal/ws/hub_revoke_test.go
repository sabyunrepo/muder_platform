package ws

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/domain/auth"
)

// ---------------------------------------------------------------------------
// Compile-time interface compliance is enforced by the var _ in
// hub_revoke.go; this test asserts the same property at runtime so that
// a stale build cache does not hide a regression during refactors.
// ---------------------------------------------------------------------------

func TestHub_SatisfiesRevokePublisher(t *testing.T) {
	t.Parallel()
	h := newTestHub(nil)
	defer h.Stop()
	var _ auth.RevokePublisher = h // assignment is the test
}

// ---------------------------------------------------------------------------
// RevokeUser
// ---------------------------------------------------------------------------

func TestHub_RevokeUser_PushesAuthRevokedAndCloses(t *testing.T) {
	t.Parallel()
	h := newTestHub(nil)
	defer h.Stop()

	userID := uuid.New()
	c := newTestClient(h, userID)
	registerAndWait(h, c)

	ctx := context.Background()
	if err := h.RevokeUser(ctx, userID, auth.RevokeCodeBanned, "admin ban"); err != nil {
		t.Fatalf("RevokeUser: %v", err)
	}

	env := readEnvelope(c, 100*time.Millisecond)
	if env == nil {
		t.Fatal("expected auth.revoked envelope, got timeout")
	}
	if env.Type != TypeAuthRevoked {
		t.Errorf("Type=%q, want %q", env.Type, TypeAuthRevoked)
	}

	// Channel must close shortly after Close()+Unregister.
	if !waitForChannelClosed(c, 200*time.Millisecond) {
		t.Error("expected send channel closed after RevokeUser")
	}

	// Hub maps must drop the entry once the unregister event is processed.
	if waitForClientCount(h, 0, 200*time.Millisecond) != 0 {
		t.Errorf("ClientCount() = %d, want 0 after RevokeUser", h.ClientCount())
	}
}

func TestHub_RevokeUser_NotConnected_NoOp(t *testing.T) {
	t.Parallel()
	h := newTestHub(nil)
	defer h.Stop()

	if err := h.RevokeUser(context.Background(), uuid.New(),
		auth.RevokeCodeBanned, "admin ban"); err != nil {
		t.Fatalf("RevokeUser on absent user must be silent success, got %v", err)
	}
}

func TestHub_RevokeUser_Idempotent_NoPanicOnDoubleCall(t *testing.T) {
	t.Parallel()
	h := newTestHub(nil)
	defer h.Stop()

	userID := uuid.New()
	c := newTestClient(h, userID)
	registerAndWait(h, c)

	ctx := context.Background()
	if err := h.RevokeUser(ctx, userID, auth.RevokeCodeBanned, "first"); err != nil {
		t.Fatalf("RevokeUser #1: %v", err)
	}
	// Drain the envelope so the channel is empty before the second call.
	_ = readEnvelope(c, 100*time.Millisecond)

	// Second call must not panic and must not error even though the
	// client has already been closed and unregistered.
	if err := h.RevokeUser(ctx, userID, auth.RevokeCodeBanned, "second"); err != nil {
		t.Fatalf("RevokeUser #2: %v", err)
	}
}

// ---------------------------------------------------------------------------
// RevokeSession
// ---------------------------------------------------------------------------

func TestHub_RevokeSession_ClosesAllClientsInSession(t *testing.T) {
	t.Parallel()
	h := newTestHub(nil)
	defer h.Stop()

	sessionID := uuid.New()
	c1 := newTestClient(h, uuid.New())
	c2 := newTestClient(h, uuid.New())
	registerAndWait(h, c1)
	registerAndWait(h, c2)
	h.JoinSession(c1, sessionID)
	h.JoinSession(c2, sessionID)

	if err := h.RevokeSession(context.Background(), sessionID,
		auth.RevokeCodeAdminRevoked, "force end"); err != nil {
		t.Fatalf("RevokeSession: %v", err)
	}

	for i, c := range []*Client{c1, c2} {
		env := readEnvelope(c, 100*time.Millisecond)
		if env == nil {
			t.Fatalf("client %d: expected auth.revoked envelope, got timeout", i)
		}
		if env.Type != TypeAuthRevoked {
			t.Errorf("client %d Type=%q, want %q", i, env.Type, TypeAuthRevoked)
		}
		if !waitForChannelClosed(c, 200*time.Millisecond) {
			t.Errorf("client %d: expected send channel closed", i)
		}
	}
}

func TestHub_RevokeSession_OtherSessionsUnaffected(t *testing.T) {
	t.Parallel()
	h := newTestHub(nil)
	defer h.Stop()

	sessionA := uuid.New()
	sessionB := uuid.New()
	cA := newTestClient(h, uuid.New())
	cB := newTestClient(h, uuid.New())
	registerAndWait(h, cA)
	registerAndWait(h, cB)
	h.JoinSession(cA, sessionA)
	h.JoinSession(cB, sessionB)

	if err := h.RevokeSession(context.Background(), sessionA,
		auth.RevokeCodeAdminRevoked, "force end A"); err != nil {
		t.Fatalf("RevokeSession: %v", err)
	}

	// cA receives + closes.
	if env := readEnvelope(cA, 100*time.Millisecond); env == nil || env.Type != TypeAuthRevoked {
		t.Errorf("cA expected auth.revoked, got %+v", env)
	}
	// cB stays silent and open.
	if env := readEnvelope(cB, 50*time.Millisecond); env != nil {
		t.Errorf("cB expected silence, got envelope type=%q", env.Type)
	}
	if isChannelClosed(cB) {
		t.Error("cB send channel should still be open")
	}
}

func TestHub_RevokeSession_UnknownSession_NoOp(t *testing.T) {
	t.Parallel()
	h := newTestHub(nil)
	defer h.Stop()

	if err := h.RevokeSession(context.Background(), uuid.New(),
		auth.RevokeCodeAdminRevoked, "nope"); err != nil {
		t.Fatalf("RevokeSession on unknown session must be silent success, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// RevokeToken — documented no-op in PR-9
// ---------------------------------------------------------------------------

func TestHub_RevokeToken_NoOp(t *testing.T) {
	t.Parallel()
	h := newTestHub(nil)
	defer h.Stop()

	if err := h.RevokeToken(context.Background(), "some-jti",
		auth.RevokeCodeLoggedOutElsewhere, "logout"); err != nil {
		t.Fatalf("RevokeToken must be silent no-op, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// Helpers — wait/poll utilities tolerate the Hub's async event-loop.
// ---------------------------------------------------------------------------

func waitForChannelClosed(c *Client, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		select {
		case _, ok := <-c.send:
			if !ok {
				return true
			}
			// drained an envelope; keep looping to catch the close
		case <-time.After(10 * time.Millisecond):
		}
	}
	return false
}

func isChannelClosed(c *Client) bool {
	select {
	case _, ok := <-c.send:
		return !ok
	default:
		return false
	}
}

// waitForClientCount polls Hub.ClientCount until it reaches want or the
// timeout expires. Returns the last observed value.
func waitForClientCount(h *Hub, want int, timeout time.Duration) int {
	deadline := time.Now().Add(timeout)
	last := h.ClientCount()
	for time.Now().Before(deadline) {
		last = h.ClientCount()
		if last == want {
			return last
		}
		time.Sleep(10 * time.Millisecond)
	}
	return last
}
