package config

import (
	"os"
	"testing"
)

func TestLoad_Defaults(t *testing.T) {
	// Set required fields so Load() doesn't fail.
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("REDIS_URL", "redis://localhost:6379")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Port != 8080 {
		t.Errorf("expected Port 8080, got %d", cfg.Port)
	}
	if cfg.Env != "development" {
		t.Errorf("expected Env 'development', got %q", cfg.Env)
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("expected LogLevel 'debug', got %q", cfg.LogLevel)
	}
	if cfg.DatabaseURL != "postgres://localhost/test" {
		t.Errorf("expected DatabaseURL from env, got %q", cfg.DatabaseURL)
	}
	if cfg.RedisURL != "redis://localhost:6379" {
		t.Errorf("expected RedisURL from env, got %q", cfg.RedisURL)
	}
	if cfg.CORSOrigins != "http://localhost:5173" {
		t.Errorf("expected CORSOrigins default, got %q", cfg.CORSOrigins)
	}
	if cfg.BaseURL != "http://localhost:5173" {
		t.Errorf("expected BaseURL default, got %q", cfg.BaseURL)
	}
}

func TestLoad_CustomValues(t *testing.T) {
	t.Setenv("PORT", "9090")
	t.Setenv("APP_ENV", "production")
	t.Setenv("LOG_LEVEL", "info")
	t.Setenv("DATABASE_URL", "postgres://prod/db")
	t.Setenv("REDIS_URL", "redis://prod:6379")
	t.Setenv("CORS_ORIGINS", "https://example.com,https://app.example.com")
	t.Setenv("BASE_URL", "https://example.com")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.Port != 9090 {
		t.Errorf("expected Port 9090, got %d", cfg.Port)
	}
	if cfg.Env != "production" {
		t.Errorf("expected Env 'production', got %q", cfg.Env)
	}
	if cfg.CORSOrigins != "https://example.com,https://app.example.com" {
		t.Errorf("expected CORSOrigins from env, got %q", cfg.CORSOrigins)
	}
	if !cfg.IsDevelopment() == true {
		// production mode
	}
	if cfg.IsDevelopment() {
		t.Error("expected IsDevelopment() to be false for production")
	}
}

func TestLoad_MissingDatabaseURL(t *testing.T) {
	// Unset DATABASE_URL, set REDIS_URL.
	os.Unsetenv("DATABASE_URL")
	t.Setenv("REDIS_URL", "redis://localhost:6379")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for missing DATABASE_URL, got nil")
	}
}

func TestLoad_MissingRedisURL(t *testing.T) {
	// Set DATABASE_URL, unset REDIS_URL.
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	os.Unsetenv("REDIS_URL")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for missing REDIS_URL, got nil")
	}
}

func TestLoad_InvalidPort(t *testing.T) {
	t.Setenv("PORT", "not-a-number")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("REDIS_URL", "redis://localhost:6379")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for invalid PORT, got nil")
	}
}

func TestIsDevelopment(t *testing.T) {
	cfg := &Config{Env: "development"}
	if !cfg.IsDevelopment() {
		t.Error("expected true for development env")
	}

	cfg.Env = "production"
	if cfg.IsDevelopment() {
		t.Error("expected false for production env")
	}
}
