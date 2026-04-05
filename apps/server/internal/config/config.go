package config

import (
	"fmt"
	"os"
	"reflect"
	"strconv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	Port        int    `env:"PORT" default:"8080"`
	Env         string `env:"APP_ENV" default:"development"`
	LogLevel    string `env:"LOG_LEVEL" default:"debug"`
	DatabaseURL string `env:"DATABASE_URL" required:"true"`
	RedisURL    string `env:"REDIS_URL" required:"true"`
	CORSOrigins string `env:"CORS_ORIGINS" default:"http://localhost:5173"`
	BaseURL      string `env:"BASE_URL" default:"http://localhost:5173"`
	JWTSecret    string `env:"JWT_SECRET" default:"dev-secret-change-me"`
	SentryDSN    string `env:"SENTRY_DSN" default:""`
	OTelEndpoint string `env:"OTEL_EXPORTER_OTLP_ENDPOINT" default:""`
	AppVersion   string `env:"APP_VERSION" default:"0.1.0"`
}

// IsDevelopment returns true if the application is running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
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

		envVal, exists := os.LookupEnv(envKey)
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
