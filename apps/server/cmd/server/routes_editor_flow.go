package main

import "github.com/go-chi/chi/v5"

// registerEditorFlowRoutes wires the /editor flow-canvas (game flow graph)
// endpoints. Kept separate from theme/media routes so the canvas API surface
// can evolve independently.
func registerEditorFlowRoutes(r chi.Router, deps authedDeps) {
	r.Route("/editor", func(r chi.Router) {
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
}
