package main

import (
	"github.com/go-chi/chi/v5"

	"github.com/mmp-platform/server/internal/middleware"
)

// registerAdminRoutes wires /admin endpoints gated by ADMIN role:
// user/theme/room administration, the review workflow, settlement and
// revenue management, coin grants, and package management.
func registerAdminRoutes(r chi.Router, deps authedDeps) {
	r.Route("/admin", func(r chi.Router) {
		r.Use(middleware.RequireRole("ADMIN"))

		// User & theme & room administration
		r.Get("/users", deps.admin.ListUsers)
		r.Get("/users/{id}", deps.admin.GetUser)
		r.Put("/users/{id}/role", deps.admin.UpdateUserRole)
		r.Put("/users/{id}/trusted-creator", deps.review.SetTrustedCreator)
		r.Get("/themes", deps.admin.ListAllThemes)
		r.Post("/themes/{id}/unpublish", deps.admin.ForceUnpublishTheme)
		r.Get("/rooms", deps.admin.ListAllRooms)
		r.Post("/rooms/{id}/close", deps.admin.ForceCloseRoom)

		// Review workflow
		r.Get("/reviews", deps.review.ListPendingReviews)
		r.Post("/reviews/{id}/approve", deps.review.ApproveTheme)
		r.Post("/reviews/{id}/reject", deps.review.RejectTheme)
		r.Post("/reviews/{id}/suspend", deps.review.SuspendTheme)

		// Settlement & revenue
		r.Get("/settlements", deps.creatorAdmin.ListAllSettlements)
		r.Patch("/settlements/{id}/approve", deps.creatorAdmin.ApproveSettlement)
		r.Patch("/settlements/{id}/payout", deps.creatorAdmin.PayoutSettlement)
		r.Patch("/settlements/{id}/cancel", deps.creatorAdmin.CancelSettlement)
		r.Get("/revenue", deps.creatorAdmin.GetRevenue)

		// Coin management
		r.Post("/coins/grant", deps.creatorAdmin.GrantCoins)

		// Package management
		r.Post("/packages", deps.creatorAdmin.CreatePackage)
		r.Patch("/packages/{id}", deps.creatorAdmin.UpdatePackage)

		// Settlement batch
		r.Post("/settlements/run", deps.creatorAdmin.RunSettlement)
	})
}
