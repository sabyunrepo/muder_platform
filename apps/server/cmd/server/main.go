package main

import (
	"context"
	"os"
	"time"

	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/auditlog"
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
	sentryPkg "github.com/mmp-platform/server/internal/infra/sentry"
	"github.com/mmp-platform/server/internal/infra/storage"
	"github.com/mmp-platform/server/internal/middleware"
	"github.com/mmp-platform/server/internal/seo"
	"github.com/mmp-platform/server/internal/server"
	"github.com/mmp-platform/server/internal/session"
	"github.com/mmp-platform/server/internal/template"
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
		defer otelCleanup(context.Background()) //nolint:errcheck
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

	// 7. Session manager (Phase 18.1 wiring — created before Hub so we can
	// inject snapshot deps after Hub is ready).
	sessionMgr := session.NewSessionManager(logger)

	// 8. Audit log pipeline (Phase 19 PR-6 — F-sec-4).
	// DBLogger writes asynchronously; Start spawns the flush goroutine,
	// Stop drains the queue at shutdown. Services that need to record
	// identity-bound audit events accept the Logger as a dependency.
	auditStore := auditlog.NewStore(pool)
	auditLog := auditlog.NewDBLogger(auditStore, logger)
	auditLog.Start()
	defer auditLog.Stop()
	logger.Info().Msg("auditlog started")

	// 9. Domain Services
	// PR-9 wiring note: authSvc is constructed below (§11.6) once the
	// game Hub exists, because auth.NewService needs the Hub as its
	// RevokePublisher. revokeRepo is created here — its sqlc-backed
	// surface depends only on `queries` and gets injected into both
	// authSvc and the WS auth handler.
	revokeRepo := auth.NewRevokeRepo(queries)
	profileSvc := profile.NewService(queries, logger)
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
	storyInfoSvc := editor.NewStoryInfoService(queries, logger)
	storyInfoHandler := editor.NewStoryInfoHandler(storyInfoSvc, auditLog, logger)
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

	// 9. EventBus subscriptions
	bus.Subscribe(eventbus.TypePaymentConfirmed, coinSvc.HandlePaymentConfirmed)
	bus.Subscribe(eventbus.TypeThemePurchased, creatorSvc.HandleThemePurchased)
	bus.Subscribe(eventbus.TypeThemeRefunded, creatorSvc.HandleThemeRefunded)
	bus.Subscribe(eventbus.TypeGameStarted, coinSvc.HandleGameStarted)

	// 10. Domain Handlers
	// authHandler moved to §11.6 because it depends on authSvc which
	// itself depends on the game Hub publisher.
	profileHandler := profile.NewHandler(profileSvc)
	themeHandler := theme.NewHandler(themeSvc)
	editorHandler := editor.NewHandler(editorSvc, auditLog, logger)
	adminHandler := admin.NewHandler(adminSvc, auditLog, logger)
	socialHandler := social.NewHandler(friendSvc, chatSvc)
	paymentHandler := payment.NewHandler(paymentSvc, paymentProvider)
	coinHandler := coin.NewHandler(coinSvc)
	creatorHandler := creator.NewHandler(creatorSvc)
	creatorAdminHandler := creator.NewAdminHandler(queries, pool, settlementPipeline, logger)
	reviewHandler := admin.NewReviewHandler(queries, auditLog, logger)

	// Template loader + handler (Phase 18.4 W0 PR-1: expose preset templates).
	templateLoader := template.NewLoader()
	templateHandler := server.NewTemplateHandler(templateLoader)

	// 11. WebSocket Hub (Game)
	registry := ws.NewEnvelopeRegistry()
	ws.BootstrapRegistry(registry)
	wsRouter := ws.NewRouter(logger)
	wsHub := ws.NewHub(wsRouter, ws.NoopPubSub{}, logger)
	wsHub.SetRegistry(registry)
	defer wsHub.Stop()
	logger.Info().Msg("game websocket hub started")

	// 11.1. Wire session layer into Hub (Phase 18.1).
	sessionMgr.InjectSnapshot(redisCache, wsHub)
	wsHub.SetSessionSender(&managerSessionSender{mgr: sessionMgr})
	wsHub.RegisterLifecycleListener(sessionMgr)

	// 11.2. GameStarter for room service.
	broadcaster := &hubBroadcaster{hub: wsHub}
	gameStarter := session.NewGameStarter(sessionMgr, broadcaster, cfg.GameRuntimeV2, mediaSvc, logger)
	roomSvc := room.NewServiceWithStarter(pool, queries, logger, gameStarter)
	roomHandler := room.NewHandler(roomSvc)

	// 11.3. Sound WS Handler
	soundWSHandler := sound.NewWSHandler(wsHub, logger)
	wsRouter.Handle("sound", soundWSHandler.Handle)

	// 11.4. Social WebSocket Hub (separate from game)
	socialRouter := ws.NewRouter(logger)
	socialHub := ws.NewSocialHub(socialRouter, logger)
	defer socialHub.Stop()
	logger.Info().Msg("social websocket hub started")

	// 11.5. Social WS Handler + Presence
	presenceProvider := social.NewPresenceProvider(redisCache.Client())
	socialWSHandler := social.NewSocialWSHandler(socialHub, chatSvc, friendSvc, presenceProvider, queries, logger)
	socialRouter.Handle("chat", socialWSHandler.HandleChat)
	socialRouter.Handle("friend", socialWSHandler.HandleFriend)
	socialRouter.Handle("presence", socialWSHandler.HandlePresence)

	// 11.6. PR-9 WS Auth Protocol wiring.
	//
	// auth.Service depends on the game Hub as its RevokePublisher so
	// that Logout / RefreshToken family-attack paths can push close to
	// live sockets. SocialHub revoke push is left for a follow-up — the
	// game Hub covers the in-game ban path, which is the W4 acceptance
	// scenario; social-only sockets close on their next mutation when
	// the user reconnects and fails the auth.identify pull check.
	//
	// MMP_WS_AUTH_PROTOCOL gates only the *inbound* auth.* frame
	// dispatcher (AuthHandler.enabled). Server → client push (Hub.RevokeUser)
	// stays wired regardless so that flag-on staging exercises both
	// directions and a flag-off rollback still cleans up logout sockets.
	// Both wsHub and socialHub satisfy auth.RevokePublisher; combine them
	// so a single auth.Service push fans out to every live socket the
	// user owns. auth.NewCompositeRevokePublisher returns errors.Join of
	// every inner failure (rather than the first one) so a partial outage
	// in one hub is observable rather than silently masked. Adding a
	// Redis pub/sub adapter for multi-server fanout drops in here.
	revokePublisher := auth.NewCompositeRevokePublisher(wsHub, socialHub)
	authSvc := auth.NewService(queries, redisCache.Client(), []byte(cfg.JWTSecret),
		auditLog, revokeRepo, revokePublisher, logger)
	authHandler := auth.NewHandler(authSvc)
	wsAuthHandler := ws.NewAuthHandler([]byte(cfg.JWTSecret), revokeRepo, authSvc,
		cfg.WSAuthProtocol, logger)
	// Dot-form auth.* events: register each C→S sub-action explicitly
	// since Router.Route only splits on the colon. See PR-9 retro note
	// in auth_protocol.go for the form choice rationale. Both routers
	// receive the same handler so identify/resume/refresh work on game
	// and social endpoints alike.
	for _, t := range []string{ws.TypeAuthIdentify, ws.TypeAuthResume, ws.TypeAuthRefresh} {
		wsRouter.Handle(t, wsAuthHandler.Handle)
		socialRouter.Handle(t, wsAuthHandler.Handle)
	}
	logger.Info().Bool("enabled", cfg.WSAuthProtocol).
		Msg("WS auth protocol handler registered")

	// 12. HTTP Router
	r := chi.NewRouter()

	// 13. Global Middleware (order matters: outermost first)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger(logger))
	r.Use(sentryPkg.Middleware) // Sentry hub before Recovery so panics are captured
	r.Use(middleware.Recovery)
	r.Use(middleware.CORS(cfg.IsDevelopment(), cfg.CORSOrigins))

	// 14. Health endpoints
	healthHandler := health.NewHandler(
		pool.Ping,
		func(ctx context.Context) error { return redisCache.Ping(ctx) },
	)
	r.Get("/health", healthHandler.Health)
	r.Get("/ready", healthHandler.Ready)

	// 15. SEO pages
	seoHandler := seo.NewHandler(cfg.BaseURL, logger)
	seoHandler.RegisterRoutes(r)

	// 15.5. Static file serving (avatars)
	{
		fs := http.StripPrefix("/uploads/", http.FileServer(http.Dir("uploads")))
		r.Handle("/uploads/*", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			fs.ServeHTTP(w, r)
		}))
	}

	// 15.6. Local storage upload/serve endpoints (dev only — skipped when R2 is active)
	if localStorageProvider != nil {
		r.Put("/api/v1/uploads/*", localStorageProvider.UploadHandler())
		r.Get("/api/v1/uploads/*", localStorageProvider.ServeHandler())
	}

	// 16. WebSocket endpoints
	wsCfg := ws.UpgradeConfig{
		AllowedOrigins: cfg.CORSOrigins,
		DevMode:        cfg.IsDevelopment(),
	}
	gameUpgrade := ws.UpgradeHandler(wsHub, ws.DefaultPlayerIDExtractor, wsCfg, logger)
	r.Get("/ws/game", gameUpgrade)

	socialExtractor := ws.JWTPlayerIDExtractor([]byte(cfg.JWTSecret))
	socialUpgrade := ws.UpgradeHandler(socialHub, socialExtractor, wsCfg, logger)
	r.Get("/ws/social", socialUpgrade)

	// 17. JWT auth config
	jwtCfg := middleware.JWTConfig{Secret: []byte(cfg.JWTSecret)}

	// 18. REST API v1
	publicDeps := publicDeps{
		auth:     authHandler,
		theme:    themeHandler,
		template: templateHandler,
		room:     roomHandler,
		profile:  profileHandler,
		payment:  paymentHandler,
	}
	authedDeps := authedDeps{
		auth:         authHandler,
		profile:      profileHandler,
		voice:        voiceHandler,
		room:         roomHandler,
		payment:      paymentHandler,
		coin:         coinHandler,
		social:       socialHandler,
		creator:      creatorHandler,
		creatorAdmin: creatorAdminHandler,
		editor:       editorHandler,
		flow:         flowHandler,
		media:        mediaHandler,
		image:        imageHandler,
		reading:      readingHandler,
		storyInfo:    storyInfoHandler,
		admin:        adminHandler,
		review:       reviewHandler,
	}
	r.Route("/api/v1", func(r chi.Router) {
		registerPublicRoutes(r, publicDeps)

		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(jwtCfg))
			registerAuthedRoutes(r, authedDeps)
		})
	})

	// 19. Server start + graceful shutdown
	srv := server.New(cfg.Port, r, logger)
	if err := srv.Start(); err != nil {
		logger.Fatal().Err(err).Msg("server exited with error")
	}
}
