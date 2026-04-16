package main

import (
	"github.com/go-chi/chi/v5"

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
	"github.com/mmp-platform/server/internal/domain/voice"
)

// authedDeps groups handlers used by the authenticated route subtree.
type authedDeps struct {
	auth         *auth.Handler
	profile      *profile.Handler
	voice        *voice.Handler
	room         *room.Handler
	payment      *payment.Handler
	coin         *coin.Handler
	social       *social.Handler
	creator      *creator.Handler
	creatorAdmin *creator.AdminHandler
	editor       *editor.Handler
	flow         *flow.Handler
	media        *editor.MediaHandler
	image        *editor.ImageHandler
	reading      *editor.ReadingHandler
	admin        *admin.Handler
	review       *admin.ReviewHandler
}

// registerAuthedRoutes wires all routes that require JWT authentication by
// delegating to per-domain registrars. Keep this function thin: each
// sub-registrar owns its own URL subtree and role guards.
//
// Note: chi panics when the same path (e.g. /editor) is mounted twice via
// r.Route, so the /editor subrouter is created exactly once here and passed
// to each editor-domain registrar.
func registerAuthedRoutes(r chi.Router, deps authedDeps) {
	registerBaseRoutes(r, deps)
	registerSocialRoutes(r, deps)

	r.Route("/editor", func(er chi.Router) {
		registerEditorThemeRoutes(er, deps)
		registerEditorMediaRoutes(er, deps)
		registerEditorFlowRoutes(er, deps)
	})

	registerAdminRoutes(r, deps)
}

// registerBaseRoutes wires auth/profile/voice/room/payment/coin endpoints —
// the non-domain-specific surface for any authenticated user.
func registerBaseRoutes(r chi.Router, deps authedDeps) {
	// Auth
	r.Post("/auth/logout", deps.auth.HandleLogout)
	r.Get("/auth/me", deps.auth.HandleMe)
	r.Delete("/auth/account", deps.auth.HandleDeleteAccount)

	// Profile
	r.Get("/profile", deps.profile.GetProfile)
	r.Put("/profile", deps.profile.UpdateProfile)
	r.Put("/profile/avatar", deps.profile.UpdateAvatar)
	r.Get("/profile/notifications", deps.profile.GetNotificationPrefs)
	r.Put("/profile/notifications", deps.profile.UpdateNotificationPrefs)

	// Voice
	r.Post("/voice/token", deps.voice.GetToken)

	// Rooms
	r.Post("/rooms", deps.room.CreateRoom)
	r.Post("/rooms/{id}/join", deps.room.JoinRoom)
	r.Post("/rooms/{id}/leave", deps.room.LeaveRoom)
	r.Post("/rooms/{id}/start", deps.room.StartRoom)

	// Payment endpoints (authed)
	r.Route("/payments", func(r chi.Router) {
		r.Post("/create", deps.payment.CreatePayment)
		r.Post("/confirm", deps.payment.ConfirmPayment)
		r.Get("/history", deps.payment.GetPaymentHistory)
	})

	// Coin endpoints
	r.Route("/coins", func(r chi.Router) {
		r.Get("/balance", deps.coin.GetBalance)
		r.Get("/transactions", deps.coin.ListTransactions)
		r.Post("/purchase-theme", deps.coin.PurchaseTheme)
		r.Post("/refund-theme", deps.coin.RefundTheme)
		r.Get("/purchased-themes", deps.coin.ListPurchasedThemes)
	})
}
