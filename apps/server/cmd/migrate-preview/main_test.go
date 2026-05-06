package main

import (
	"database/sql"
	"errors"
	"testing"

	"github.com/pressly/goose/v3"
)

func TestRunRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("MIGRATIONS_DIR", "")

	if err := run(); err == nil || err.Error() != "DATABASE_URL is required" {
		t.Fatalf("run() error = %v, want DATABASE_URL is required", err)
	}
}

func TestRunUsesDefaultMigrationsDir(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://mmp:mmp@localhost:5432/mmf")
	t.Setenv("MIGRATIONS_DIR", "")

	var gotDriver string
	var gotDialect string
	var gotMigrationsDir string
	stubMigrationDependencies(t, &gotDriver, &gotDialect, &gotMigrationsDir, nil)

	if err := run(); err != nil {
		t.Fatalf("run() error = %v", err)
	}
	if gotDriver != "pgx" {
		t.Fatalf("driver = %q, want pgx", gotDriver)
	}
	if gotDialect != "postgres" {
		t.Fatalf("dialect = %q, want postgres", gotDialect)
	}
	if gotMigrationsDir != "/db/migrations" {
		t.Fatalf("migrations dir = %q, want /db/migrations", gotMigrationsDir)
	}
}

func TestRunUsesMigrationsDirOverride(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://mmp:mmp@localhost:5432/mmf")
	t.Setenv("MIGRATIONS_DIR", "/custom/migrations")

	var gotDriver string
	var gotDialect string
	var gotMigrationsDir string
	stubMigrationDependencies(t, &gotDriver, &gotDialect, &gotMigrationsDir, nil)

	if err := run(); err != nil {
		t.Fatalf("run() error = %v", err)
	}
	if gotMigrationsDir != "/custom/migrations" {
		t.Fatalf("migrations dir = %q, want /custom/migrations", gotMigrationsDir)
	}
}

func TestRunWrapsGooseUpError(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://mmp:mmp@localhost:5432/mmf")
	t.Setenv("MIGRATIONS_DIR", "")

	gooseErr := errors.New("migration failed")
	var gotDriver string
	var gotDialect string
	var gotMigrationsDir string
	stubMigrationDependencies(t, &gotDriver, &gotDialect, &gotMigrationsDir, gooseErr)

	err := run()
	if !errors.Is(err, gooseErr) {
		t.Fatalf("run() error = %v, want wrapped goose error", err)
	}
}

func stubMigrationDependencies(t *testing.T, gotDriver, gotDialect, gotMigrationsDir *string, gooseErr error) {
	t.Helper()

	originalOpenDB := openDB
	originalSetGooseDialect := setGooseDialect
	originalRunGooseUp := runGooseUp
	t.Cleanup(func() {
		openDB = originalOpenDB
		setGooseDialect = originalSetGooseDialect
		runGooseUp = originalRunGooseUp
	})

	openDB = func(driverName, dataSourceName string) (*sql.DB, error) {
		*gotDriver = driverName
		return sql.Open(driverName, dataSourceName)
	}
	setGooseDialect = func(dialect string) error {
		*gotDialect = dialect
		return nil
	}
	runGooseUp = func(_ *sql.DB, dir string, _ ...goose.OptionsFunc) error {
		*gotMigrationsDir = dir
		return gooseErr
	}
}
