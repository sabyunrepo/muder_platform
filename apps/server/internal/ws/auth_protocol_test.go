package ws

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/domain/auth"
)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

var testJWTSecret = []byte("test-secret-32-bytes-padding-yes---")

type fakeRevokeChecker struct {
	userRevoked bool
	tokenRevoke bool
	err         error
}

func (f *fakeRevokeChecker) IsUserRevokedSince(_ context.Context, _ uuid.UUID, _ time.Time) (bool, error) {
	return f.userRevoked, f.err
}

func (f *fakeRevokeChecker) IsTokenRevoked(_ context.Context, _ string) (bool, error) {
	return f.tokenRevoke, f.err
}

type noopAuthHub struct{}

func (noopAuthHub) Register(*Client)              {}
func (noopAuthHub) Unregister(*Client)            {}
func (noopAuthHub) Route(*Client, *Envelope)      {}

func newTestAuthClient(id uuid.UUID) *Client {
	return NewClient(id, nil, noopAuthHub{}, zerolog.Nop())
}

func mintAccessToken(t *testing.T, sub uuid.UUID, secret []byte) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub":  sub.String(),
		"role": "user",
		"exp":  jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
		"iat":  jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}

func identifyEnv(t *testing.T, payload AuthIdentifyPayload) *Envelope {
	t.Helper()
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	return &Envelope{Type: TypeAuthIdentify, Payload: raw}
}

func envWithRawPayload(envType string, raw []byte) *Envelope {
	return &Envelope{Type: envType, Payload: raw}
}

// ---------------------------------------------------------------------------
// Channel observation helpers
// ---------------------------------------------------------------------------

func recvOne(t *testing.T, c *Client) *Envelope {
	t.Helper()
	select {
	case data, ok := <-c.send:
		if !ok {
			t.Fatal("send channel closed before any envelope arrived")
		}
		var env Envelope
		if err := json.Unmarshal(data, &env); err != nil {
			t.Fatalf("unmarshal envelope: %v", err)
		}
		return &env
	case <-time.After(100 * time.Millisecond):
		t.Fatal("expected envelope within 100ms, got timeout")
		return nil
	}
}

func assertSilent(t *testing.T, c *Client) {
	t.Helper()
	select {
	case data, ok := <-c.send:
		if !ok {
			t.Fatal("expected silence, send channel was closed")
		}
		var env Envelope
		_ = json.Unmarshal(data, &env)
		t.Fatalf("expected silence, got envelope type=%q", env.Type)
	case <-time.After(50 * time.Millisecond):
	}
}

func assertChannelClosed(t *testing.T, c *Client) {
	t.Helper()
	select {
	case _, ok := <-c.send:
		if ok {
			t.Fatal("expected send channel closed, got more data")
		}
	case <-time.After(50 * time.Millisecond):
		t.Fatal("expected send channel closed within 50ms")
	}
}

func assertChannelOpen(t *testing.T, c *Client) {
	t.Helper()
	select {
	case _, ok := <-c.send:
		if !ok {
			t.Fatal("expected send channel open, was closed")
		}
		t.Fatal("unexpected extra envelope on send channel")
	case <-time.After(30 * time.Millisecond):
	}
}

func errorPayload(t *testing.T, env *Envelope) ErrorPayload {
	t.Helper()
	if env.Type != "error" {
		t.Fatalf("expected error envelope, got type=%q", env.Type)
	}
	var ep ErrorPayload
	if err := json.Unmarshal(env.Payload, &ep); err != nil {
		t.Fatalf("unmarshal ErrorPayload: %v", err)
	}
	return ep
}

// ---------------------------------------------------------------------------
// Constructor guards
// ---------------------------------------------------------------------------

func TestNewAuthHandler_NilSecretPanics(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic for nil/empty secret")
		}
	}()
	NewAuthHandler(nil, &fakeRevokeChecker{}, true, zerolog.Nop())
}

func TestNewAuthHandler_NilRevokePanics(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic for nil revoke checker")
		}
	}()
	NewAuthHandler(testJWTSecret, nil, true, zerolog.Nop())
}

// ---------------------------------------------------------------------------
// Flag gate
// ---------------------------------------------------------------------------

func TestAuthHandler_FlagOff_SilentDropForAllAuthFrames(t *testing.T) {
	t.Parallel()
	h := NewAuthHandler(testJWTSecret, &fakeRevokeChecker{}, false, zerolog.Nop())
	userID := uuid.New()

	frames := []*Envelope{
		identifyEnv(t, AuthIdentifyPayload{Token: mintAccessToken(t, userID, testJWTSecret)}),
		envWithRawPayload(TypeAuthIdentify, json.RawMessage("not json at all")),
		envWithRawPayload(TypeAuthResume, json.RawMessage(`{}`)),
		envWithRawPayload("auth:totally-unknown", json.RawMessage(`{}`)),
	}
	for _, env := range frames {
		c := newTestAuthClient(userID)
		h.Handle(c, env)
		assertSilent(t, c)
		assertChannelOpen(t, c)
	}
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

func TestAuthHandler_Identify_HappyPath_Silent(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	h := NewAuthHandler(testJWTSecret, &fakeRevokeChecker{}, true, zerolog.Nop())
	c := newTestAuthClient(userID)

	h.Handle(c, identifyEnv(t, AuthIdentifyPayload{
		Token: mintAccessToken(t, userID, testJWTSecret),
	}))

	assertSilent(t, c)
	assertChannelOpen(t, c)
}

// ---------------------------------------------------------------------------
// Reject bad input — 4000 BadMessage, do NOT close
// ---------------------------------------------------------------------------

func TestAuthHandler_Identify_RejectsBadInput_NoClose(t *testing.T) {
	t.Parallel()
	userID := uuid.New()

	cases := []struct {
		name string
		env  *Envelope
	}{
		{"malformed payload JSON", envWithRawPayload(TypeAuthIdentify, []byte("not-json"))},
		{"empty token", identifyEnv(t, AuthIdentifyPayload{Token: ""})},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := NewAuthHandler(testJWTSecret, &fakeRevokeChecker{}, true, zerolog.Nop())
			c := newTestAuthClient(userID)
			h.Handle(c, tc.env)

			env := recvOne(t, c)
			ep := errorPayload(t, env)
			if ep.Code != ErrCodeBadMessage {
				t.Errorf("Code=%d, want %d (BadMessage)", ep.Code, ErrCodeBadMessage)
			}
			assertChannelOpen(t, c)
		})
	}
}

// ---------------------------------------------------------------------------
// Unauthorize + close — 4001 Unauthorized
// ---------------------------------------------------------------------------

func TestAuthHandler_Identify_UnauthorizesAndCloses(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	otherID := uuid.New()

	cases := []struct {
		name  string
		token string
	}{
		{
			name:  "invalid signature",
			token: mintAccessToken(t, userID, []byte("different-secret-padding-bytes--")),
		},
		{
			name:  "subject is not a uuid",
			token: signTokenWithSub(t, "not-a-uuid", testJWTSecret),
		},
		{
			name:  "subject mismatches connection player",
			token: mintAccessToken(t, otherID, testJWTSecret),
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := NewAuthHandler(testJWTSecret, &fakeRevokeChecker{}, true, zerolog.Nop())
			c := newTestAuthClient(userID)
			h.Handle(c, identifyEnv(t, AuthIdentifyPayload{Token: tc.token}))

			env := recvOne(t, c)
			ep := errorPayload(t, env)
			if ep.Code != ErrCodeUnauthorized {
				t.Errorf("Code=%d, want %d (Unauthorized)", ep.Code, ErrCodeUnauthorized)
			}
			assertChannelClosed(t, c)
		})
	}
}

// signTokenWithSub mints a token with an arbitrary string subject (escape
// hatch for the "subject is not a uuid" case where mintAccessToken would
// reject early).
func signTokenWithSub(t *testing.T, sub string, secret []byte) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub": sub,
		"exp": jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
		"iat": jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}

// ---------------------------------------------------------------------------
// User revoked — auth.revoked envelope + close
// ---------------------------------------------------------------------------

func TestAuthHandler_Identify_UserRevoked_SendsAuthRevokedAndCloses(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	h := NewAuthHandler(testJWTSecret, &fakeRevokeChecker{userRevoked: true}, true, zerolog.Nop())
	c := newTestAuthClient(userID)

	h.Handle(c, identifyEnv(t, AuthIdentifyPayload{
		Token: mintAccessToken(t, userID, testJWTSecret),
	}))

	env := recvOne(t, c)
	if env.Type != TypeAuthRevoked {
		t.Fatalf("Type=%q, want %q", env.Type, TypeAuthRevoked)
	}
	var rp AuthRevokedPayload
	if err := json.Unmarshal(env.Payload, &rp); err != nil {
		t.Fatalf("unmarshal AuthRevokedPayload: %v", err)
	}
	if rp.Code != auth.RevokeCodeBanned {
		t.Errorf("Code=%q, want %q", rp.Code, auth.RevokeCodeBanned)
	}
	if rp.Reason == "" {
		t.Error("expected Reason populated")
	}
	assertChannelClosed(t, c)
}

// ---------------------------------------------------------------------------
// Revoke check error — 4010 Internal, do NOT close
// ---------------------------------------------------------------------------

func TestAuthHandler_Identify_RevokeLookupError_InternalError_NoClose(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	h := NewAuthHandler(
		testJWTSecret,
		&fakeRevokeChecker{err: errors.New("db down")},
		true,
		zerolog.Nop(),
	)
	c := newTestAuthClient(userID)

	h.Handle(c, identifyEnv(t, AuthIdentifyPayload{
		Token: mintAccessToken(t, userID, testJWTSecret),
	}))

	env := recvOne(t, c)
	ep := errorPayload(t, env)
	if ep.Code != ErrCodeInternalError {
		t.Errorf("Code=%d, want %d (InternalError)", ep.Code, ErrCodeInternalError)
	}
	assertChannelOpen(t, c)
}

// ---------------------------------------------------------------------------
// Sub-action dispatch
// ---------------------------------------------------------------------------

func TestAuthHandler_Handle_SubActions(t *testing.T) {
	t.Parallel()
	userID := uuid.New()

	cases := []struct {
		name     string
		envType  string
		wantSub  string
		wantCode ErrorCode
	}{
		{"resume not implemented yet", TypeAuthResume, "not yet implemented", ErrCodeBadMessage},
		{"refresh not implemented yet", TypeAuthRefresh, "not yet implemented", ErrCodeBadMessage},
		{"unknown sub-action", "auth:totally-bogus", "unknown auth sub-action", ErrCodeBadMessage},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := NewAuthHandler(testJWTSecret, &fakeRevokeChecker{}, true, zerolog.Nop())
			c := newTestAuthClient(userID)
			h.Handle(c, envWithRawPayload(tc.envType, json.RawMessage(`{}`)))

			env := recvOne(t, c)
			ep := errorPayload(t, env)
			if ep.Code != tc.wantCode {
				t.Errorf("Code=%d, want %d", ep.Code, tc.wantCode)
			}
			if !contains(ep.Message, tc.wantSub) {
				t.Errorf("Message=%q does not contain %q", ep.Message, tc.wantSub)
			}
			assertChannelOpen(t, c)
		})
	}
}

// contains is a substring check helper to keep assertions readable.
func contains(haystack, needle string) bool {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}
