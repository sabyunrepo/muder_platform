package main

import "github.com/go-chi/chi/v5"

// registerEditorMediaRoutes wires media assets (video/audio/youtube), image
// uploads (character avatars + clue images), and reading sections onto an
// existing /editor subrouter.
func registerEditorMediaRoutes(r chi.Router, deps authedDeps) {
	// Media (video/audio/youtube)
	r.Get("/themes/{id}/media", deps.media.ListMedia)
	r.Post("/themes/{id}/media/upload-url", deps.media.RequestUpload)
	r.Post("/themes/{id}/media/confirm", deps.media.ConfirmUpload)
	r.Post("/themes/{id}/media/youtube", deps.media.CreateYouTube)
	r.Patch("/media/{id}", deps.media.UpdateMedia)
	r.Get("/media/{id}/download-url", deps.media.GetDownloadURL)
	r.Delete("/media/{id}", deps.media.DeleteMedia)

	// Images (character avatars + clue images)
	r.Post("/themes/{id}/images/upload-url", deps.image.RequestUpload)
	r.Post("/themes/{id}/images/confirm", deps.image.ConfirmUpload)

	// Reading sections
	r.Get("/themes/{id}/reading-sections", deps.reading.ListReadingSections)
	r.Post("/themes/{id}/reading-sections", deps.reading.CreateReadingSection)
	r.Patch("/reading-sections/{id}", deps.reading.UpdateReadingSection)
	r.Delete("/reading-sections/{id}", deps.reading.DeleteReadingSection)

	// Story information cards
	r.Get("/themes/{id}/story-infos", deps.storyInfo.ListStoryInfos)
	r.Post("/themes/{id}/story-infos", deps.storyInfo.CreateStoryInfo)
	r.Patch("/story-infos/{id}", deps.storyInfo.UpdateStoryInfo)
	r.Delete("/story-infos/{id}", deps.storyInfo.DeleteStoryInfo)
}
