package main

import (
	"context"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/config"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/domain/admin"
	"github.com/mmp-platform/server/internal/domain/auth"
	"github.com/mmp-platform/server/internal/domain/editor"
	"github.com/mmp-platform/server/internal/domain/profile"
	"github.com/mmp-platform/server/internal/domain/room"
	"github.com/mmp-platform/server/internal/domain/theme"
	"github.com/mmp-platform/server/internal/health"
	"github.com/mmp-platform/server/internal/infra/cache"
	"github.com/mmp-platform/server/internal/infra/lock"
	otelPkg "github.com/mmp-platform/server/internal/infra/otel"
	"github.com/mmp-platform/server/internal/infra/postgres"
	sentryPkg "github.com/mmp-platform/server/internal/infra/sentry"
	"github.com/mmp-platform/server/internal/middleware"
	"github.com/mmp-platform/server/internal/seo"
	"github.com/mmp-platform/server/internal/server"
	"github.com/mmp-platform/server/internal/ws"
)

func main() {
	// 1. Config
	cfg, err := config.Load()
	if err != nil {
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

	// 2.5. Dev mode for error responses
	apperror.SetDevMode(cfg.IsDevelopment())

	// 2.6. OTel LogHook (injects trace_id/span_id into log events)
	logger = logger.Hook(otelPkg.LogHook{})

	// 2.7. Sentry
	sentryCleanup, err := sentryPkg.Init(sentryPkg.Config{
		DSN:         cfg.SentryDSN,
		Environment: cfg.Env,
		Release:     cfg.AppVersion,
		Debug:       cfg.IsDevelopment(),
	})
	if err != nil {
		logger.Warn().Err(err).Msg("sentry init failed, continuing without sentry")
	} else {
		defer sentryCleanup()
	}

	// 2.8. OpenTelemetry
	otelCleanup, err := otelPkg.Init(context.Background(), otelPkg.Config{
		Endpoint:    cfg.OTelEndpoint,
		ServiceName: "mmp-server",
		Version:     cfg.AppVersion,
		Environment: cfg.Env,
		Insecure:    cfg.IsDevelopment(),
		SampleRate:  0.1,
	})
	if err != nil {
		logger.Warn().Err(err).Msg("otel init failed, continuing without tracing")
	} else {
		defer otelCleanup(context.Background())
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
	_ = locker // used in later phases

	// 5. sqlc Queries
	queries := db.New(pool)

	// 6. Domain Services
	authSvc := auth.NewService(queries, redisCache.Client(), []byte(cfg.JWTSecret), logger)
	profileSvc := profile.NewService(queries, logger)
	roomSvc := room.NewService(pool, queries, logger)
	themeSvc := theme.NewService(queries, logger)
	editorSvc := editor.NewService(queries, logger)
	adminSvc := admin.NewService(queries, logger)

	// 7. Domain Handlers
	authHandler := auth.NewHandler(authSvc)
	profileHandler := profile.NewHandler(profileSvc)
	roomHandler := room.NewHandler(roomSvc)
	themeHandler := theme.NewHandler(themeSvc)
	editorHandler := editor.NewHandler(editorSvc)
	adminHandler := admin.NewHandler(adminSvc)

	// 8. WebSocket Hub
	wsRouter := ws.NewRouter(logger)
	wsHub := ws.NewHub(wsRouter, ws.NoopPubSub{}, logger)
	defer wsHub.Stop()
	logger.Info().Msg("websocket hub started")

	// 9. HTTP Router
	r := chi.NewRouter()

	// 10. Global Middleware (order matters: outermost first)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger(logger))
	r.Use(sentryPkg.Middleware) // Sentry hub before Recovery so panics are captured
	r.Use(middleware.Recovery)
	r.Use(middleware.CORS(cfg.IsDevelopment(), cfg.CORSOrigins))

	// 11. Health endpoints
	healthHandler := health.NewHandler(
		pool.Ping,
		func(ctx context.Context) error { return redisCache.Ping(ctx) },
	)
	r.Get("/health", healthHandler.Health)
	r.Get("/ready", healthHandler.Ready)

	// 12. SEO pages
	seoHandler := seo.NewHandler(cfg.BaseURL, logger)
	seoHandler.RegisterRoutes(r)

	// 13. WebSocket endpoints
	wsCfg := ws.UpgradeConfig{
		AllowedOrigins: cfg.CORSOrigins,
		DevMode:        cfg.IsDevelopment(),
	}
	gameUpgrade := ws.UpgradeHandler(wsHub, ws.DefaultPlayerIDExtractor, wsCfg, logger)
	r.Get("/ws/game", gameUpgrade)
	r.Get("/ws/social", gameUpgrade)

	// 14. JWT auth config
	jwtCfg := middleware.JWTConfig{Secret: []byte(cfg.JWTSecret)}

	// 15. REST API v1
	r.Route("/api/v1", func(r chi.Router) {
		// --- Public endpoints ---
		r.Post("/auth/callback", authHandler.HandleCallback)
		r.Post("/auth/refresh", authHandler.HandleRefresh)

		r.Get("/themes", themeHandler.ListPublished)
		r.Get("/themes/{id}", themeHandler.GetTheme)
		r.Get("/themes/slug/{slug}", themeHandler.GetThemeBySlug)
		r.Get("/themes/{id}/characters", themeHandler.GetCharacters)

		r.Get("/rooms", roomHandler.ListWaitingRooms)
		r.Get("/rooms/{id}", roomHandler.GetRoom)
		r.Get("/rooms/code/{code}", roomHandler.GetRoomByCode)

		r.Get("/users/{id}", profileHandler.GetPublicProfile)

		// --- Authenticated endpoints ---
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(jwtCfg))

			// Auth
			r.Post("/auth/logout", authHandler.HandleLogout)
			r.Get("/auth/me", authHandler.HandleMe)

			// Profile
			r.Get("/profile", profileHandler.GetProfile)
			r.Put("/profile", profileHandler.UpdateProfile)

			// Rooms
			r.Post("/rooms", roomHandler.CreateRoom)
			r.Post("/rooms/{id}/join", roomHandler.JoinRoom)
			r.Post("/rooms/{id}/leave", roomHandler.LeaveRoom)

			// --- Creator endpoints (CREATOR, ADMIN) ---
			r.Route("/editor", func(r chi.Router) {
				r.Use(middleware.RequireRole("CREATOR", "ADMIN"))

				r.Get("/themes", editorHandler.ListMyThemes)
				r.Post("/themes", editorHandler.CreateTheme)
				r.Put("/themes/{id}", editorHandler.UpdateTheme)
				r.Delete("/themes/{id}", editorHandler.DeleteTheme)
				r.Post("/themes/{id}/publish", editorHandler.PublishTheme)
				r.Post("/themes/{id}/unpublish", editorHandler.UnpublishTheme)
				r.Post("/themes/{id}/characters", editorHandler.CreateCharacter)
				r.Put("/characters/{id}", editorHandler.UpdateCharacter)
				r.Delete("/characters/{id}", editorHandler.DeleteCharacter)
				r.Put("/themes/{id}/config", editorHandler.UpdateConfigJson)
			})

			// --- Admin endpoints (ADMIN only) ---
			r.Route("/admin", func(r chi.Router) {
				r.Use(middleware.RequireRole("ADMIN"))

				r.Get("/users", adminHandler.ListUsers)
				r.Get("/users/{id}", adminHandler.GetUser)
				r.Put("/users/{id}/role", adminHandler.UpdateUserRole)
				r.Get("/themes", adminHandler.ListAllThemes)
				r.Post("/themes/{id}/unpublish", adminHandler.ForceUnpublishTheme)
				r.Get("/rooms", adminHandler.ListAllRooms)
				r.Post("/rooms/{id}/close", adminHandler.ForceCloseRoom)
			})
		})
	})

	// 16. Server start + graceful shutdown
	srv := server.New(cfg.Port, r, logger)
	if err := srv.Start(); err != nil {
		logger.Fatal().Err(err).Msg("server exited with error")
	}
}
