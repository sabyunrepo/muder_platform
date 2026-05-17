package config

import (
	"os"
	"testing"
)

// envVarsToClean lists all env vars read by Load() so tests start from a clean state.
var envVarsToClean = []string{
	"PORT", "APP_ENV", "LOG_LEVEL", "DATABASE_URL", "REDIS_URL",
	"CORS_ORIGINS", "BASE_URL", "JWT_SECRET", "SENTRY_DSN",
	"OTEL_EXPORTER_OTLP_ENDPOINT", "APP_VERSION",
	"LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET",
	"R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
	"R2_BUCKET_NAME", "R2_PUBLIC_URL",
	"STORAGE_PROVIDER", "STORAGE_LOCAL_BASE_DIR",
	"STORAGE_R2_ACCOUNT_ID", "STORAGE_R2_ACCESS_KEY_ID", "STORAGE_R2_SECRET_ACCESS_KEY",
	"STORAGE_R2_BUCKET", "STORAGE_R2_BUCKET_NAME", "STORAGE_R2_PUBLIC_URL",
	"GAME_RUNTIME_V2", "MMP_WS_AUTH_PROTOCOL",
}

// cleanEnv unsets all config-related env vars for the duration of the test,
// restoring the originals via t.Cleanup. This ensures Load() sees a pristine
// environment regardless of what is set in the caller's shell or CI.
func cleanEnv(t *testing.T) {
	t.Helper()
	for _, k := range envVarsToClean {
		prev, existed := os.LookupEnv(k)
		if err := os.Unsetenv(k); err != nil {
			t.Fatalf("cleanEnv: failed to unset %s: %v", k, err)
		}
		k := k // capture for closure
		if existed {
			t.Cleanup(func() { os.Setenv(k, prev) }) //nolint:errcheck
		} else {
			t.Cleanup(func() { os.Unsetenv(k) }) //nolint:errcheck
		}
	}
}

func TestLoad_Defaults(t *testing.T) {
	cleanEnv(t)
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
	if cfg.CORSOrigins != "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173" {
		t.Errorf("expected CORSOrigins default, got %q", cfg.CORSOrigins)
	}
	if cfg.BaseURL != "http://localhost:5173" {
		t.Errorf("expected BaseURL default, got %q", cfg.BaseURL)
	}
	if cfg.StorageProvider != "auto" {
		t.Errorf("expected StorageProvider default auto, got %q", cfg.StorageProvider)
	}
	if cfg.StorageLocalBaseDir != "tmp/uploads" {
		t.Errorf("expected StorageLocalBaseDir default tmp/uploads, got %q", cfg.StorageLocalBaseDir)
	}
	if cfg.WSAuthProtocol {
		t.Error("expected WSAuthProtocol default false")
	}
}

func TestLoad_StorageR2Aliases(t *testing.T) {
	cleanEnv(t)
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("REDIS_URL", "redis://localhost:6379")
	t.Setenv("STORAGE_PROVIDER", "r2")
	t.Setenv("R2_ACCOUNT_ID", "")
	t.Setenv("STORAGE_R2_ACCOUNT_ID", "account")
	t.Setenv("STORAGE_R2_ACCESS_KEY_ID", "access")
	t.Setenv("STORAGE_R2_SECRET_ACCESS_KEY", "secret")
	t.Setenv("STORAGE_R2_BUCKET", "bucket")
	t.Setenv("STORAGE_R2_PUBLIC_URL", "https://cdn.example.test")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if cfg.StorageProvider != "r2" {
		t.Errorf("expected StorageProvider r2, got %q", cfg.StorageProvider)
	}
	if cfg.R2AccountID != "account" {
		t.Errorf("expected R2AccountID from storage alias, got %q", cfg.R2AccountID)
	}
	if cfg.R2AccessKeyID != "access" {
		t.Errorf("expected R2AccessKeyID from storage alias, got %q", cfg.R2AccessKeyID)
	}
	if cfg.R2SecretAccessKey != "secret" {
		t.Errorf("expected R2SecretAccessKey from storage alias, got %q", cfg.R2SecretAccessKey)
	}
	if cfg.R2BucketName != "bucket" {
		t.Errorf("expected R2BucketName from storage alias, got %q", cfg.R2BucketName)
	}
	if cfg.R2PublicURL != "https://cdn.example.test" {
		t.Errorf("expected R2PublicURL from storage alias, got %q", cfg.R2PublicURL)
	}
}

func TestStorageProviderHelpers(t *testing.T) {
	cfg := &Config{
		StorageProvider:     " R2 ",
		R2AccountID:         "account",
		R2AccessKeyID:       "access",
		R2SecretAccessKey:   "secret",
		R2BucketName:        "bucket",
		StorageLocalBaseDir: "tmp/uploads",
	}

	if cfg.NormalizedStorageProvider() != "r2" {
		t.Errorf("expected normalized provider r2, got %q", cfg.NormalizedStorageProvider())
	}
	if !cfg.HasR2StorageConfig() {
		t.Error("expected complete R2 storage config")
	}
	if missing := cfg.MissingR2StorageEnv(); len(missing) != 0 {
		t.Errorf("expected no missing R2 env, got %v", missing)
	}

	cfg.R2BucketName = ""
	missing := cfg.MissingR2StorageEnv()
	if len(missing) != 1 || missing[0] != "R2_BUCKET_NAME" {
		t.Errorf("expected missing R2_BUCKET_NAME, got %v", missing)
	}
	if cfg.HasR2StorageConfig() {
		t.Error("expected incomplete R2 storage config")
	}
}

func TestLoad_WSAuthProtocolEnabled(t *testing.T) {
	cleanEnv(t)
	t.Setenv("DATABASE_URL", "postgres://localhost/test")
	t.Setenv("REDIS_URL", "redis://localhost:6379")
	t.Setenv("MMP_WS_AUTH_PROTOCOL", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !cfg.WSAuthProtocol {
		t.Error("expected WSAuthProtocol true when MMP_WS_AUTH_PROTOCOL=true")
	}
}

func TestLoad_CustomValues(t *testing.T) {
	cleanEnv(t)
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
	cleanEnv(t)
	// DATABASE_URL intentionally not set; only REDIS_URL provided.
	t.Setenv("REDIS_URL", "redis://localhost:6379")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for missing DATABASE_URL, got nil")
	}
}

func TestLoad_MissingRedisURL(t *testing.T) {
	cleanEnv(t)
	// REDIS_URL intentionally not set; only DATABASE_URL provided.
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error for missing REDIS_URL, got nil")
	}
}

func TestLoad_InvalidPort(t *testing.T) {
	cleanEnv(t)
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
