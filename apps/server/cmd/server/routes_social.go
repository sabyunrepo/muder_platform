package main

import (
	"github.com/go-chi/chi/v5"

	"github.com/mmp-platform/server/internal/middleware"
)

// registerSocialRoutes wires /social (friends, blocks, chat) and /creator
// (role-gated) endpoints.
func registerSocialRoutes(r chi.Router, deps authedDeps) {
	// Social endpoints
	r.Route("/social", func(r chi.Router) {
		// Friends
		r.Post("/friends/request", deps.social.SendFriendRequest)
		r.Post("/friends/{id}/accept", deps.social.AcceptFriendRequest)
		r.Post("/friends/{id}/reject", deps.social.RejectFriendRequest)
		r.Delete("/friends/{id}", deps.social.RemoveFriend)
		r.Get("/friends", deps.social.ListFriends)
		r.Get("/friends/pending", deps.social.ListPendingRequests)

		// Blocks
		r.Post("/blocks", deps.social.BlockUser)
		r.Delete("/blocks/{id}", deps.social.UnblockUser)
		r.Get("/blocks", deps.social.ListBlocks)

		// Chat
		r.Post("/chat/dm", deps.social.GetOrCreateDMRoom)
		r.Post("/chat/group", deps.social.CreateGroupRoom)
		r.Get("/chat/rooms", deps.social.ListMyRooms)
		r.Get("/chat/rooms/{id}/members", deps.social.GetRoomMembers)
		r.Post("/chat/rooms/{id}/messages", deps.social.SendMessage)
		r.Get("/chat/rooms/{id}/messages", deps.social.ListMessages)
		r.Post("/chat/rooms/{id}/read", deps.social.MarkAsRead)
	})

	// Creator endpoints (CREATOR, ADMIN)
	r.Route("/creator", func(r chi.Router) {
		r.Use(middleware.RequireRole("CREATOR", "ADMIN"))

		r.Get("/dashboard", deps.creator.GetDashboard)
		r.Get("/themes/{id}/stats", deps.creator.GetThemeStats)
		r.Get("/earnings", deps.creator.ListEarnings)
		r.Get("/settlements", deps.creator.ListSettlements)
	})
}
