package config

import (
	"fmt"
	"os"
	"reflect"
	"strconv"
	"strings"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	Port         int    `env:"PORT" default:"8080"`
	Env          string `env:"APP_ENV" default:"development"`
	LogLevel     string `env:"LOG_LEVEL" default:"debug"`
	DatabaseURL  string `env:"DATABASE_URL" required:"true"`
	RedisURL     string `env:"REDIS_URL" required:"true"`
	CORSOrigins  string `env:"CORS_ORIGINS" default:"http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"`
	BaseURL      string `env:"BASE_URL" default:"http://localhost:5173"`
	JWTSecret    string `env:"JWT_SECRET" default:"dev-secret-change-me"`
	SentryDSN    string `env:"SENTRY_DSN" default:""`
	OTelEndpoint string `env:"OTEL_EXPORTER_OTLP_ENDPOINT" default:""`
	AppVersion   string `env:"APP_VERSION" default:"0.1.0"`

	// LiveKit voice chat configuration
	LiveKitURL       string `env:"LIVEKIT_URL" default:""`
	LiveKitAPIKey    string `env:"LIVEKIT_API_KEY" default:""`
	LiveKitAPISecret string `env:"LIVEKIT_API_SECRET" default:""`

	// Media storage provider configuration.
	// auto: use R2 when configured, otherwise local dev storage.
	StorageProvider     string `env:"STORAGE_PROVIDER" default:"auto"`
	StorageLocalBaseDir string `env:"STORAGE_LOCAL_BASE_DIR" default:"tmp/uploads"`

	// Cloudflare R2 media storage configuration
	R2AccountID       string `env:"R2_ACCOUNT_ID" aliases:"STORAGE_R2_ACCOUNT_ID" default:""`
	R2AccessKeyID     string `env:"R2_ACCESS_KEY_ID" aliases:"STORAGE_R2_ACCESS_KEY_ID" default:""`
	R2SecretAccessKey string `env:"R2_SECRET_ACCESS_KEY" aliases:"STORAGE_R2_SECRET_ACCESS_KEY" default:""`
	R2BucketName      string `env:"R2_BUCKET_NAME" aliases:"STORAGE_R2_BUCKET,STORAGE_R2_BUCKET_NAME" default:""`
	R2PublicURL       string `env:"R2_PUBLIC_URL" aliases:"STORAGE_R2_PUBLIC_URL" default:""`

	// Feature flags
	// GameRuntimeV2 enables the Phase 18.x modular game runtime (default off).
	GameRuntimeV2 bool `env:"GAME_RUNTIME_V2" default:"false"`
	// WSAuthProtocol enables the PR-9 auth.* WS protocol handlers (default
	// off). When false the legacy upgrade-time JWT check is the only auth
	// gate and inbound auth.* frames are silently dropped — a client that
	// ships the new protocol stays compatible with a back-rollout.
	WSAuthProtocol bool `env:"MMP_WS_AUTH_PROTOCOL" default:"false"`
}

// IsDevelopment returns true if the application is running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}

// HasLiveKit returns true if LiveKit configuration is present.
func (c *Config) HasLiveKit() bool {
	return c.LiveKitURL != "" && c.LiveKitAPIKey != "" && c.LiveKitAPISecret != ""
}

// NormalizedStorageProvider returns the storage provider mode in a stable form.
func (c *Config) NormalizedStorageProvider() string {
	provider := strings.ToLower(strings.TrimSpace(c.StorageProvider))
	if provider == "" {
		return "auto"
	}
	return provider
}

// HasR2StorageConfig returns true when the required R2 storage credentials are present.
func (c *Config) HasR2StorageConfig() bool {
	return len(c.MissingR2StorageEnv()) == 0
}

// MissingR2StorageEnv returns canonical R2 env names that are required to use R2.
func (c *Config) MissingR2StorageEnv() []string {
	required := []struct {
		name  string
		value string
	}{
		{name: "R2_ACCOUNT_ID", value: c.R2AccountID},
		{name: "R2_ACCESS_KEY_ID", value: c.R2AccessKeyID},
		{name: "R2_SECRET_ACCESS_KEY", value: c.R2SecretAccessKey},
		{name: "R2_BUCKET_NAME", value: c.R2BucketName},
	}

	missing := make([]string, 0, len(required))
	for _, item := range required {
		if strings.TrimSpace(item.value) == "" {
			missing = append(missing, item.name)
		}
	}
	return missing
}

// ServerBaseURL returns the base URL of this server for constructing local
// storage upload/download URLs in dev mode.
func (c *Config) ServerBaseURL() string {
	return fmt.Sprintf("http://localhost:%d", c.Port)
}

// Load reads configuration from environment variables using struct tags.
// Fields tagged with `env:"VAR_NAME"` are populated from the corresponding
// environment variable. Fields with `default:"value"` use that value when
// the environment variable is not set.
func Load() (*Config, error) {
	cfg := &Config{}

	v := reflect.ValueOf(cfg).Elem()
	t := v.Type()

	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		fieldVal := v.Field(i)

		envKey := field.Tag.Get("env")
		if envKey == "" {
			continue
		}

		envVal, exists := lookupFieldEnv(field)
		if !exists {
			envVal = field.Tag.Get("default")
		}

		if envVal == "" {
			continue
		}

		switch fieldVal.Kind() {
		case reflect.String:
			fieldVal.SetString(envVal)
		case reflect.Int:
			intVal, err := strconv.Atoi(envVal)
			if err != nil {
				return nil, fmt.Errorf("config: invalid integer for %s: %w", envKey, err)
			}
			fieldVal.SetInt(int64(intVal))
		case reflect.Bool:
			boolVal, err := strconv.ParseBool(envVal)
			if err != nil {
				return nil, fmt.Errorf("config: invalid boolean for %s: %w", envKey, err)
			}
			fieldVal.SetBool(boolVal)
		default:
			return nil, fmt.Errorf("config: unsupported field type %s for %s", fieldVal.Kind(), field.Name)
		}
	}

	// Validate required fields.
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		if field.Tag.Get("required") != "true" {
			continue
		}
		fieldVal := v.Field(i)
		if fieldVal.IsZero() {
			envKey := field.Tag.Get("env")
			return nil, fmt.Errorf("config: required environment variable %s is not set", envKey)
		}
	}

	return cfg, nil
}

func lookupFieldEnv(field reflect.StructField) (string, bool) {
	envKey := field.Tag.Get("env")
	if envKey != "" {
		if envVal, exists := os.LookupEnv(envKey); exists {
			if envVal != "" {
				return envVal, true
			}
			if field.Tag.Get("aliases") == "" {
				return envVal, true
			}
		}
	}

	for _, alias := range strings.Split(field.Tag.Get("aliases"), ",") {
		alias = strings.TrimSpace(alias)
		if alias == "" {
			continue
		}
		if envVal, exists := os.LookupEnv(alias); exists {
			if envVal != "" {
				return envVal, true
			}
		}
	}

	return "", false
}
