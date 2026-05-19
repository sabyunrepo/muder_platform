package theme

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/testutil/postgrestest"
)

type themeFixture struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func setupThemeFixture(t *testing.T) *themeFixture {
	t.Helper()
	ctx := context.Background()
	connStr := postgrestest.Start(ctx, t)

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
	id, _ := f.createThemeForUserWithStatus(t, creatorID, "DRAFT", json.RawMessage(`{}`))
	return id
}

func (f *themeFixture) createThemeForUserWithStatus(t *testing.T, creatorID uuid.UUID, status string, config json.RawMessage) (uuid.UUID, string) {
	t.Helper()
	slug := fmt.Sprintf("theme-%s", uuid.New().String()[:8])
	var id uuid.UUID
	if err := f.pool.QueryRow(context.Background(), `
		INSERT INTO themes (creator_id, title, slug, min_players, max_players, duration_min, status, config_json)
		VALUES ($1, 'Theme', $2, 2, 6, 60, $3, $4)
		RETURNING id
	`, creatorID, slug, status, config).Scan(&id); err != nil {
		t.Fatalf("create theme: %v", err)
	}
	if status == "PUBLISHED" {
		if _, err := f.pool.Exec(context.Background(), `
			UPDATE themes SET published_at = NOW() WHERE id = $1
		`, id); err != nil {
			t.Fatalf("publish theme timestamp: %v", err)
		}
	}
	return id, slug
}
