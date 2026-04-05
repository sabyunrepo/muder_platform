package main

import (
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/config"
	"github.com/mmp-platform/server/internal/health"
	"github.com/mmp-platform/server/internal/middleware"
	"github.com/mmp-platform/server/internal/seo"
	"github.com/mmp-platform/server/internal/server"
)

func main() {
	// 1. Config
	cfg, err := config.Load()
	if err != nil {
		// Use a temporary logger for startup errors only.
		startupLogger := zerolog.New(os.Stderr).With().Timestamp().Logger()
		startupLogger.Fatal().Err(err).Msg("failed to load config")
	}

	// 2. Logger
	level, err := zerolog.ParseLevel(cfg.LogLevel)
	if err != nil {
		level = zerolog.DebugLevel
	}

	var logger zerolog.Logger
	if cfg.IsDevelopment() {
		logger = zerolog.New(zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
		}).
			Level(level).
			With().
			Timestamp().
			Str("service", "mmp-server").
			Logger()
	} else {
		logger = zerolog.New(os.Stdout).
			Level(level).
			With().
			Timestamp().
			Str("service", "mmp-server").
			Logger()
	}

	// 3. Router
	r := chi.NewRouter()

	// 4. Middleware (order matters: outermost first)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger(logger))
	r.Use(middleware.Recovery)
	r.Use(middleware.CORS(cfg.IsDevelopment(), cfg.CORSOrigins))

	// 5. Health endpoints
	healthHandler := health.NewHandler()
	r.Get("/health", healthHandler.Health)
	r.Get("/ready", healthHandler.Ready)

	// 6. SEO pages
	seoHandler := seo.NewHandler(cfg.BaseURL, logger)
	seoHandler.RegisterRoutes(r)

	// 7. Server start + graceful shutdown
	srv := server.New(cfg.Port, r, logger)
	if err := srv.Start(); err != nil {
		logger.Fatal().Err(err).Msg("server exited with error")
	}
}
