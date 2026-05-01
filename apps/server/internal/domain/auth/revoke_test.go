package auth

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib" // pgx stdlib driver for goose
	"github.com/pressly/goose/v3"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/mmp-platform/server/internal/db"
)

// ---------------------------------------------------------------------------
// Unit tests — no container required
// ---------------------------------------------------------------------------

func TestNoopRevokePublisher_AllMethodsReturnNil(t *testing.T) {
	t.Parallel()
	var p RevokePublisher = NoopRevokePublisher{}
	ctx := context.Background()

	if err := p.RevokeUser(ctx, uuid.New(), RevokeCodeBanned, "test"); err != nil {
		t.Errorf("RevokeUser: %v", err)
	}
	if err := p.RevokeSession(ctx, uuid.New(), RevokeCodeAdminRevoked, "test"); err != nil {
		t.Errorf("RevokeSession: %v", err)
	}
	if err := p.RevokeToken(ctx, "jti-123", RevokeCodeLoggedOutElsewhere, "test"); err != nil {
		t.Errorf("RevokeToken: %v", err)
	}
}

func TestNewRevokeRepo_NilQuerierPanics(t *testing.T) {
	t.Parallel()
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic for nil querier, got none")
		}
	}()
	NewRevokeRepo(nil)
}

// ---------------------------------------------------------------------------
// Integration test fixture — single postgres container per file
// ---------------------------------------------------------------------------

// revokeMigrationsDir returns the absolute path to apps/server/db/migrations.
// Test cwd is apps/server/internal/domain/auth, so three levels up plus
// db/migrations resolves correctly.
func revokeMigrationsDir() string {
	abs, err := filepath.Abs("../../../db/migrations")
	if err != nil {
		panic("revokeMigrationsDir: " + err.Error())
	}
	return abs
}

// setupRevokeRepo spins a postgres:16-alpine container, runs every goose
// migration (including 00027_ws_auth_revoke_log), and returns a
// RevokeRepo backed by a pgxpool. The container is terminated at test
// cleanup.
func setupRevokeRepo(t *testing.T) (RevokeRepo, *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()

	pgC, err := postgres.Run(ctx,
		"postgres:16-alpine",
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2),
		),
	)
	if err != nil {
		t.Fatalf("failed to start postgres container: %v", err)
	}
	t.Cleanup(func() {
		if err := pgC.Terminate(ctx); err != nil {
			t.Logf("failed to terminate postgres container: %v", err)
		}
	})

	connStr, err := pgC.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("connection string: %v", err)
	}

	sqlDB, err := sql.Open("pgx", connStr)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	defer sqlDB.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatalf("goose.SetDialect: %v", err)
	}
	if err := goose.Up(sqlDB, revokeMigrationsDir()); err != nil {
		t.Fatalf("goose.Up: %v", err)
	}

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	t.Cleanup(pool.Close)

	return NewRevokeRepo(db.New(pool)), pool
}

// truncateRevokeLog wipes the table between sub-tests so they can assume
// a clean ledger. CASCADE is unnecessary (no FK in either direction).
func truncateRevokeLog(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), "TRUNCATE revoke_log"); err != nil {
		t.Fatalf("truncate: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

func TestRevokeRepo_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in -short mode")
	}

	repo, pool := setupRevokeRepo(t)
	ctx := context.Background()

	t.Run("Insert user-wide and lookup by IsUserRevokedSince", func(t *testing.T) {
		truncateRevokeLog(t, pool)
		userID := uuid.New()
		before := time.Now().Add(-1 * time.Minute)

		rec, err := repo.Insert(ctx, RevokeEntry{
			UserID: userID,
			Reason: "admin ban",
			Code:   RevokeCodeBanned,
		})
		if err != nil {
			t.Fatalf("Insert: %v", err)
		}
		if rec.ID == uuid.Nil {
			t.Error("expected generated ID")
		}
		if rec.Code != RevokeCodeBanned {
			t.Errorf("Code = %q, want %q", rec.Code, RevokeCodeBanned)
		}
		if rec.SessionID != nil {
			t.Errorf("expected nil SessionID, got %v", *rec.SessionID)
		}
		if rec.TokenJTI != nil {
			t.Errorf("expected nil TokenJTI, got %q", *rec.TokenJTI)
		}
		if rec.RevokedAt.Before(before) {
			t.Errorf("RevokedAt %v is before reference %v", rec.RevokedAt, before)
		}

		revoked, err := repo.IsUserRevokedSince(ctx, userID, before)
		if err != nil {
			t.Fatalf("IsUserRevokedSince: %v", err)
		}
		if !revoked {
			t.Error("expected revoked=true for user with recent revoke")
		}

		// since cutoff after the revoke → must read false.
		revoked, err = repo.IsUserRevokedSince(ctx, userID, time.Now().Add(1*time.Minute))
		if err != nil {
			t.Fatalf("IsUserRevokedSince (future since): %v", err)
		}
		if revoked {
			t.Error("expected revoked=false when since cutoff is after the revoke row")
		}

		// other user is unaffected.
		other, err := repo.IsUserRevokedSince(ctx, uuid.New(), before)
		if err != nil {
			t.Fatalf("IsUserRevokedSince (other user): %v", err)
		}
		if other {
			t.Error("expected revoked=false for unrelated user")
		}
	})

	t.Run("Insert with session_id and lookup by IsSessionRevoked", func(t *testing.T) {
		truncateRevokeLog(t, pool)
		userID := uuid.New()
		sessionID := uuid.New()

		_, err := repo.Insert(ctx, RevokeEntry{
			UserID:    userID,
			SessionID: &sessionID,
			Reason:    "single tab kick",
			Code:      RevokeCodeAdminRevoked,
		})
		if err != nil {
			t.Fatalf("Insert: %v", err)
		}

		revoked, err := repo.IsSessionRevoked(ctx, sessionID)
		if err != nil {
			t.Fatalf("IsSessionRevoked: %v", err)
		}
		if !revoked {
			t.Error("expected revoked=true for session with recent revoke")
		}

		other, err := repo.IsSessionRevoked(ctx, uuid.New())
		if err != nil {
			t.Fatalf("IsSessionRevoked (other): %v", err)
		}
		if other {
			t.Error("expected revoked=false for unrelated session")
		}
	})

	t.Run("Insert with token_jti and lookup by IsTokenRevoked", func(t *testing.T) {
		truncateRevokeLog(t, pool)
		userID := uuid.New()
		jti := "jti-abc-123"
		revokedBy := uuid.New()

		rec, err := repo.Insert(ctx, RevokeEntry{
			UserID:    userID,
			TokenJTI:  &jti,
			Reason:    "logout from another device",
			Code:      RevokeCodeLoggedOutElsewhere,
			RevokedBy: &revokedBy,
		})
		if err != nil {
			t.Fatalf("Insert: %v", err)
		}
		if rec.TokenJTI == nil || *rec.TokenJTI != jti {
			t.Errorf("TokenJTI round-trip mismatch: got %v, want %q", rec.TokenJTI, jti)
		}
		if rec.RevokedBy == nil || *rec.RevokedBy != revokedBy {
			t.Errorf("RevokedBy round-trip mismatch: got %v, want %v", rec.RevokedBy, revokedBy)
		}

		revoked, err := repo.IsTokenRevoked(ctx, jti)
		if err != nil {
			t.Fatalf("IsTokenRevoked: %v", err)
		}
		if !revoked {
			t.Error("expected revoked=true for known JTI")
		}

		other, err := repo.IsTokenRevoked(ctx, "different-jti")
		if err != nil {
			t.Fatalf("IsTokenRevoked (other): %v", err)
		}
		if other {
			t.Error("expected revoked=false for unrelated JTI")
		}
	})

	t.Run("ListRecent returns newest first up to limit", func(t *testing.T) {
		truncateRevokeLog(t, pool)
		userID := uuid.New()

		codes := []string{
			RevokeCodeBanned,
			RevokeCodePasswordChanged,
			RevokeCodeAdminRevoked,
		}
		for _, c := range codes {
			if _, err := repo.Insert(ctx, RevokeEntry{
				UserID: userID,
				Reason: "audit",
				Code:   c,
			}); err != nil {
				t.Fatalf("Insert(%s): %v", c, err)
			}
			// Postgres NOW() resolution is microsecond — sleep a bit so
			// revoked_at strictly increases between rows.
			time.Sleep(2 * time.Millisecond)
		}

		rows, err := repo.ListRecent(ctx, userID, 10)
		if err != nil {
			t.Fatalf("ListRecent: %v", err)
		}
		if len(rows) != 3 {
			t.Fatalf("ListRecent len = %d, want 3", len(rows))
		}
		// Newest first: codes come back reversed.
		wantOrder := []string{
			RevokeCodeAdminRevoked,
			RevokeCodePasswordChanged,
			RevokeCodeBanned,
		}
		for i, want := range wantOrder {
			if rows[i].Code != want {
				t.Errorf("row[%d].Code = %q, want %q", i, rows[i].Code, want)
			}
		}

		// Limit honoured.
		limited, err := repo.ListRecent(ctx, userID, 2)
		if err != nil {
			t.Fatalf("ListRecent (limit=2): %v", err)
		}
		if len(limited) != 2 {
			t.Errorf("ListRecent (limit=2) len = %d, want 2", len(limited))
		}
	})

	t.Run("Insert rejects unknown code via CHECK constraint", func(t *testing.T) {
		truncateRevokeLog(t, pool)
		_, err := repo.Insert(ctx, RevokeEntry{
			UserID: uuid.New(),
			Reason: "oops",
			Code:   "totally_made_up",
		})
		if err == nil {
			t.Fatal("expected CHECK constraint violation, got nil error")
		}
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) {
			t.Fatalf("expected *pgconn.PgError, got %T: %v", err, err)
		}
		// 23514 = check_violation per Postgres SQLSTATE table.
		if pgErr.Code != "23514" {
			t.Errorf("SQLSTATE = %q, want 23514 (check_violation)", pgErr.Code)
		}
	})
}
