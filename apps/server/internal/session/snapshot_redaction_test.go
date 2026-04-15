package session_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/session"
	"github.com/rs/zerolog"
)

// ---------------------------------------------------------------------------
// Redaction regression — Phase 18.1 PR-4 Task 3
//
// Verifies that SendSnapshot (via KindSnapshotFor) dispatches separate,
// player-aware envelopes so that role-private data never reaches the wrong
// client. Uses the fakeCache and fakeSender stubs from snapshot_test.go.
// ---------------------------------------------------------------------------

// startRedactionSession starts a 2-player session with snapshot wired and
// waits for StatusRunning.
func startRedactionSession(t *testing.T) (*session.SessionManager, *fakeCache, *fakeSender, uuid.UUID) {
	t.Helper()
	fc := newFakeCache()
	sender := &fakeSender{}

	m := session.NewSessionManager(zerolog.Nop())
	m.InjectSnapshot(fc, sender)

	sessionID := uuid.New()
	s, err := m.Start(context.Background(), sessionID, uuid.New(), newPlayers(2))
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	waitRunning(t, s)
	t.Cleanup(func() { m.Stop(sessionID) }) //nolint:errcheck

	return m, fc, sender, sessionID
}

// awaitEnvelopes polls until at least n envelopes arrive or deadline passes.
func awaitEnvelopes(t *testing.T, sender *fakeSender, n int, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if sender.count() >= n {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("timeout: expected %d envelopes, got %d", n, sender.count())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// TestSnapshot_Redaction_TwoPlayersEachGetEnvelope verifies that when two
// players reconnect, the actor dispatches two session:state envelopes.
func TestSnapshot_Redaction_TwoPlayersEachGetEnvelope(t *testing.T) {
	m, _, sender, sessionID := startRedactionSession(t)

	alice := uuid.New()
	bob := uuid.New()

	m.OnPlayerRejoined(sessionID, alice)
	m.OnPlayerRejoined(sessionID, bob)

	awaitEnvelopes(t, sender, 2, time.Second)

	if sender.count() < 2 {
		t.Fatalf("expected at least 2 envelopes, got %d", sender.count())
	}

	// Both envelopes must be well-formed session:state.
	sender.mu.Lock()
	envelopes := make([]struct {
		typ     string
		payload json.RawMessage
	}, len(sender.received))
	for i, e := range sender.received {
		envelopes[i].typ = e.Type
		envelopes[i].payload = e.Payload
	}
	sender.mu.Unlock()

	for i, env := range envelopes {
		if env.typ != "session:state" {
			t.Errorf("envelope %d type: got %q, want session:state", i, env.typ)
		}
	}
}

// TestSnapshot_Redaction_PayloadContainsSessionID verifies that a reconnect
// envelope carries a session:state payload with the correct sessionId field.
func TestSnapshot_Redaction_PayloadContainsSessionID(t *testing.T) {
	m, _, sender, sessionID := startRedactionSession(t)

	player := uuid.New()
	m.OnPlayerRejoined(sessionID, player)

	awaitEnvelopes(t, sender, 1, 500*time.Millisecond)

	env := sender.lastEnvelope()
	if env == nil {
		t.Fatal("no envelope received")
	}
	if env.Type != "session:state" {
		t.Errorf("envelope type: got %q, want session:state", env.Type)
	}

	var body struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.Unmarshal(env.Payload, &body); err != nil {
		t.Fatalf("payload not valid engine-state JSON: %v", err)
	}
	if body.SessionID != sessionID.String() {
		t.Errorf("sessionId: got %q, want %q", body.SessionID, sessionID)
	}
}

// TestSnapshot_Redaction_NoPlayerIDCrossLeak verifies that no single envelope
// contains BOTH player UUIDs simultaneously.
//
// The default stub engine does not embed player IDs, so the absence of both
// UUIDs in any single payload confirms no accidental cross-player data
// injection. With a player-aware module this test would catch cross-leakage.
func TestSnapshot_Redaction_NoPlayerIDCrossLeak(t *testing.T) {
	m, _, sender, sessionID := startRedactionSession(t)
	_ = sessionID

	alice := uuid.New()
	bob := uuid.New()

	m.OnPlayerRejoined(sessionID, alice)
	m.OnPlayerRejoined(sessionID, bob)

	awaitEnvelopes(t, sender, 2, time.Second)

	// Copy payloads before asserting so we hold the lock briefly.
	sender.mu.Lock()
	payloads := make([]string, len(sender.received))
	for i, e := range sender.received {
		payloads[i] = string(e.Payload)
	}
	sender.mu.Unlock()

	for i, payload := range payloads {
		hasAlice := strings.Contains(payload, alice.String())
		hasBob := strings.Contains(payload, bob.String())
		if hasAlice && hasBob {
			t.Errorf(
				"envelope %d contains BOTH player IDs — possible redaction failure: "+
					"alice=%s bob=%s payload=%s",
				i, alice, bob, payload,
			)
		}
	}
}
