package ws

import (
	"context"
	"encoding/json"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// newTestClient creates a Client with a buffered send channel and no real websocket connection.
// This is sufficient for testing Hub message routing (BroadcastToSession, SendToPlayer, Whisper)
// because those code paths only call Client.SendMessage which writes to the send channel.
//
// PR-9 H-2 footgun fix: the literal-construction shortcut left ctx/cancel as
// nil, so any test that exercises a handler reading c.Context() would
// nil-deref. Mirror NewClient by initialising the lifecycle ctx so test-only
// clients behave the same way production sockets do on Close().
func newTestClient(hub *Hub, playerID uuid.UUID) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	return &Client{
		ID:     playerID,
		hub:    hub,
		send:   make(chan []byte, sendBufSize),
		logger: zerolog.Nop(),
		ctx:    ctx,
		cancel: cancel,
	}
}

// newTestHub creates a Hub with a NoopPubSub and nop logger, suitable for unit tests.
func newTestHub(router *Router) *Hub {
	return NewHub(router, NoopPubSub{}, zerolog.Nop())
}

// registerAndWait registers a client and waits for the hub's run goroutine to process it.
func registerAndWait(h *Hub, c *Client) {
	h.Register(c)
	time.Sleep(50 * time.Millisecond)
}

// readEnvelope drains one message from the client's send channel with a timeout.
// Returns nil if no message arrives within the deadline.
func readEnvelope(c *Client, timeout time.Duration) *Envelope {
	select {
	case data := <-c.send:
		var env Envelope
		if err := json.Unmarshal(data, &env); err != nil {
			return nil
		}
		return &env
	case <-time.After(timeout):
		return nil
	}
}

// --- Hub tests ---

func TestHub_RegisterAndCount(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	c1 := newTestClient(h, uuid.New())
	c2 := newTestClient(h, uuid.New())
	c3 := newTestClient(h, uuid.New())

	registerAndWait(h, c1)
	registerAndWait(h, c2)
	registerAndWait(h, c3)

	if got := h.ClientCount(); got != 3 {
		t.Errorf("ClientCount() = %d, want 3", got)
	}
}

func TestHub_JoinSession(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	c := newTestClient(h, uuid.New())
	registerAndWait(h, c)

	sessionID := uuid.New()
	h.JoinSession(c, sessionID)

	clients := h.SessionClients(sessionID)
	if len(clients) != 1 {
		t.Fatalf("SessionClients() len = %d, want 1", len(clients))
	}
	if clients[0].ID != c.ID {
		t.Errorf("SessionClients()[0].ID = %v, want %v", clients[0].ID, c.ID)
	}

	// Client should no longer be in lobby (total count stays 1).
	if got := h.ClientCount(); got != 1 {
		t.Errorf("ClientCount() = %d, want 1", got)
	}

	if !h.HasSession(sessionID) {
		t.Error("HasSession() = false, want true")
	}
}

func TestHub_LeaveSession(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	c := newTestClient(h, uuid.New())
	registerAndWait(h, c)

	sessionID := uuid.New()
	h.JoinSession(c, sessionID)

	// Verify client is in session.
	if len(h.SessionClients(sessionID)) != 1 {
		t.Fatal("client should be in session after JoinSession")
	}

	h.LeaveSession(c)

	// Session should be empty (and cleaned up).
	if h.HasSession(sessionID) {
		t.Error("HasSession() = true after last client left, want false")
	}

	// Client should still be counted (back in lobby).
	if got := h.ClientCount(); got != 1 {
		t.Errorf("ClientCount() = %d, want 1 (client should be in lobby)", got)
	}

	// SessionID on the client should be nil.
	if c.SessionID != uuid.Nil {
		t.Errorf("client.SessionID = %v, want Nil", c.SessionID)
	}
}

func TestHub_BroadcastToSession(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	sessionID := uuid.New()
	clients := make([]*Client, 3)
	for i := range clients {
		clients[i] = newTestClient(h, uuid.New())
		registerAndWait(h, clients[i])
		h.JoinSession(clients[i], sessionID)
	}

	env := MustEnvelope("game:phase_change", map[string]string{"phase": "voting"})
	h.BroadcastToSession(sessionID, env)

	for i, c := range clients {
		got := readEnvelope(c, 200*time.Millisecond)
		if got == nil {
			t.Errorf("client[%d] did not receive broadcast", i)
			continue
		}
		if got.Type != "game:phase_change" {
			t.Errorf("client[%d] got type %q, want %q", i, got.Type, "game:phase_change")
		}
	}
}

func TestHub_BroadcastToSession_IgnoresOtherSessions(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	session1 := uuid.New()
	session2 := uuid.New()

	c1 := newTestClient(h, uuid.New())
	c2 := newTestClient(h, uuid.New())
	registerAndWait(h, c1)
	registerAndWait(h, c2)

	h.JoinSession(c1, session1)
	h.JoinSession(c2, session2)

	env := MustEnvelope("game:event", nil)
	h.BroadcastToSession(session1, env)

	// c1 should receive.
	if got := readEnvelope(c1, 200*time.Millisecond); got == nil {
		t.Error("c1 should receive broadcast for its session")
	}

	// c2 should NOT receive.
	if got := readEnvelope(c2, 100*time.Millisecond); got != nil {
		t.Error("c2 should not receive broadcast from another session")
	}
}

func TestHub_SendToPlayer(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	target := newTestClient(h, uuid.New())
	other := newTestClient(h, uuid.New())
	registerAndWait(h, target)
	registerAndWait(h, other)

	env := MustEnvelope("system:notification", map[string]string{"msg": "hello"})
	h.SendToPlayer(target.ID, env)

	// Target should receive.
	got := readEnvelope(target, 200*time.Millisecond)
	if got == nil {
		t.Fatal("target did not receive message")
	}
	if got.Type != "system:notification" {
		t.Errorf("got type %q, want %q", got.Type, "system:notification")
	}

	// Other should not receive.
	if got := readEnvelope(other, 100*time.Millisecond); got != nil {
		t.Error("other client should not receive SendToPlayer message")
	}
}

func TestHub_SendToPlayer_InSession(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	c := newTestClient(h, uuid.New())
	registerAndWait(h, c)

	sessionID := uuid.New()
	h.JoinSession(c, sessionID)

	env := MustEnvelope("game:role_assign", map[string]string{"role": "detective"})
	h.SendToPlayer(c.ID, env)

	got := readEnvelope(c, 200*time.Millisecond)
	if got == nil {
		t.Fatal("client in session did not receive SendToPlayer")
	}
	if got.Type != "game:role_assign" {
		t.Errorf("got type %q, want %q", got.Type, "game:role_assign")
	}
}

func TestHub_Whisper(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	from := newTestClient(h, uuid.New())
	to := newTestClient(h, uuid.New())
	bystander := newTestClient(h, uuid.New())

	registerAndWait(h, from)
	registerAndWait(h, to)
	registerAndWait(h, bystander)

	sessionID := uuid.New()
	h.JoinSession(from, sessionID)
	h.JoinSession(to, sessionID)
	h.JoinSession(bystander, sessionID)

	env := MustEnvelope("chat:whisper", map[string]string{"text": "secret"})
	h.Whisper(from.ID, to.ID, env)

	// Recipient should receive.
	got := readEnvelope(to, 200*time.Millisecond)
	if got == nil {
		t.Fatal("whisper recipient did not receive message")
	}
	if got.Type != "chat:whisper" {
		t.Errorf("got type %q, want %q", got.Type, "chat:whisper")
	}

	// Sender should NOT receive.
	if got := readEnvelope(from, 100*time.Millisecond); got != nil {
		t.Error("sender should not receive their own whisper")
	}

	// Bystander should NOT receive.
	if got := readEnvelope(bystander, 100*time.Millisecond); got != nil {
		t.Error("bystander should not receive whisper")
	}
}

func TestHub_Unregister(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	c1 := newTestClient(h, uuid.New())
	c2 := newTestClient(h, uuid.New())
	registerAndWait(h, c1)
	registerAndWait(h, c2)

	if got := h.ClientCount(); got != 2 {
		t.Fatalf("ClientCount() = %d before unregister, want 2", got)
	}

	// Unregister c1. Note: Unregister calls c.Close() which closes the send channel,
	// so we need to handle that. Since our test client has nil conn, Close() will panic
	// on c.conn.Close(). We work around by putting c1 in a session and verifying counts.
	// Test via the hub's internal state directly.
	h.mu.Lock()
	h.removeClientLocked(c1, false)
	delete(h.players, c1.ID)
	h.mu.Unlock()

	if got := h.ClientCount(); got != 1 {
		t.Errorf("ClientCount() = %d after removing c1, want 1", got)
	}
}

func TestHub_Unregister_FromSession(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	c := newTestClient(h, uuid.New())
	registerAndWait(h, c)

	sessionID := uuid.New()
	h.JoinSession(c, sessionID)

	if !h.HasSession(sessionID) {
		t.Fatal("session should exist after JoinSession")
	}

	// Remove from session directly (avoids Close on nil conn).
	h.mu.Lock()
	h.removeClientLocked(c, false)
	delete(h.players, c.ID)
	h.mu.Unlock()

	if h.HasSession(sessionID) {
		t.Error("session should be cleaned up after last client removed")
	}

	if got := h.ClientCount(); got != 0 {
		t.Errorf("ClientCount() = %d, want 0", got)
	}
}

func TestHub_SessionCount(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	s1, s2 := uuid.New(), uuid.New()

	c1 := newTestClient(h, uuid.New())
	c2 := newTestClient(h, uuid.New())
	c3 := newTestClient(h, uuid.New())

	registerAndWait(h, c1)
	registerAndWait(h, c2)
	registerAndWait(h, c3)

	h.JoinSession(c1, s1)
	h.JoinSession(c2, s2)
	h.JoinSession(c3, s2)

	if got := h.SessionCount(); got != 2 {
		t.Errorf("SessionCount() = %d, want 2", got)
	}
}

func TestHub_Route_WithRouter(t *testing.T) {
	router := NewRouter(zerolog.Nop())

	var called bool
	var mu sync.Mutex
	router.Handle("game", func(c *Client, env *Envelope) {
		mu.Lock()
		called = true
		mu.Unlock()
	})

	h := newTestHub(router)
	defer h.Stop()

	c := newTestClient(h, uuid.New())
	registerAndWait(h, c)

	env := MustEnvelope("game:vote", map[string]string{"target": "p2"})
	h.Route(c, env)

	mu.Lock()
	defer mu.Unlock()
	if !called {
		t.Error("router handler was not called via Hub.Route")
	}
}

func TestHub_Route_NilRouter(t *testing.T) {
	h := NewHub(nil, NoopPubSub{}, zerolog.Nop())
	defer h.Stop()

	c := newTestClient(h, uuid.New())
	registerAndWait(h, c)

	env := MustEnvelope("game:vote", nil)
	h.Route(c, env)

	// Should receive an error envelope.
	got := readEnvelope(c, 200*time.Millisecond)
	if got == nil {
		t.Fatal("expected error envelope when router is nil")
	}
	if got.Type != TypeError {
		t.Errorf("got type %q, want %q", got.Type, TypeError)
	}
}

// --- Router tests ---

func TestRouter_Handle(t *testing.T) {
	r := NewRouter(zerolog.Nop())

	var receivedType string
	r.Handle("game", func(c *Client, env *Envelope) {
		receivedType = env.Type
	})

	h := newTestHub(r)
	defer h.Stop()

	c := newTestClient(h, uuid.New())
	env := MustEnvelope("game:vote", nil)
	r.Route(c, env)

	if receivedType != "game:vote" {
		t.Errorf("handler received type %q, want %q", receivedType, "game:vote")
	}
}

func TestRouter_Handle_MultipleNamespaces(t *testing.T) {
	r := NewRouter(zerolog.Nop())

	var gameHit, chatHit bool
	r.Handle("game", func(c *Client, env *Envelope) { gameHit = true })
	r.Handle("chat", func(c *Client, env *Envelope) { chatHit = true })

	h := newTestHub(r)
	defer h.Stop()

	c := newTestClient(h, uuid.New())

	r.Route(c, MustEnvelope("game:vote", nil))
	r.Route(c, MustEnvelope("chat:send", nil))

	if !gameHit {
		t.Error("game handler was not called")
	}
	if !chatHit {
		t.Error("chat handler was not called")
	}
}

func TestRouter_Fallback(t *testing.T) {
	r := NewRouter(zerolog.Nop())

	var fallbackType string
	r.SetFallback(func(c *Client, env *Envelope) {
		fallbackType = env.Type
	})

	h := newTestHub(r)
	defer h.Stop()

	c := newTestClient(h, uuid.New())
	env := MustEnvelope("unknown:action", nil)
	r.Route(c, env)

	if fallbackType != "unknown:action" {
		t.Errorf("fallback received type %q, want %q", fallbackType, "unknown:action")
	}
}

func TestRouter_UnhandledType(t *testing.T) {
	r := NewRouter(zerolog.Nop())
	// No handlers registered, no fallback.

	h := newTestHub(r)
	defer h.Stop()

	c := newTestClient(h, uuid.New())
	env := MustEnvelope("mystery:clue", nil)
	r.Route(c, env)

	// Should receive an error envelope on the client's send channel.
	got := readEnvelope(c, 200*time.Millisecond)
	if got == nil {
		t.Fatal("expected error message for unhandled type")
	}
	if got.Type != TypeError {
		t.Errorf("got type %q, want %q", got.Type, TypeError)
	}

	// Verify error payload contains the message type.
	var errPayload ErrorPayload
	if err := json.Unmarshal(got.Payload, &errPayload); err != nil {
		t.Fatalf("failed to unmarshal error payload: %v", err)
	}
	if errPayload.Code != ErrCodeBadMessage {
		t.Errorf("error code = %d, want %d", errPayload.Code, ErrCodeBadMessage)
	}
}

func TestRouter_PingPong(t *testing.T) {
	r := NewRouter(zerolog.Nop())

	h := newTestHub(r)
	defer h.Stop()

	c := newTestClient(h, uuid.New())
	ping := MustEnvelope(TypePing, nil)
	r.Route(c, ping)

	got := readEnvelope(c, 200*time.Millisecond)
	if got == nil {
		t.Fatal("expected pong response to ping")
	}
	if got.Type != TypePong {
		t.Errorf("got type %q, want %q", got.Type, TypePong)
	}
}

func TestRouter_PingPong_BypassesHandlers(t *testing.T) {
	r := NewRouter(zerolog.Nop())

	var handlerCalled bool
	r.Handle("ping", func(c *Client, env *Envelope) {
		handlerCalled = true
	})

	h := newTestHub(r)
	defer h.Stop()

	c := newTestClient(h, uuid.New())
	r.Route(c, MustEnvelope(TypePing, nil))

	// Ping should be handled internally, not by the registered "ping" handler.
	got := readEnvelope(c, 200*time.Millisecond)
	if got == nil || got.Type != TypePong {
		t.Error("expected pong response")
	}
	if handlerCalled {
		t.Error("registered 'ping' handler should not be called; ping is handled internally")
	}
}

func TestRouter_Namespaces(t *testing.T) {
	r := NewRouter(zerolog.Nop())

	r.Handle("game", func(c *Client, env *Envelope) {})
	r.Handle("chat", func(c *Client, env *Envelope) {})
	r.Handle("lobby", func(c *Client, env *Envelope) {})

	ns := r.Namespaces()
	if len(ns) != 3 {
		t.Fatalf("Namespaces() len = %d, want 3", len(ns))
	}

	sort.Strings(ns)
	expected := []string{"chat", "game", "lobby"}
	for i, want := range expected {
		if ns[i] != want {
			t.Errorf("Namespaces()[%d] = %q, want %q", i, ns[i], want)
		}
	}
}

func TestRouter_Namespaces_Empty(t *testing.T) {
	r := NewRouter(zerolog.Nop())

	ns := r.Namespaces()
	if len(ns) != 0 {
		t.Errorf("Namespaces() len = %d, want 0 for empty router", len(ns))
	}
}

// --- RegisterLifecycleListener tests ---

// TestHub_RegisterLifecycleListener_NilIsNoop verifies that passing nil to
// RegisterLifecycleListener does not panic and does not add a nil entry to the
// listener slice (which would panic on the first notify call).
func TestHub_RegisterLifecycleListener_NilIsNoop(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	// Should not panic.
	h.RegisterLifecycleListener(nil)

	h.lifecycleMu.RLock()
	count := len(h.lifecycleListeners)
	h.lifecycleMu.RUnlock()

	if count != 0 {
		t.Errorf("lifecycleListeners len = %d after nil register, want 0", count)
	}
}

// TestHub_RegisterLifecycleListener_MultipleRegistrations verifies that multiple
// non-nil listeners can all be registered and are all retained.
func TestHub_RegisterLifecycleListener_MultipleRegistrations(t *testing.T) {
	h := newTestHub(nil)
	defer h.Stop()

	// Use fakeLifecycleListener (defined in hub_lifecycle_test.go) as a concrete type.
	l1 := &fakeLifecycleListener{}
	l2 := &fakeLifecycleListener{}
	l3 := &fakeLifecycleListener{}

	h.RegisterLifecycleListener(l1)
	h.RegisterLifecycleListener(l2)
	h.RegisterLifecycleListener(l3)

	h.lifecycleMu.RLock()
	count := len(h.lifecycleListeners)
	h.lifecycleMu.RUnlock()

	if count != 3 {
		t.Errorf("lifecycleListeners len = %d, want 3", count)
	}
}
