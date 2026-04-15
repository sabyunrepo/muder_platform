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
	"github.com/mmp-platform/server/internal/middleware"
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

// registerAuthedRoutes wires all routes that require JWT authentication.
func registerAuthedRoutes(r chi.Router, deps authedDeps) {
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

	// --- Payment endpoints (authed) ---
	r.Route("/payments", func(r chi.Router) {
		r.Post("/create", deps.payment.CreatePayment)
		r.Post("/confirm", deps.payment.ConfirmPayment)
		r.Get("/history", deps.payment.GetPaymentHistory)
	})

	// --- Coin endpoints ---
	r.Route("/coins", func(r chi.Router) {
		r.Get("/balance", deps.coin.GetBalance)
		r.Get("/transactions", deps.coin.ListTransactions)
		r.Post("/purchase-theme", deps.coin.PurchaseTheme)
		r.Post("/refund-theme", deps.coin.RefundTheme)
		r.Get("/purchased-themes", deps.coin.ListPurchasedThemes)
	})

	// --- Social endpoints ---
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

	// --- Creator endpoints (CREATOR, ADMIN) ---
	r.Route("/creator", func(r chi.Router) {
		r.Use(middleware.RequireRole("CREATOR", "ADMIN"))

		r.Get("/dashboard", deps.creator.GetDashboard)
		r.Get("/themes/{id}/stats", deps.creator.GetThemeStats)
		r.Get("/earnings", deps.creator.ListEarnings)
		r.Get("/settlements", deps.creator.ListSettlements)
	})

	// --- Editor endpoints (any authenticated user) ---
	r.Route("/editor", func(r chi.Router) {
		r.Get("/themes", deps.editor.ListMyThemes)
		r.Get("/themes/{id}", deps.editor.GetTheme)
		r.Post("/themes", deps.editor.CreateTheme)
		r.Put("/themes/{id}", deps.editor.UpdateTheme)
		r.Delete("/themes/{id}", deps.editor.DeleteTheme)
		r.Post("/themes/{id}/unpublish", deps.editor.UnpublishTheme)
		r.Post("/themes/{id}/submit-review", deps.editor.SubmitForReview)
		r.Get("/themes/{id}/characters", deps.editor.ListCharacters)
		r.Post("/themes/{id}/characters", deps.editor.CreateCharacter)
		r.Put("/characters/{id}", deps.editor.UpdateCharacter)
		r.Delete("/characters/{id}", deps.editor.DeleteCharacter)
		r.Put("/themes/{id}/config", deps.editor.UpdateConfigJson)
		// Maps
		r.Get("/themes/{id}/maps", deps.editor.ListMaps)
		r.Post("/themes/{id}/maps", deps.editor.CreateMap)
		r.Put("/maps/{id}", deps.editor.UpdateMap)
		r.Delete("/maps/{id}", deps.editor.DeleteMap)
		// Locations
		r.Get("/themes/{id}/locations", deps.editor.ListLocations)
		r.Post("/themes/{id}/maps/{mapId}/locations", deps.editor.CreateLocation)
		r.Put("/locations/{id}", deps.editor.UpdateLocation)
		r.Delete("/locations/{id}", deps.editor.DeleteLocation)
		// Clues
		r.Get("/themes/{id}/clues", deps.editor.ListClues)
		r.Post("/themes/{id}/clues", deps.editor.CreateClue)
		r.Put("/clues/{id}", deps.editor.UpdateClue)
		r.Delete("/clues/{id}", deps.editor.DeleteClue)
		// Clue relations
		r.Get("/themes/{id}/clue-relations", deps.editor.GetClueRelations)
		r.Put("/themes/{id}/clue-relations", deps.editor.ReplaceClueRelations)
		// Contents
		r.Get("/themes/{id}/content/{key}", deps.editor.GetContent)
		r.Put("/themes/{id}/content/{key}", deps.editor.UpsertContent)
		// Media
		r.Get("/themes/{id}/media", deps.media.ListMedia)
		r.Post("/themes/{id}/media/upload-url", deps.media.RequestUpload)
		r.Post("/themes/{id}/media/confirm", deps.media.ConfirmUpload)
		r.Post("/themes/{id}/media/youtube", deps.media.CreateYouTube)
		r.Patch("/media/{id}", deps.media.UpdateMedia)
		r.Delete("/media/{id}", deps.media.DeleteMedia)
		// Images (character avatars + clue images)
		r.Post("/themes/{id}/images/upload-url", deps.image.RequestUpload)
		r.Post("/themes/{id}/images/confirm", deps.image.ConfirmUpload)

		// Reading sections
		r.Get("/themes/{id}/reading-sections", deps.reading.ListReadingSections)
		r.Post("/themes/{id}/reading-sections", deps.reading.CreateReadingSection)
		r.Patch("/reading-sections/{id}", deps.reading.UpdateReadingSection)
		r.Delete("/reading-sections/{id}", deps.reading.DeleteReadingSection)
		// Validation
		r.Post("/themes/{id}/validate", deps.editor.ValidateTheme)
		// Module schemas
		r.Get("/module-schemas", deps.editor.GetModuleSchemas)
		// Flow (game flow canvas)
		r.Get("/themes/{id}/flow", deps.flow.GetFlow)
		r.Put("/themes/{id}/flow", deps.flow.SaveFlow)
		r.Post("/themes/{id}/flow/nodes", deps.flow.CreateNode)
		r.Patch("/themes/{id}/flow/nodes/{nodeId}", deps.flow.UpdateNode)
		r.Delete("/themes/{id}/flow/nodes/{nodeId}", deps.flow.DeleteNode)
		r.Post("/themes/{id}/flow/edges", deps.flow.CreateEdge)
		r.Patch("/themes/{id}/flow/edges/{edgeId}", deps.flow.UpdateEdge)
		r.Delete("/themes/{id}/flow/edges/{edgeId}", deps.flow.DeleteEdge)
		r.Post("/themes/{id}/flow/migrate", deps.flow.MigrateFlow)
	})

	// --- Admin endpoints (ADMIN only) ---
	r.Route("/admin", func(r chi.Router) {
		r.Use(middleware.RequireRole("ADMIN"))

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
