package editor

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/rs/zerolog"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/mmp-platform/server/internal/db"
)

func migrationsPath() string {
	abs, err := filepath.Abs("../../../db/migrations")
	if err != nil {
		panic("migrationsPath: " + err.Error())
	}
	return abs
}

type testFixture struct {
	pool *pgxpool.Pool
	q    *db.Queries
	svc  Service
}

func setupFixture(t *testing.T) *testFixture {
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

	q := db.New(pool)
	svc := NewService(q, pool, zerolog.Nop())
	return &testFixture{pool: pool, q: q, svc: svc}
}

func (f *testFixture) createUser(t *testing.T) uuid.UUID {
	t.Helper()
	u, err := f.q.CreateUser(context.Background(), db.CreateUserParams{
		Nickname:   fmt.Sprintf("tester-%s", uuid.New().String()[:8]),
		Email:      pgtype.Text{String: fmt.Sprintf("t%s@test.com", uuid.New().String()[:8]), Valid: true},
		Provider:   "local",
		ProviderID: uuid.New().String(),
	})
	if err != nil {
		t.Fatalf("createUser: %v", err)
	}
	return u.ID
}

func (f *testFixture) createThemeForUser(t *testing.T, creatorID uuid.UUID) uuid.UUID {
	t.Helper()
	slug := fmt.Sprintf("theme-%s", uuid.New().String()[:8])
	th, err := f.q.CreateTheme(context.Background(), db.CreateThemeParams{
		CreatorID:   creatorID,
		Title:       "Test Theme",
		Slug:        slug,
		MinPlayers:  2,
		MaxPlayers:  6,
		DurationMin: 60,
		ConfigJson:  []byte(`{}`),
	})
	if err != nil {
		t.Fatalf("createTheme: %v", err)
	}
	return th.ID
}

func (f *testFixture) createClue(t *testing.T, themeID uuid.UUID, name string) uuid.UUID {
	t.Helper()
	c, err := f.q.CreateClue(context.Background(), db.CreateClueParams{
		ThemeID:   themeID,
		Name:      name,
		Level:     1,
		ClueType:  "normal",
		SortOrder: 0,
	})
	if err != nil {
		t.Fatalf("createClue(%s): %v", name, err)
	}
	return c.ID
}
