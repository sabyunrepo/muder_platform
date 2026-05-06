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

	// captured by IsUserRevokedSince — regression tests assert that
	// callers pass a non-zero `since` (the token's iat claim) rather
	// than time.Time{}, which would re-match every prior revocation
	// the user has ever had logged (mass user-lockout pattern).
	lastSince  time.Time
	lastUserID uuid.UUID
	lastCalls  int
}

func (f *fakeRevokeChecker) IsUserRevokedSince(_ context.Context, userID uuid.UUID, since time.Time) (bool, error) {
	f.lastSince = since
	f.lastUserID = userID
	f.lastCalls++
	return f.userRevoked, f.err
}

func (f *fakeRevokeChecker) IsTokenRevoked(_ context.Context, _ string) (bool, error) {
	return f.tokenRevoke, f.err
}

// ctxObservingRevokeChecker captures the context passed to
// IsUserRevokedSince so a regression test can assert it tracks the
// Client lifecycle (PR-9 H-2).
type ctxObservingRevokeChecker struct {
	captured chan context.Context
}

func (c *ctxObservingRevokeChecker) IsUserRevokedSince(ctx context.Context, _ uuid.UUID, _ time.Time) (bool, error) {
	select {
	case c.captured <- ctx:
	default:
	}
	return false, nil
}

func (c *ctxObservingRevokeChecker) IsTokenRevoked(context.Context, string) (bool, error) {
	return false, nil
}

// semanticRevokeChecker simulates the production migration-00027 SQL:
// "WHERE user_id=$1 AND revoked_at > $2". It stores a single revocation
// timestamp and returns true only when the caller's `since` predates it.
// Used by regression tests that exercise the BLOCKER's actual semantic
// (logout → re-login flow), not just the parameter capture.
type semanticRevokeChecker struct {
	revokedAt time.Time
	err       error
}

func (s *semanticRevokeChecker) IsUserRevokedSince(_ context.Context, _ uuid.UUID, since time.Time) (bool, error) {
	if s.err != nil {
		return false, s.err
	}
	return s.revokedAt.After(since), nil
}

func (s *semanticRevokeChecker) IsTokenRevoked(_ context.Context, _ string) (bool, error) {
	return false, nil
}

type fakeRefresher struct {
	pair *auth.TokenPair
	err  error
}

func (f *fakeRefresher) RefreshToken(_ context.Context, _ string) (*auth.TokenPair, error) {
	return f.pair, f.err
}

type noopAuthHub struct{}

func (noopAuthHub) Register(*Client)         {}
func (noopAuthHub) Unregister(*Client)       {}
func (noopAuthHub) Route(*Client, *Envelope) {}

func newTestAuthClient(id uuid.UUID) *Client {
	return NewClient(id, nil, noopAuthHub{}, zerolog.Nop())
}

func newTestAuthClientWithSession(id, sessionID uuid.UUID) *Client {
	c := NewClient(id, nil, noopAuthHub{}, zerolog.Nop())
	c.SessionID = sessionID
	return c
}

func newAuthHandler(t *testing.T, revoke AuthRevokeChecker, refresher AuthRefresher, enabled bool) *AuthHandler {
	t.Helper()
	if revoke == nil {
		revoke = &fakeRevokeChecker{}
	}
	if refresher == nil {
		refresher = &fakeRefresher{}
	}
	return NewAuthHandler(testJWTSecret, revoke, refresher, enabled, zerolog.Nop())
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

// mintRefreshToken mints a token whose `type` claim is "refresh", mirroring
// auth.GenerateRefreshToken's wire shape. PR-9 CR-1 regression test asserts
// verifyToken rejects this.
func mintRefreshToken(t *testing.T, sub uuid.UUID, secret []byte) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub":  sub.String(),
		"type": "refresh",
		"jti":  "test-jti-1",
		"exp":  jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
		"iat":  jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signed
}

// signTokenWithSub mints a token with an arbitrary string subject (escape
// hatch for the "subject is not a uuid" case).
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

// mintAccessTokenWithoutIat mints an otherwise-valid HS256 token that
// omits the iat claim — used to assert verifyToken treats a missing iat
// as fail-closed (prevents silent fallback to time.Time{}).
func mintAccessTokenWithoutIat(t *testing.T, sub uuid.UUID, secret []byte) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub":  sub.String(),
		"role": "user",
		"exp":  jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
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

func resumeEnv(t *testing.T, payload AuthResumePayload) *Envelope {
	t.Helper()
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	return &Envelope{Type: TypeAuthResume, Payload: raw}
}

func refreshEnv(t *testing.T, payload AuthRefreshPayload) *Envelope {
	t.Helper()
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	return &Envelope{Type: TypeAuthRefresh, Payload: raw}
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
	NewAuthHandler(nil, &fakeRevokeChecker{}, &fakeRefresher{}, true, zerolog.Nop())
}

func TestNewAuthHandler_NilRevokePanics(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic for nil revoke checker")
		}
	}()
	NewAuthHandler(testJWTSecret, nil, &fakeRefresher{}, true, zerolog.Nop())
}

func TestNewAuthHandler_NilRefresherPanics(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic for nil refresher")
		}
	}()
	NewAuthHandler(testJWTSecret, &fakeRevokeChecker{}, nil, true, zerolog.Nop())
}

// ---------------------------------------------------------------------------
// Flag gate
// ---------------------------------------------------------------------------

func TestAuthHandler_FlagOff_SilentDropForAllAuthFrames(t *testing.T) {
	t.Parallel()
	h := newAuthHandler(t, nil, nil, false)
	userID := uuid.New()

	frames := []*Envelope{
		identifyEnv(t, AuthIdentifyPayload{Token: mintAccessToken(t, userID, testJWTSecret)}),
		envWithRawPayload(TypeAuthIdentify, json.RawMessage("not json at all")),
		resumeEnv(t, AuthResumePayload{Token: "x", SessionID: uuid.New(), LastSeq: 1}),
		refreshEnv(t, AuthRefreshPayload{Token: "any-refresh-token"}),
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
// auth.identify
// ---------------------------------------------------------------------------

func TestAuthHandler_Identify_HappyPath_Silent(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	h := newAuthHandler(t, nil, nil, true)
	c := newTestAuthClient(userID)

	h.Handle(c, identifyEnv(t, AuthIdentifyPayload{
		Token: mintAccessToken(t, userID, testJWTSecret),
	}))

	assertSilent(t, c)
	assertChannelOpen(t, c)
}

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
			h := newAuthHandler(t, nil, nil, true)
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
			h := newAuthHandler(t, nil, nil, true)
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

func TestAuthHandler_Identify_UserRevoked_SendsAuthRevokedAndCloses(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	h := newAuthHandler(t, &fakeRevokeChecker{userRevoked: true}, nil, true)
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

func TestAuthHandler_Identify_RevokeLookupError_InternalError_NoClose(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	h := newAuthHandler(t, &fakeRevokeChecker{err: errors.New("db down")}, nil, true)
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

// Regression for the C-1 BLOCKER (PR-9 4-agent review): IsUserRevokedSince
// must be called with the token's iat as `since`, never time.Time{}.
// The zero-value scope re-matches every revoke_log row a user has ever
// generated (their own logout included), causing a mass user-lockout the
// instant the WS auth flag flips on in production.
func TestAuthHandler_Identify_PassesIatAsRevokeSince(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	revoke := &fakeRevokeChecker{}
	h := newAuthHandler(t, revoke, nil, true)
	c := newTestAuthClient(userID)

	before := time.Now()
	h.Handle(c, identifyEnv(t, AuthIdentifyPayload{
		Token: mintAccessToken(t, userID, testJWTSecret),
	}))
	after := time.Now()

	if revoke.lastCalls != 1 {
		t.Fatalf("IsUserRevokedSince calls=%d, want 1", revoke.lastCalls)
	}
	if revoke.lastSince.IsZero() {
		t.Fatal("BLOCKER regression: since=time.Time{} → mass user-lockout pattern (PR-9 C-1)")
	}
	// jwt.NewNumericDate truncates to whole seconds. Tighten the
	// tolerance so a regression that swaps `iat` for time.Now() at
	// call site surfaces — the in-process mint runs in microseconds
	// so a full-second tolerance is plenty.
	earliest := before.Truncate(time.Second).Add(-1 * time.Second)
	latest := after.Add(1 * time.Second)
	if revoke.lastSince.Before(earliest) || revoke.lastSince.After(latest) {
		t.Errorf("lastSince=%v, want within [%v, %v] (token iat)",
			revoke.lastSince, earliest, latest)
	}
}

// Spec-semantic regression: a user logged out at T1 must still be able
// to re-login and identify with a fresh token issued at T2 > T1, because
// the new token's iat scopes the revoke check to revocations *after* T2.
// This is the migration-00027 spec ("newer than the connection's auth
// timestamp") that the BLOCKER violated.
func TestAuthHandler_Identify_LoggedOutUser_CanRelogIn(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	pastRevoke := time.Now().Add(-1 * time.Hour) // T1
	checker := &semanticRevokeChecker{revokedAt: pastRevoke}
	h := newAuthHandler(t, checker, nil, true)
	c := newTestAuthClient(userID)

	// mintAccessToken issues iat=now (T2), so since=T2 > T1 → no match.
	h.Handle(c, identifyEnv(t, AuthIdentifyPayload{
		Token: mintAccessToken(t, userID, testJWTSecret),
	}))

	assertSilent(t, c)
	assertChannelOpen(t, c)
}

// Regression for H-2: AuthHandler must pass the Client's lifecycle
// context to revoke lookups so a peer disconnect cancels in-flight
// Redis/DB calls instead of leaking a zombie goroutine on a slow
// backing store.
func TestAuthHandler_Identify_UsesClientContextCancelledOnClose(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	checker := &ctxObservingRevokeChecker{captured: make(chan context.Context, 1)}
	h := newAuthHandler(t, checker, nil, true)
	c := newTestAuthClient(userID)

	h.Handle(c, identifyEnv(t, AuthIdentifyPayload{
		Token: mintAccessToken(t, userID, testJWTSecret),
	}))

	var ctx context.Context
	select {
	case ctx = <-checker.captured:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("revoke checker not invoked")
	}
	if ctx.Err() != nil {
		t.Fatalf("captured ctx prematurely cancelled: %v", ctx.Err())
	}
	if ctx == context.Background() {
		t.Fatal("BLOCKER regression: handler passed context.Background() — closing client cannot abort the lookup")
	}

	c.Close()
	select {
	case <-ctx.Done():
		// expected
	case <-time.After(100 * time.Millisecond):
		t.Fatal("Client.Close() did not cancel the captured revoke ctx")
	}
}

// Regression for CR-1: a refresh token (type="refresh") replayed against
// auth.identify / auth.resume must be rejected outright. Without this
// check a stolen refresh token could ride its 30-day TTL into a live WS
// session, defeating the 15-min access-token rotation. The legitimate
// refresh path is auth.refresh, where AuthRefresher.RefreshToken
// validates the type claim itself.
func TestAuthHandler_Identify_RejectsRefreshToken(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	revoke := &fakeRevokeChecker{}
	h := newAuthHandler(t, revoke, nil, true)
	c := newTestAuthClient(userID)

	h.Handle(c, identifyEnv(t, AuthIdentifyPayload{
		Token: mintRefreshToken(t, userID, testJWTSecret),
	}))

	env := recvOne(t, c)
	ep := errorPayload(t, env)
	if ep.Code != ErrCodeUnauthorized {
		t.Errorf("Code=%d, want %d (Unauthorized)", ep.Code, ErrCodeUnauthorized)
	}
	if revoke.lastCalls != 0 {
		t.Errorf("IsUserRevokedSince calls=%d, want 0 (refresh rejected before revoke check)", revoke.lastCalls)
	}
	assertChannelClosed(t, c)
}

// Defensive: a token without iat must be rejected outright rather than
// falling back to time.Time{} (which would re-introduce the BLOCKER).
// Production tokens always carry iat (see auth.GenerateAccessToken), so
// this path is fail-closed for malformed/forged tokens.
func TestAuthHandler_Identify_TokenMissingIat_UnauthorizesAndCloses(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	revoke := &fakeRevokeChecker{}
	h := newAuthHandler(t, revoke, nil, true)
	c := newTestAuthClient(userID)

	h.Handle(c, identifyEnv(t, AuthIdentifyPayload{
		Token: mintAccessTokenWithoutIat(t, userID, testJWTSecret),
	}))

	env := recvOne(t, c)
	ep := errorPayload(t, env)
	if ep.Code != ErrCodeUnauthorized {
		t.Errorf("Code=%d, want %d (Unauthorized)", ep.Code, ErrCodeUnauthorized)
	}
	if revoke.lastCalls != 0 {
		t.Errorf("IsUserRevokedSince calls=%d, want 0 (token rejected before revoke check)", revoke.lastCalls)
	}
	assertChannelClosed(t, c)
}

// ---------------------------------------------------------------------------
// auth.resume
// ---------------------------------------------------------------------------

func TestAuthHandler_Resume_HappyPath_Silent(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	sessionID := uuid.New()
	h := newAuthHandler(t, nil, nil, true)
	c := newTestAuthClientWithSession(userID, sessionID)

	h.Handle(c, resumeEnv(t, AuthResumePayload{
		Token:     mintAccessToken(t, userID, testJWTSecret),
		SessionID: sessionID,
		LastSeq:   42,
	}))

	assertSilent(t, c)
	assertChannelOpen(t, c)
}

func TestAuthHandler_Resume_RejectsBadInput_NoClose(t *testing.T) {
	t.Parallel()
	userID := uuid.New()

	cases := []struct {
		name string
		env  *Envelope
	}{
		{"malformed payload JSON", envWithRawPayload(TypeAuthResume, []byte("not-json"))},
		{"empty token", resumeEnv(t, AuthResumePayload{Token: "", SessionID: uuid.New(), LastSeq: 0})},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newAuthHandler(t, nil, nil, true)
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

func TestAuthHandler_Resume_UnauthorizesOnInvalidToken(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	otherID := uuid.New()
	sessionID := uuid.New()

	cases := []struct {
		name  string
		token string
	}{
		{"invalid signature", mintAccessToken(t, userID, []byte("different-secret-padding-bytes--"))},
		{"subject mismatches connection player", mintAccessToken(t, otherID, testJWTSecret)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newAuthHandler(t, nil, nil, true)
			c := newTestAuthClientWithSession(userID, sessionID)
			h.Handle(c, resumeEnv(t, AuthResumePayload{
				Token:     tc.token,
				SessionID: sessionID,
				LastSeq:   1,
			}))

			env := recvOne(t, c)
			ep := errorPayload(t, env)
			if ep.Code != ErrCodeUnauthorized {
				t.Errorf("Code=%d, want %d (Unauthorized)", ep.Code, ErrCodeUnauthorized)
			}
			assertChannelClosed(t, c)
		})
	}
}

func TestAuthHandler_Resume_UserRevoked_AuthRevokedAndClose(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	sessionID := uuid.New()
	h := newAuthHandler(t, &fakeRevokeChecker{userRevoked: true}, nil, true)
	c := newTestAuthClientWithSession(userID, sessionID)

	h.Handle(c, resumeEnv(t, AuthResumePayload{
		Token:     mintAccessToken(t, userID, testJWTSecret),
		SessionID: sessionID,
		LastSeq:   1,
	}))

	env := recvOne(t, c)
	if env.Type != TypeAuthRevoked {
		t.Fatalf("Type=%q, want %q", env.Type, TypeAuthRevoked)
	}
	assertChannelClosed(t, c)
}

func TestAuthHandler_Resume_SessionIDMismatch_InvalidSessionResumableTrue(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	connSessionID := uuid.New()
	clientSessionID := uuid.New()
	h := newAuthHandler(t, nil, nil, true)
	c := newTestAuthClientWithSession(userID, connSessionID)

	h.Handle(c, resumeEnv(t, AuthResumePayload{
		Token:     mintAccessToken(t, userID, testJWTSecret),
		SessionID: clientSessionID, // != connSessionID
		LastSeq:   1,
	}))

	env := recvOne(t, c)
	if env.Type != TypeAuthInvalidSession {
		t.Fatalf("Type=%q, want %q", env.Type, TypeAuthInvalidSession)
	}
	var ip AuthInvalidSessionPayload
	if err := json.Unmarshal(env.Payload, &ip); err != nil {
		t.Fatalf("unmarshal AuthInvalidSessionPayload: %v", err)
	}
	if !ip.Resumable {
		t.Error("expected Resumable=true (re-identify allowed)")
	}
	if ip.Reason == "" {
		t.Error("expected Reason populated")
	}
	assertChannelClosed(t, c)
}

// ---------------------------------------------------------------------------
// auth.refresh
// ---------------------------------------------------------------------------

func TestAuthHandler_Refresh_HappyPath_TokenIssued(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	pair := &auth.TokenPair{
		AccessToken:  "new-access-token-abc",
		RefreshToken: "new-refresh-token-xyz",
		ExpiresIn:    900,
	}
	h := newAuthHandler(t, nil, &fakeRefresher{pair: pair}, true)
	c := newTestAuthClient(userID)

	before := time.Now()
	h.Handle(c, refreshEnv(t, AuthRefreshPayload{Token: "any-refresh-token"}))
	after := time.Now()

	env := recvOne(t, c)
	if env.Type != TypeAuthTokenIssued {
		t.Fatalf("Type=%q, want %q", env.Type, TypeAuthTokenIssued)
	}
	var tp AuthTokenIssuedPayload
	if err := json.Unmarshal(env.Payload, &tp); err != nil {
		t.Fatalf("unmarshal AuthTokenIssuedPayload: %v", err)
	}
	if tp.Token != pair.AccessToken {
		t.Errorf("Token=%q, want %q", tp.Token, pair.AccessToken)
	}
	// ExpiresAt should be roughly before+ExpiresIn .. after+ExpiresIn,
	// encoded as epoch-ms to match the generated TypeScript contract.
	earliest := before.Add(time.Duration(pair.ExpiresIn) * time.Second).UnixMilli()
	latest := after.Add(time.Duration(pair.ExpiresIn) * time.Second).UnixMilli()
	if tp.ExpiresAt < earliest || tp.ExpiresAt > latest {
		t.Errorf("ExpiresAt=%v, want within [%v, %v]", tp.ExpiresAt, earliest, latest)
	}
	assertChannelOpen(t, c)
}

func TestAuthHandler_Refresh_RejectsBadInput_NoClose(t *testing.T) {
	t.Parallel()
	userID := uuid.New()

	cases := []struct {
		name string
		env  *Envelope
	}{
		{"malformed payload JSON", envWithRawPayload(TypeAuthRefresh, []byte("not-json"))},
		{"empty token", refreshEnv(t, AuthRefreshPayload{Token: ""})},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newAuthHandler(t, nil, nil, true)
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

func TestAuthHandler_Refresh_RefresherError_UnauthorizedAndClose(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	h := newAuthHandler(t, nil, &fakeRefresher{err: errors.New("invalid or expired refresh token")}, true)
	c := newTestAuthClient(userID)

	h.Handle(c, refreshEnv(t, AuthRefreshPayload{Token: "any-refresh-token"}))

	env := recvOne(t, c)
	ep := errorPayload(t, env)
	if ep.Code != ErrCodeUnauthorized {
		t.Errorf("Code=%d, want %d (Unauthorized)", ep.Code, ErrCodeUnauthorized)
	}
	// The underlying error message should not leak verbatim.
	if contains(ep.Message, "expired refresh") {
		t.Errorf("Message leaked underlying error: %q", ep.Message)
	}
	assertChannelClosed(t, c)
}

// ---------------------------------------------------------------------------
// Sub-action dispatch — only "unknown" remains, resume/refresh now real
// ---------------------------------------------------------------------------

func TestAuthHandler_Handle_UnknownSubAction(t *testing.T) {
	t.Parallel()
	userID := uuid.New()
	h := newAuthHandler(t, nil, nil, true)
	c := newTestAuthClient(userID)

	h.Handle(c, envWithRawPayload("auth:totally-bogus", json.RawMessage(`{}`)))

	env := recvOne(t, c)
	ep := errorPayload(t, env)
	if ep.Code != ErrCodeBadMessage {
		t.Errorf("Code=%d, want %d", ep.Code, ErrCodeBadMessage)
	}
	if !contains(ep.Message, "unknown auth sub-action") {
		t.Errorf("Message=%q does not contain marker", ep.Message)
	}
	assertChannelOpen(t, c)
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
