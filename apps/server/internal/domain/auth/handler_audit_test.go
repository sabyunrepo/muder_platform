package auth

// handler_audit_test.go — verifies that the production auth service emits the
// expected auditlog events through the real recordAudit path.
//
// Strategy: inject a fakeQuerier (no real DB) and a CapturingLogger into the
// production auth.service via NewService.  Drive HTTP handlers with
// httptest.NewRecorder so the full handler → service → recordAudit → logger
// chain executes.  Commenting out a recordAudit call in service.go MUST cause
// the corresponding test to fail.

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"golang.org/x/crypto/bcrypt"

	"github.com/mmp-platform/server/internal/auditlog"
	"github.com/mmp-platform/server/internal/db"
)

// ---------------------------------------------------------------------------
// fakeQuerier — minimal in-memory authQuerier for audit tests
// ---------------------------------------------------------------------------

type fakeQuerier struct {
	user db.User
}

func (f *fakeQuerier) GetUserByProvider(_ context.Context, _ db.GetUserByProviderParams) (db.User, error) {
	return f.user, nil
}

func (f *fakeQuerier) CreateUser(_ context.Context, _ db.CreateUserParams) (db.User, error) {
	return f.user, nil
}

func (f *fakeQuerier) GetUser(_ context.Context, _ uuid.UUID) (db.User, error) {
	return f.user, nil
}

func (f *fakeQuerier) GetUserByEmail(_ context.Context, _ pgtype.Text) (db.User, error) {
	return f.user, nil
}

func (f *fakeQuerier) CreateUserWithPassword(_ context.Context, _ db.CreateUserWithPasswordParams) (db.User, error) {
	return f.user, nil
}

func (f *fakeQuerier) SoftDeleteUser(_ context.Context, _ uuid.UUID) error {
	return nil
}

// fakeQuerierNoEmail simulates "email not found" for Register (unique check).
type fakeQuerierNoEmail struct {
	fakeQuerier
}

func (f *fakeQuerierNoEmail) GetUserByEmail(_ context.Context, _ pgtype.Text) (db.User, error) {
	return db.User{}, pgx.ErrNoRows
}

// ---------------------------------------------------------------------------
// fakeRedis — minimal redis.Client substitute using miniredis or no-op
// We use a real miniredis-like approach: create a ring client pointing at
// a non-existent address but override Set to succeed via a custom do-nothing
// redis.Client built with redis.NewClient pointing to a closed connection.
// Instead, we use go-redis' UniversalClient with a fake address and rely on
// the fact that token generation stores to Redis — use miniredis via
// go-redis/miniredis if available; otherwise skip storage assertions.
//
// For these audit tests the Redis path (generateTokenPair) must succeed.
// We use go-redis/miniredis to avoid real network deps.
// ---------------------------------------------------------------------------

func newTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	// Use a real Redis client pointed at a loopback address with a ring that
	// immediately returns error on Set — but we need Set to succeed for
	// generateTokenPair. Use miniredis if the test binary has it, otherwise
	// build a sentinel that makes the test skip.
	//
	// Simplest approach: use go-redis NewClient with a mock Do hook via
	// redis.NewClient + redis.Options.Dialer that provides an in-memory
	// response. For audit tests we only care that Append fires; token
	// storage errors are fatal to the handler. Use miniredis.
	//
	// Since miniredis may not be in go.mod yet, we use the ring trick:
	// inject a redis.Client whose underlying transport succeeds by pointing
	// at a go-redis UnstableHook. The cleanest zero-dep approach is to use
	// redis.NewClient with a custom hook that intercepts Cmd.
	//
	// Practical shortcut accepted in test-only code: start a miniredis server.
	// If miniredis is unavailable the test will fail at import — acceptable
	// because go.mod already includes go-redis which bundles miniredis in
	// its test utilities. We import it here.
	//
	// NOTE: miniredis is a test-only dep. If the module does not carry it,
	// add: github.com/alicebob/miniredis/v2 to go.mod.
	//
	// For now we use a simple approach: create a real redis.Client pointed at
	// addr "localhost:0" — it will fail on Dial, so generateTokenPair will
	// return an error and the handler returns 500. That breaks the audit
	// assertion because the service returns early before recordAudit.
	//
	// Resolution: use a redis.NewClient with a Hook that stubs Set/Exists/Del.
	c := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
	// Add a hook that short-circuits network calls for the three commands
	// used by generateTokenPair and revokeAllTokens.
	c.AddHook(&stubRedisHook{})
	return c
}

// stubRedisHook implements redis.Hook to intercept commands in tests.
type stubRedisHook struct{}

func (stubRedisHook) DialHook(next redis.DialHook) redis.DialHook { return next }

func (stubRedisHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		switch cmd.Name() {
		case "set":
			// generateTokenPair: store refresh JTI — succeed silently.
			return nil
		case "exists":
			// RefreshToken path — not exercised in audit tests.
			return nil
		case "del", "scan":
			// revokeAllTokens (Logout path) — succeed silently.
			return nil
		}
		return next(ctx, cmd)
	}
}

func (stubRedisHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// assertSingleAudit fails unless exactly one entry with action want exists.
func assertSingleAudit(t *testing.T, logger *auditlog.CapturingLogger, want auditlog.AuditAction) {
	t.Helper()
	entries := logger.Entries()
	if len(entries) != 1 {
		t.Fatalf("expected 1 audit entry, got %d", len(entries))
	}
	if entries[0].Action != want {
		t.Fatalf("action: want %q, got %q", want, entries[0].Action)
	}
	if entries[0].ActorID == nil {
		t.Fatal("ActorID must not be nil")
	}
	if entries[0].UserID == nil {
		t.Fatal("UserID must not be nil")
	}
}

// newTestService builds a production *service with fake deps.
func newTestService(t *testing.T, q authQuerier, capture *auditlog.CapturingLogger) Service {
	t.Helper()
	rc := newTestRedis(t)
	t.Cleanup(func() { _ = rc.Close() })
	// Use a fixed JWT secret for tests.
	secret := []byte("test-secret-32-bytes-long-enough!")
	return NewService(q, rc, secret, capture, nil, nil, zerolog.Nop())
}

// ---------------------------------------------------------------------------
// TestChangeHandlerCapturesAudit_Login
// ---------------------------------------------------------------------------

func TestChangeHandlerCapturesAudit_Login(t *testing.T) {
	capture := auditlog.NewCapturingLogger()

	// Build a user with a valid bcrypt password hash so Login succeeds.
	hash, err := bcrypt.GenerateFromPassword([]byte("pass1234"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("bcrypt: %v", err)
	}
	uid := uuid.New()
	fq := &fakeQuerier{
		user: db.User{
			ID:           uid,
			Nickname:     "testplayer",
			Role:         "PLAYER",
			PasswordHash: pgtype.Text{String: string(hash), Valid: true},
		},
	}

	svc := newTestService(t, fq, capture)
	h := NewHandler(svc)

	body := jsonBody(t, map[string]string{
		"email":    "test@example.com",
		"password": "pass1234",
	})
	req := httptest.NewRequest(http.MethodPost, "/auth/login", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.HandleLogin(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	assertSingleAudit(t, capture, auditlog.ActionUserLogin)
}

// ---------------------------------------------------------------------------
// TestChangeHandlerCapturesAudit_Logout
// ---------------------------------------------------------------------------

func TestChangeHandlerCapturesAudit_Logout(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	userID := uuid.New()

	fq := &fakeQuerier{
		user: db.User{ID: userID, Nickname: "testplayer", Role: "PLAYER"},
	}

	svc := newTestService(t, fq, capture)
	h := NewHandler(svc)

	req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	req = withAuthContext(req, userID, "PLAYER")
	rec := httptest.NewRecorder()

	h.HandleLogout(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	assertSingleAudit(t, capture, auditlog.ActionUserLogout)
}

// ---------------------------------------------------------------------------
// TestChangeHandlerCapturesAudit_Register
// ---------------------------------------------------------------------------

func TestChangeHandlerCapturesAudit_Register(t *testing.T) {
	capture := auditlog.NewCapturingLogger()
	uid := uuid.New()

	// fakeQuerierNoEmail: GetUserByEmail returns ErrNoRows (email not taken),
	// CreateUserWithPassword returns the new user.
	fq := &fakeQuerierNoEmail{
		fakeQuerier: fakeQuerier{
			user: db.User{
				ID:       uid,
				Nickname: "NewPlayer",
				Role:     "PLAYER",
			},
		},
	}

	svc := newTestService(t, fq, capture)
	h := NewHandler(svc)

	body := jsonBody(t, map[string]string{
		"email":    "newuser@example.com",
		"password": "pass1234",
		"nickname": "NewPlayer",
	})
	req := httptest.NewRequest(http.MethodPost, "/auth/register", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.HandleRegister(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	assertSingleAudit(t, capture, auditlog.ActionUserRegister)
}
