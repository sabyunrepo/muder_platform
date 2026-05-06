package main

import (
	"database/sql"
	"errors"
	"testing"
)

func TestRunRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("MIGRATIONS_DIR", "")

	if err := run(fakeMigrationRunner{}); err == nil || err.Error() != "DATABASE_URL is required" {
		t.Fatalf("run() error = %v, want DATABASE_URL is required", err)
	}
}

func TestRunCLIReturnsFailureCode(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("MIGRATIONS_DIR", "")

	if code := runCLI(fakeMigrationRunner{}); code != 1 {
		t.Fatalf("runCLI() = %d, want 1", code)
	}
}

func TestRunCLIReturnsSuccessCode(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://mmp:mmp@localhost:5432/mmf")
	t.Setenv("MIGRATIONS_DIR", "")

	if code := runCLI(fakeMigrationRunner{}); code != 0 {
		t.Fatalf("runCLI() = %d, want 0", code)
	}
}

func TestRunUsesDefaultMigrationsDir(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://mmp:mmp@localhost:5432/mmf")
	t.Setenv("MIGRATIONS_DIR", "")

	var gotDriver string
	var gotDialect string
	var gotMigrationsDir string
	runner := fakeMigrationRunner{
		gotDriver:        &gotDriver,
		gotDialect:       &gotDialect,
		gotMigrationsDir: &gotMigrationsDir,
	}

	if err := run(runner); err != nil {
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
	runner := fakeMigrationRunner{
		gotDriver:        &gotDriver,
		gotDialect:       &gotDialect,
		gotMigrationsDir: &gotMigrationsDir,
	}

	if err := run(runner); err != nil {
		t.Fatalf("run() error = %v", err)
	}
	if gotDriver != "pgx" {
		t.Fatalf("driver = %q, want pgx", gotDriver)
	}
	if gotDialect != "postgres" {
		t.Fatalf("dialect = %q, want postgres", gotDialect)
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
	runner := fakeMigrationRunner{
		gotDriver:        &gotDriver,
		gotDialect:       &gotDialect,
		gotMigrationsDir: &gotMigrationsDir,
		gooseErr:         gooseErr,
	}

	err := run(runner)
	if !errors.Is(err, gooseErr) {
		t.Fatalf("run() error = %v, want wrapped goose error", err)
	}
}

func TestRunWrapsOpenDBError(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://mmp:mmp@localhost:5432/mmf")
	t.Setenv("MIGRATIONS_DIR", "")

	openErr := errors.New("open failed")
	var gotDriver string
	var gotDialect string
	var gotMigrationsDir string
	runner := fakeMigrationRunner{
		gotDriver:        &gotDriver,
		gotDialect:       &gotDialect,
		gotMigrationsDir: &gotMigrationsDir,
		openErr:          openErr,
	}

	err := run(runner)
	if !errors.Is(err, openErr) {
		t.Fatalf("run() error = %v, want wrapped open error", err)
	}
	if gotDriver != "pgx" {
		t.Fatalf("driver = %q, want pgx", gotDriver)
	}
	if gotDialect != "" {
		t.Fatalf("dialect = %q, want empty because OpenDB failed first", gotDialect)
	}
	if gotMigrationsDir != "" {
		t.Fatalf("migrations dir = %q, want empty because OpenDB failed first", gotMigrationsDir)
	}
}

func TestRunWrapsSetDialectError(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://mmp:mmp@localhost:5432/mmf")
	t.Setenv("MIGRATIONS_DIR", "")

	dialectErr := errors.New("unknown dialect")
	var gotDriver string
	var gotDialect string
	var gotMigrationsDir string
	runner := fakeMigrationRunner{
		gotDriver:        &gotDriver,
		gotDialect:       &gotDialect,
		gotMigrationsDir: &gotMigrationsDir,
		dialectErr:       dialectErr,
	}

	err := run(runner)
	if !errors.Is(err, dialectErr) {
		t.Fatalf("run() error = %v, want wrapped dialect error", err)
	}
	if gotDriver != "pgx" {
		t.Fatalf("driver = %q, want pgx", gotDriver)
	}
	if gotDialect != "postgres" {
		t.Fatalf("dialect = %q, want postgres", gotDialect)
	}
	if gotMigrationsDir != "" {
		t.Fatalf("migrations dir = %q, want empty because SetDialect failed first", gotMigrationsDir)
	}
}

func TestGooseMigrationRunnerOpenDB(t *testing.T) {
	db, err := gooseMigrationRunner{}.OpenDB("pgx", "postgres://mmp:mmp@localhost:5432/mmf")
	if err != nil {
		t.Fatalf("OpenDB() error = %v", err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Fatalf("Close() error = %v", err)
		}
	})
}

func TestGooseMigrationRunnerSetDialect(t *testing.T) {
	if err := (gooseMigrationRunner{}).SetDialect("postgres"); err != nil {
		t.Fatalf("SetDialect() error = %v", err)
	}
}

func TestGooseMigrationRunnerUpReturnsConnectionError(t *testing.T) {
	db, err := sql.Open("pgx", "invalid database url")
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Fatalf("Close() error = %v", err)
		}
	})

	if err := (gooseMigrationRunner{}).Up(db, t.TempDir()); err == nil {
		t.Fatal("Up() error = nil, want connection error")
	}
}

type fakeMigrationRunner struct {
	gotDriver        *string
	gotDialect       *string
	gotMigrationsDir *string
	openErr          error
	dialectErr       error
	gooseErr         error
}

func (f fakeMigrationRunner) OpenDB(driverName, dataSourceName string) (*sql.DB, error) {
	if f.gotDriver != nil {
		*f.gotDriver = driverName
	}
	if f.openErr != nil {
		return nil, f.openErr
	}
	return sql.Open(driverName, dataSourceName)
}

func (f fakeMigrationRunner) SetDialect(dialect string) error {
	if f.gotDialect != nil {
		*f.gotDialect = dialect
	}
	return f.dialectErr
}

func (f fakeMigrationRunner) Up(_ *sql.DB, dir string) error {
	if f.gotMigrationsDir != nil {
		*f.gotMigrationsDir = dir
	}
	return f.gooseErr
}
