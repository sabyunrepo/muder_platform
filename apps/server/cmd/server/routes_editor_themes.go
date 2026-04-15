package main

import "github.com/go-chi/chi/v5"

// registerEditorThemeRoutes wires /editor theme/character/map/location/clue/
// content endpoints plus validation and module schema introspection. Media,
// images, reading sections and flow canvas live in sibling files.
func registerEditorThemeRoutes(r chi.Router, deps authedDeps) {
	r.Route("/editor", func(r chi.Router) {
		// Themes
		r.Get("/themes", deps.editor.ListMyThemes)
		r.Get("/themes/{id}", deps.editor.GetTheme)
		r.Post("/themes", deps.editor.CreateTheme)
		r.Put("/themes/{id}", deps.editor.UpdateTheme)
		r.Delete("/themes/{id}", deps.editor.DeleteTheme)
		r.Post("/themes/{id}/unpublish", deps.editor.UnpublishTheme)
		r.Post("/themes/{id}/submit-review", deps.editor.SubmitForReview)
		r.Put("/themes/{id}/config", deps.editor.UpdateConfigJson)

		// Characters
		r.Get("/themes/{id}/characters", deps.editor.ListCharacters)
		r.Post("/themes/{id}/characters", deps.editor.CreateCharacter)
		r.Put("/characters/{id}", deps.editor.UpdateCharacter)
		r.Delete("/characters/{id}", deps.editor.DeleteCharacter)

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

		// Validation & module introspection
		r.Post("/themes/{id}/validate", deps.editor.ValidateTheme)
		r.Get("/module-schemas", deps.editor.GetModuleSchemas)
	})
}
