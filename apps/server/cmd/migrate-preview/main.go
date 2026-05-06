package main

import (
	"database/sql"
	"errors"
	"fmt"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/rs/zerolog/log"
)

func main() {
	if err := run(gooseMigrationRunner{}); err != nil {
		log.Fatal().Err(err).Msg("migrate preview")
	}
}

type migrationRunner interface {
	OpenDB(driverName, dataSourceName string) (*sql.DB, error)
	SetDialect(dialect string) error
	Up(db *sql.DB, dir string) error
}

type gooseMigrationRunner struct{}

func (gooseMigrationRunner) OpenDB(driverName, dataSourceName string) (*sql.DB, error) {
	return sql.Open(driverName, dataSourceName)
}

func (gooseMigrationRunner) SetDialect(dialect string) error {
	return goose.SetDialect(dialect)
}

func (gooseMigrationRunner) Up(db *sql.DB, dir string) error {
	return goose.Up(db, dir)
}

func run(runner migrationRunner) error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "/db/migrations"
	}

	db, err := runner.OpenDB("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer db.Close()

	if err := runner.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}
	if err := runner.Up(db, migrationsDir); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}
	log.Info().Str("migrations_dir", migrationsDir).Msg("migrations applied")
	return nil
}
