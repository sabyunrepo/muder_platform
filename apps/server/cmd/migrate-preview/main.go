package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		fatalf("DATABASE_URL is required")
	}

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "/db/migrations"
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		fatalf("set goose dialect: %v", err)
	}
	if err := goose.Up(db, migrationsDir); err != nil {
		fatalf("goose up: %v", err)
	}
	fmt.Fprintf(os.Stdout, "migrations applied from %s\n", migrationsDir)
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
