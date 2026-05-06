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

var (
	openDB          = sql.Open
	setGooseDialect = goose.SetDialect
	runGooseUp      = goose.Up
)

func main() {
	if err := run(); err != nil {
		log.Fatal().Err(err).Msg("migrate preview")
	}
}

func run() error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "/db/migrations"
	}

	db, err := openDB("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer db.Close()

	if err := setGooseDialect("postgres"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}
	if err := runGooseUp(db, migrationsDir); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}
	log.Info().Str("migrations_dir", migrationsDir).Msg("migrations applied")
	return nil
}
