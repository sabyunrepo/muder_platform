package main

import (
	"context"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/config"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/health"
	"github.com/mmp-platform/server/internal/infra/cache"
	"github.com/mmp-platform/server/internal/infra/lock"
	"github.com/mmp-platform/server/internal/infra/postgres"
	"github.com/mmp-platform/server/internal/middleware"
	"github.com/mmp-platform/server/internal/seo"
	"github.com/mmp-platform/server/internal/server"
	"github.com/mmp-platform/server/internal/ws"
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

	// 3. PostgreSQL
	pool, err := postgres.New(cfg.DatabaseURL)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to connect to postgres")
	}
	defer pool.Close()
	logger.Info().Msg("postgres connected")

	// 4. Redis (cache + lock)
	redisCache, err := cache.NewRedis(cfg.RedisURL)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to connect to redis")
	}
	defer redisCache.Close()
	logger.Info().Msg("redis connected")

	locker := lock.NewRedisLocker(redisCache.Client())

	// 5. sqlc Queries
	queries := db.New(pool)

	// Suppress unused variable warnings until services consume them.
	_ = locker
	_ = queries

	// 6. WebSocket Hub
	wsRouter := ws.NewRouter(logger)
	wsHub := ws.NewHub(wsRouter, ws.NoopPubSub{}, logger)
	defer wsHub.Stop()
	logger.Info().Msg("websocket hub started")

	// 7. HTTP Router
	r := chi.NewRouter()

	// 7. Middleware (order matters: outermost first)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger(logger))
	r.Use(middleware.Recovery)
	r.Use(middleware.CORS(cfg.IsDevelopment(), cfg.CORSOrigins))

	// 8. Health endpoints (with DB + Redis checks)
	healthHandler := health.NewHandler(
		pool.Ping,
		func(ctx context.Context) error { return redisCache.Ping(ctx) },
	)
	r.Get("/health", healthHandler.Health)
	r.Get("/ready", healthHandler.Ready)

	// 10. SEO pages
	seoHandler := seo.NewHandler(cfg.BaseURL, logger)
	seoHandler.RegisterRoutes(r)

	// 11. WebSocket endpoints
	wsCfg := ws.UpgradeConfig{
		AllowedOrigins: cfg.CORSOrigins,
		DevMode:        cfg.IsDevelopment(),
	}
	gameUpgrade := ws.UpgradeHandler(wsHub, ws.DefaultPlayerIDExtractor, wsCfg, logger)
	r.Get("/ws/game", gameUpgrade)
	r.Get("/ws/social", gameUpgrade)

	// 12. Server start + graceful shutdown
	srv := server.New(cfg.Port, r, logger)
	if err := srv.Start(); err != nil {
		logger.Fatal().Err(err).Msg("server exited with error")
	}
}
