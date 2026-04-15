package main

import "github.com/go-chi/chi/v5"

// registerEditorMediaRoutes wires /editor media assets (video/audio/youtube),
// image uploads (character avatars + clue images), and reading sections.
// These share the /editor subtree with routes_editor_themes.go but are kept
// separate so the upload/confirm/CDN surface can evolve independently.
func registerEditorMediaRoutes(r chi.Router, deps authedDeps) {
	r.Route("/editor", func(r chi.Router) {
		// Media (video/audio/youtube)
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
	})
}
