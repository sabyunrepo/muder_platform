package theme

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/mmp-platform/server/internal/db"
)

type themeFixture struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func setupThemeFixture(t *testing.T) *themeFixture {
	t.Helper()
	ctx := context.Background()
	pgC, err := postgres.Run(ctx,
		"public.ecr.aws/docker/library/postgres:16-alpine",
		testcontainers.WithWaitStrategy(wait.ForLog("database system is ready to accept connections").WithOccurrence(2)),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() {
		if err := pgC.Terminate(ctx); err != nil {
			t.Logf("terminate container: %v", err)
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

	goose.SetBaseFS(nil)
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatalf("goose.SetDialect: %v", err)
	}
	if err := goose.Up(sqlDB, migrationsPath()); err != nil {
		t.Fatalf("goose.Up: %v", err)
	}
	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	t.Cleanup(pool.Close)
	return &themeFixture{pool: pool, q: db.New(pool)}
}

func migrationsPath() string {
	abs, err := filepath.Abs("../../../db/migrations")
	if err != nil {
		panic("migrationsPath: " + err.Error())
	}
	return abs
}

func (f *themeFixture) createUser(t *testing.T) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	if err := f.pool.QueryRow(context.Background(), `
		INSERT INTO users (nickname, email, provider, provider_id)
		VALUES ($1, $2, 'local', $3)
		RETURNING id
	`, "tester", fmt.Sprintf("t%s@test.com", uuid.New().String()[:8]), uuid.New().String()).Scan(&id); err != nil {
		t.Fatalf("create user: %v", err)
	}
	return id
}

func (f *themeFixture) createThemeForUser(t *testing.T, creatorID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	if err := f.pool.QueryRow(context.Background(), `
		INSERT INTO themes (creator_id, title, slug, min_players, max_players, duration_min, config_json)
		VALUES ($1, 'Theme', $2, 2, 6, 60, '{}')
		RETURNING id
	`, creatorID, fmt.Sprintf("theme-%s", uuid.New().String()[:8])).Scan(&id); err != nil {
		t.Fatalf("create theme: %v", err)
	}
	return id
}
