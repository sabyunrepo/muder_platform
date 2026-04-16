package main

import (
	"github.com/go-chi/chi/v5"

	"github.com/mmp-platform/server/internal/domain/auth"
	"github.com/mmp-platform/server/internal/domain/payment"
	"github.com/mmp-platform/server/internal/domain/profile"
	"github.com/mmp-platform/server/internal/domain/room"
	"github.com/mmp-platform/server/internal/domain/theme"
	"github.com/mmp-platform/server/internal/server"
)

// publicDeps groups handlers used by the public (unauthenticated) route subtree.
type publicDeps struct {
	auth     *auth.Handler
	theme    *theme.Handler
	template *server.TemplateHandler
	room     *room.Handler
	profile  *profile.Handler
	payment  *payment.Handler
}

// registerPublicRoutes wires all routes that do not require JWT auth.
func registerPublicRoutes(r chi.Router, deps publicDeps) {
	r.Post("/auth/callback", deps.auth.HandleCallback)
	r.Post("/auth/register", deps.auth.HandleRegister)
	r.Post("/auth/login", deps.auth.HandleLogin)
	r.Post("/auth/refresh", deps.auth.HandleRefresh)

	r.Get("/themes", deps.theme.ListPublished)
	r.Get("/themes/{id}", deps.theme.GetTheme)
	r.Get("/themes/slug/{slug}", deps.theme.GetThemeBySlug)
	r.Get("/themes/{id}/characters", deps.theme.GetCharacters)

	// Preset templates (Phase 18.4 W0 PR-1)
	r.Get("/templates", deps.template.ListTemplates)
	r.Get("/templates/{id}", deps.template.GetTemplate)
	r.Get("/templates/{id}/schema", deps.template.GetTemplateSchema)

	r.Get("/rooms", deps.room.ListWaitingRooms)
	r.Get("/rooms/{id}", deps.room.GetRoom)
	r.Get("/rooms/code/{code}", deps.room.GetRoomByCode)

	r.Get("/users/{id}", deps.profile.GetPublicProfile)

	// Payment (public — no JWT required) [S2]
	r.Get("/payments/packages", deps.payment.ListPackages)
	r.Post("/payments/webhook", deps.payment.HandleWebhook)
}
