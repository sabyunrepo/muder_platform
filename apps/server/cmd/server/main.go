package main

import (
	"context"
	"os"
	"time"

	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/config"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/domain/admin"
	"github.com/mmp-platform/server/internal/domain/auth"
	"github.com/mmp-platform/server/internal/domain/coin"
	"github.com/mmp-platform/server/internal/domain/creator"
	"github.com/mmp-platform/server/internal/domain/editor"
	"github.com/mmp-platform/server/internal/domain/flow"
	"github.com/mmp-platform/server/internal/domain/payment"
	"github.com/mmp-platform/server/internal/domain/profile"
	"github.com/mmp-platform/server/internal/domain/room"
	"github.com/mmp-platform/server/internal/domain/social"
	"github.com/mmp-platform/server/internal/domain/sound"
	"github.com/mmp-platform/server/internal/domain/theme"
	"github.com/mmp-platform/server/internal/domain/voice"
	"github.com/mmp-platform/server/internal/eventbus"
	"github.com/mmp-platform/server/internal/health"
	"github.com/mmp-platform/server/internal/infra/cache"
	"github.com/mmp-platform/server/internal/infra/lock"
	otelPkg "github.com/mmp-platform/server/internal/infra/otel"
	"github.com/mmp-platform/server/internal/infra/postgres"
	"github.com/mmp-platform/server/internal/infra/storage"
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

	// 6. EventBus
	bus := eventbus.New(logger)

	// 7. Domain Services
	authSvc := auth.NewService(queries, redisCache.Client(), []byte(cfg.JWTSecret), logger)
	profileSvc := profile.NewService(queries, logger)
	roomSvc := room.NewService(pool, queries, logger)
	themeSvc := theme.NewService(queries, logger)
	editorSvc := editor.NewService(queries, pool, logger)
	flowSvc := flow.NewService(pool, logger)
	flowHandler := flow.NewHandler(flowSvc)

	// Phase 7.7: Media storage provider
	// R2 credentials present → use R2. Otherwise fall back to local file storage for dev.
	var storageProvider storage.Provider
	var localStorageProvider *storage.LocalProvider
	if cfg.R2AccountID != "" {
		r2Cfg := storage.R2Config{
			AccountID:       cfg.R2AccountID,
			AccessKeyID:     cfg.R2AccessKeyID,
			SecretAccessKey: cfg.R2SecretAccessKey,
			BucketName:      cfg.R2BucketName,
			PublicURL:       cfg.R2PublicURL,
		}
		var err error
		storageProvider, err = storage.NewR2Provider(r2Cfg, logger)
		if err != nil {
			logger.Fatal().Err(err).Msg("failed to init R2 provider")
		}
		logger.Info().Msg("R2 storage provider initialized")
	} else {
		localStorageProvider = storage.NewLocalProviderWithLogger("tmp/uploads", cfg.ServerBaseURL(), logger)
		storageProvider = localStorageProvider
		logger.Warn().Msg("local file storage provider initialized (dev only — do not use in production)")
	}
	mediaSvc := editor.NewMediaService(queries, storageProvider, logger)
	mediaHandler := editor.NewMediaHandler(mediaSvc)
	imageSvc := editor.NewImageService(queries, storageProvider, logger)
	imageHandler := editor.NewImageHandler(imageSvc)
	readingSvc := editor.NewReadingService(queries, logger)
	readingHandler := editor.NewReadingHandler(readingSvc)
	adminSvc := admin.NewService(queries, logger)
	friendSvc := social.NewFriendService(queries, logger)
	chatSvc := social.NewChatService(pool, queries, logger)

	// Payment provider
	paymentProvider, err := payment.NewPaymentProvider("mock", cfg.IsDevelopment())
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to create payment provider")
	}
	paymentSvc := payment.NewService(queries, paymentProvider, "mock", bus, logger)

	// Coin
	coinSvc := coin.NewService(pool, queries, bus, logger)

	// Voice
	var voiceProvider voice.VoiceProvider
	if cfg.HasLiveKit() {
		voiceProvider = voice.NewLiveKitProvider(cfg.LiveKitURL, cfg.LiveKitAPIKey, cfg.LiveKitAPISecret)
		logger.Info().Msg("livekit voice provider initialized")
	} else {
		voiceProvider = voice.NewMockProvider(logger)
		logger.Info().Msg("mock voice provider initialized (no livekit config)")
	}
	voiceSvc := voice.NewService(voiceProvider, queries, cfg.LiveKitURL, logger)
	voiceHandler := voice.NewHandler(voiceSvc)

	// Creator + Settlement
	creatorSvc := creator.NewService(queries, logger)
	settlementPipeline := creator.NewSettlementPipeline(queries, pool, redisCache.Client(), logger)

	// 8. EventBus subscriptions
	bus.Subscribe(eventbus.TypePaymentConfirmed, coinSvc.HandlePaymentConfirmed)
	bus.Subscribe(eventbus.TypeThemePurchased, creatorSvc.HandleThemePurchased)
	bus.Subscribe(eventbus.TypeThemeRefunded, creatorSvc.HandleThemeRefunded)
	bus.Subscribe(eventbus.TypeGameStarted, coinSvc.HandleGameStarted)

	// 9. Domain Handlers
	authHandler := auth.NewHandler(authSvc)
	profileHandler := profile.NewHandler(profileSvc)
	roomHandler := room.NewHandler(roomSvc)
	themeHandler := theme.NewHandler(themeSvc)
	editorHandler := editor.NewHandler(editorSvc)
	adminHandler := admin.NewHandler(adminSvc)
	socialHandler := social.NewHandler(friendSvc, chatSvc)
	paymentHandler := payment.NewHandler(paymentSvc, paymentProvider)
	coinHandler := coin.NewHandler(coinSvc)
	creatorHandler := creator.NewHandler(creatorSvc)
	creatorAdminHandler := creator.NewAdminHandler(queries, pool, settlementPipeline, logger)
	reviewHandler := admin.NewReviewHandler(queries, logger)

	// 10. WebSocket Hub (Game)
	wsRouter := ws.NewRouter(logger)
	wsHub := ws.NewHub(wsRouter, ws.NoopPubSub{}, logger)
	defer wsHub.Stop()
	logger.Info().Msg("game websocket hub started")

	// 10.1. Sound WS Handler
	soundWSHandler := sound.NewWSHandler(wsHub, logger)
	wsRouter.Handle("sound", soundWSHandler.Handle)

	// 10.2. Social WebSocket Hub (separate from game)
	socialRouter := ws.NewRouter(logger)
	socialHub := ws.NewSocialHub(socialRouter, logger)
	defer socialHub.Stop()
	logger.Info().Msg("social websocket hub started")

	// 10.3. Social WS Handler + Presence
	presenceProvider := social.NewPresenceProvider(redisCache.Client())
	socialWSHandler := social.NewSocialWSHandler(socialHub, chatSvc, friendSvc, presenceProvider, queries, logger)
	socialRouter.Handle("chat", socialWSHandler.HandleChat)
	socialRouter.Handle("friend", socialWSHandler.HandleFriend)
	socialRouter.Handle("presence", socialWSHandler.HandlePresence)

	// 11. HTTP Router
	r := chi.NewRouter()

	// 12. Global Middleware (order matters: outermost first)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger(logger))
	r.Use(sentryPkg.Middleware) // Sentry hub before Recovery so panics are captured
	r.Use(middleware.Recovery)
	r.Use(middleware.CORS(cfg.IsDevelopment(), cfg.CORSOrigins))

	// 13. Health endpoints
	healthHandler := health.NewHandler(
		pool.Ping,
		func(ctx context.Context) error { return redisCache.Ping(ctx) },
	)
	r.Get("/health", healthHandler.Health)
	r.Get("/ready", healthHandler.Ready)

	// 14. SEO pages
	seoHandler := seo.NewHandler(cfg.BaseURL, logger)
	seoHandler.RegisterRoutes(r)

	// 14.5. Static file serving (avatars)
	{
		fs := http.StripPrefix("/uploads/", http.FileServer(http.Dir("uploads")))
		r.Handle("/uploads/*", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			fs.ServeHTTP(w, r)
		}))
	}

	// 14.6. Local storage upload/serve endpoints (dev only — skipped when R2 is active)
	if localStorageProvider != nil {
		r.Put("/api/v1/uploads/*", localStorageProvider.UploadHandler())
		r.Get("/api/v1/uploads/*", localStorageProvider.ServeHandler())
	}

	// 15. WebSocket endpoints
	wsCfg := ws.UpgradeConfig{
		AllowedOrigins: cfg.CORSOrigins,
		DevMode:        cfg.IsDevelopment(),
	}
	gameUpgrade := ws.UpgradeHandler(wsHub, ws.DefaultPlayerIDExtractor, wsCfg, logger)
	r.Get("/ws/game", gameUpgrade)

	socialExtractor := ws.JWTPlayerIDExtractor([]byte(cfg.JWTSecret))
	socialUpgrade := ws.UpgradeHandler(socialHub, socialExtractor, wsCfg, logger)
	r.Get("/ws/social", socialUpgrade)

	// 16. JWT auth config
	jwtCfg := middleware.JWTConfig{Secret: []byte(cfg.JWTSecret)}

	// 17. REST API v1
	r.Route("/api/v1", func(r chi.Router) {
		// --- Public endpoints ---
		r.Post("/auth/callback", authHandler.HandleCallback)
		r.Post("/auth/register", authHandler.HandleRegister)
		r.Post("/auth/login", authHandler.HandleLogin)
		r.Post("/auth/refresh", authHandler.HandleRefresh)

		r.Get("/themes", themeHandler.ListPublished)
		r.Get("/themes/{id}", themeHandler.GetTheme)
		r.Get("/themes/slug/{slug}", themeHandler.GetThemeBySlug)
		r.Get("/themes/{id}/characters", themeHandler.GetCharacters)

		r.Get("/rooms", roomHandler.ListWaitingRooms)
		r.Get("/rooms/{id}", roomHandler.GetRoom)
		r.Get("/rooms/code/{code}", roomHandler.GetRoomByCode)

		r.Get("/users/{id}", profileHandler.GetPublicProfile)

		// Payment (public — no JWT required) [S2]
		r.Get("/payments/packages", paymentHandler.ListPackages)
		r.Post("/payments/webhook", paymentHandler.HandleWebhook)

		// --- Authenticated endpoints ---
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(jwtCfg))

			// Auth
			r.Post("/auth/logout", authHandler.HandleLogout)
			r.Get("/auth/me", authHandler.HandleMe)
			r.Delete("/auth/account", authHandler.HandleDeleteAccount)

			// Profile
			r.Get("/profile", profileHandler.GetProfile)
			r.Put("/profile", profileHandler.UpdateProfile)
				r.Put("/profile/avatar", profileHandler.UpdateAvatar)
			r.Get("/profile/notifications", profileHandler.GetNotificationPrefs)
			r.Put("/profile/notifications", profileHandler.UpdateNotificationPrefs)

			// Voice
			r.Post("/voice/token", voiceHandler.GetToken)

			// Rooms
			r.Post("/rooms", roomHandler.CreateRoom)
			r.Post("/rooms/{id}/join", roomHandler.JoinRoom)
			r.Post("/rooms/{id}/leave", roomHandler.LeaveRoom)

			// --- Payment endpoints (authed) ---
			r.Route("/payments", func(r chi.Router) {
				r.Post("/create", paymentHandler.CreatePayment)
				r.Post("/confirm", paymentHandler.ConfirmPayment)
				r.Get("/history", paymentHandler.GetPaymentHistory)
			})

			// --- Coin endpoints ---
			r.Route("/coins", func(r chi.Router) {
				r.Get("/balance", coinHandler.GetBalance)
				r.Get("/transactions", coinHandler.ListTransactions)
				r.Post("/purchase-theme", coinHandler.PurchaseTheme)
				r.Post("/refund-theme", coinHandler.RefundTheme)
				r.Get("/purchased-themes", coinHandler.ListPurchasedThemes)
			})

			// --- Social endpoints ---
			r.Route("/social", func(r chi.Router) {
				// Friends
				r.Post("/friends/request", socialHandler.SendFriendRequest)
				r.Post("/friends/{id}/accept", socialHandler.AcceptFriendRequest)
				r.Post("/friends/{id}/reject", socialHandler.RejectFriendRequest)
				r.Delete("/friends/{id}", socialHandler.RemoveFriend)
				r.Get("/friends", socialHandler.ListFriends)
				r.Get("/friends/pending", socialHandler.ListPendingRequests)

				// Blocks
				r.Post("/blocks", socialHandler.BlockUser)
				r.Delete("/blocks/{id}", socialHandler.UnblockUser)
				r.Get("/blocks", socialHandler.ListBlocks)

				// Chat
				r.Post("/chat/dm", socialHandler.GetOrCreateDMRoom)
				r.Post("/chat/group", socialHandler.CreateGroupRoom)
				r.Get("/chat/rooms", socialHandler.ListMyRooms)
				r.Get("/chat/rooms/{id}/members", socialHandler.GetRoomMembers)
				r.Post("/chat/rooms/{id}/messages", socialHandler.SendMessage)
				r.Get("/chat/rooms/{id}/messages", socialHandler.ListMessages)
				r.Post("/chat/rooms/{id}/read", socialHandler.MarkAsRead)
			})

			// --- Creator endpoints (CREATOR, ADMIN) ---
			r.Route("/creator", func(r chi.Router) {
				r.Use(middleware.RequireRole("CREATOR", "ADMIN"))

				r.Get("/dashboard", creatorHandler.GetDashboard)
				r.Get("/themes/{id}/stats", creatorHandler.GetThemeStats)
				r.Get("/earnings", creatorHandler.ListEarnings)
				r.Get("/settlements", creatorHandler.ListSettlements)
			})

			// --- Editor endpoints (any authenticated user) ---
			r.Route("/editor", func(r chi.Router) {
				r.Get("/themes", editorHandler.ListMyThemes)
				r.Get("/themes/{id}", editorHandler.GetTheme)
				r.Post("/themes", editorHandler.CreateTheme)
				r.Put("/themes/{id}", editorHandler.UpdateTheme)
				r.Delete("/themes/{id}", editorHandler.DeleteTheme)
				r.Post("/themes/{id}/unpublish", editorHandler.UnpublishTheme)
				r.Post("/themes/{id}/submit-review", editorHandler.SubmitForReview)
				r.Get("/themes/{id}/characters", editorHandler.ListCharacters)
				r.Post("/themes/{id}/characters", editorHandler.CreateCharacter)
				r.Put("/characters/{id}", editorHandler.UpdateCharacter)
				r.Delete("/characters/{id}", editorHandler.DeleteCharacter)
				r.Put("/themes/{id}/config", editorHandler.UpdateConfigJson)
				// Maps
				r.Get("/themes/{id}/maps", editorHandler.ListMaps)
				r.Post("/themes/{id}/maps", editorHandler.CreateMap)
				r.Put("/maps/{id}", editorHandler.UpdateMap)
				r.Delete("/maps/{id}", editorHandler.DeleteMap)
				// Locations
				r.Get("/themes/{id}/locations", editorHandler.ListLocations)
				r.Post("/themes/{id}/maps/{mapId}/locations", editorHandler.CreateLocation)
				r.Put("/locations/{id}", editorHandler.UpdateLocation)
				r.Delete("/locations/{id}", editorHandler.DeleteLocation)
				// Clues
				r.Get("/themes/{id}/clues", editorHandler.ListClues)
				r.Post("/themes/{id}/clues", editorHandler.CreateClue)
				r.Put("/clues/{id}", editorHandler.UpdateClue)
				r.Delete("/clues/{id}", editorHandler.DeleteClue)
				// Clue relations
				r.Get("/themes/{id}/clue-relations", editorHandler.GetClueRelations)
				r.Put("/themes/{id}/clue-relations", editorHandler.ReplaceClueRelations)
				// Contents
				r.Get("/themes/{id}/content/{key}", editorHandler.GetContent)
				r.Put("/themes/{id}/content/{key}", editorHandler.UpsertContent)
				// Media
				r.Get("/themes/{id}/media", mediaHandler.ListMedia)
				r.Post("/themes/{id}/media/upload-url", mediaHandler.RequestUpload)
				r.Post("/themes/{id}/media/confirm", mediaHandler.ConfirmUpload)
				r.Post("/themes/{id}/media/youtube", mediaHandler.CreateYouTube)
				r.Patch("/media/{id}", mediaHandler.UpdateMedia)
				r.Delete("/media/{id}", mediaHandler.DeleteMedia)
				// Images (character avatars + clue images)
				r.Post("/themes/{id}/images/upload-url", imageHandler.RequestUpload)
				r.Post("/themes/{id}/images/confirm", imageHandler.ConfirmUpload)

				// Reading sections
				r.Get("/themes/{id}/reading-sections", readingHandler.ListReadingSections)
				r.Post("/themes/{id}/reading-sections", readingHandler.CreateReadingSection)
				r.Patch("/reading-sections/{id}", readingHandler.UpdateReadingSection)
				r.Delete("/reading-sections/{id}", readingHandler.DeleteReadingSection)
				// Validation
				r.Post("/themes/{id}/validate", editorHandler.ValidateTheme)
				// Module schemas
				r.Get("/module-schemas", editorHandler.GetModuleSchemas)
				// Flow (game flow canvas)
				r.Get("/themes/{id}/flow", flowHandler.GetFlow)
				r.Put("/themes/{id}/flow", flowHandler.SaveFlow)
				r.Post("/themes/{id}/flow/nodes", flowHandler.CreateNode)
				r.Patch("/themes/{id}/flow/nodes/{nodeId}", flowHandler.UpdateNode)
				r.Delete("/themes/{id}/flow/nodes/{nodeId}", flowHandler.DeleteNode)
				r.Post("/themes/{id}/flow/edges", flowHandler.CreateEdge)
				r.Patch("/themes/{id}/flow/edges/{edgeId}", flowHandler.UpdateEdge)
				r.Delete("/themes/{id}/flow/edges/{edgeId}", flowHandler.DeleteEdge)
				r.Post("/themes/{id}/flow/migrate", flowHandler.MigrateFlow)
			})

			// --- Admin endpoints (ADMIN only) ---
			r.Route("/admin", func(r chi.Router) {
				r.Use(middleware.RequireRole("ADMIN"))

				r.Get("/users", adminHandler.ListUsers)
				r.Get("/users/{id}", adminHandler.GetUser)
				r.Put("/users/{id}/role", adminHandler.UpdateUserRole)
				r.Put("/users/{id}/trusted-creator", reviewHandler.SetTrustedCreator)
				r.Get("/themes", adminHandler.ListAllThemes)
				r.Post("/themes/{id}/unpublish", adminHandler.ForceUnpublishTheme)
				r.Get("/rooms", adminHandler.ListAllRooms)
				r.Post("/rooms/{id}/close", adminHandler.ForceCloseRoom)

				// Review workflow
				r.Get("/reviews", reviewHandler.ListPendingReviews)
				r.Post("/reviews/{id}/approve", reviewHandler.ApproveTheme)
				r.Post("/reviews/{id}/reject", reviewHandler.RejectTheme)
				r.Post("/reviews/{id}/suspend", reviewHandler.SuspendTheme)

				// Settlement & revenue
				r.Get("/settlements", creatorAdminHandler.ListAllSettlements)
				r.Patch("/settlements/{id}/approve", creatorAdminHandler.ApproveSettlement)
				r.Patch("/settlements/{id}/payout", creatorAdminHandler.PayoutSettlement)
				r.Patch("/settlements/{id}/cancel", creatorAdminHandler.CancelSettlement)
				r.Get("/revenue", creatorAdminHandler.GetRevenue)

				// Coin management
				r.Post("/coins/grant", creatorAdminHandler.GrantCoins)

				// Package management
				r.Post("/packages", creatorAdminHandler.CreatePackage)
				r.Patch("/packages/{id}", creatorAdminHandler.UpdatePackage)

				// Settlement batch
				r.Post("/settlements/run", creatorAdminHandler.RunSettlement)
			})
		})
	})

	// 18. Server start + graceful shutdown
	srv := server.New(cfg.Port, r, logger)
	if err := srv.Start(); err != nil {
		logger.Fatal().Err(err).Msg("server exited with error")
	}
}
